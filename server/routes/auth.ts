import crypto from 'node:crypto';
import { Router } from 'express';
import { and, eq, gt, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../src/db/index.ts';
import {
  assessments,
  guardianConsentEvents,
  learnerProfiles,
  learningGoals,
  parentProfiles,
  passwordResets,
  teacherProfiles,
  users,
} from '../../src/db/schema.ts';
import {
  ensureRoleProfile,
  getOrCreateFirebaseUser,
  hashPassword,
  signSessionToken,
  verifyPassword,
} from '../services/authService.ts';
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { createRateLimiter, getClientIp } from '../middleware/rateLimit.ts';
import { adminAuth } from '../../src/lib/firebase-admin.ts';
import {
  CURRENT_CONSENT_VERSION,
  defaultAgeRangeForEnvironment,
  hasActiveGuardianConsent,
  UNDER_13_ENVIRONMENTS,
  validateEnvironmentTransition,
} from '../services/childSafetyService.ts';

const router = Router();

const authLimiter = createRateLimiter({
  name: 'auth-credentials',
  windowMs: 15 * 60 * 1000,
  maxRequests: 25,
  message: 'Too many authentication attempts. Please wait a few minutes and try again.',
});

const passwordResetLimiter = createRateLimiter({
  name: 'auth-password-reset',
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  message: 'Too many password reset attempts. Please wait before trying again.',
});

const registerSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128),
  displayName: z.string().trim().min(2, 'Display name must be at least 2 characters').max(80),
  accountType: z.enum(['individual', 'parent', 'teacher', 'institution']).default('individual'),
  environment: z
    .enum([
      'little_voices',
      'young_explorers',
      'teen_voices',
      'young_adults',
      'professional_english',
      'lifelong_english',
    ])
    .optional(),
  ageRange: z.enum(['3-5', '6-10', '11-17', '18-25', '26-45', '46+']).optional(),
  parentConsentAccepted: z.boolean().optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(254),
  password: z.string().min(1).max(128),
});

function roleFromAccountType(accountType: string): string {
  if (accountType === 'parent') return 'PARENT';
  if (accountType === 'teacher' || accountType === 'institution') return 'TEACHER';
  return 'LEARNER';
}

async function buildAuthPayload(userId: number) {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  const [learner] = await db
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.userId, user.id))
    .limit(1);
  const [parent] = await db
    .select()
    .from(parentProfiles)
    .where(eq(parentProfiles.userId, user.id))
    .limit(1);
  const [teacher] = await db
    .select()
    .from(teacherProfiles)
    .where(eq(teacherProfiles.userId, user.id))
    .limit(1);

  return {
    user: {
      id: user.id,
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      accountType: user.accountType,
    },
    learnerProfile: learner || null,
    parentProfile: parent
      ? {
          ...parent,
          hasActiveConsent: hasActiveGuardianConsent(parent),
        }
      : null,
    teacherProfile: teacher || null,
  };
}

router.post('/register', authLimiter, async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration data' });
    }

    const { email, password, displayName, accountType, environment, parentConsentAccepted } =
      parsed.data;

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const isChildEnv = environment ? UNDER_13_ENVIRONMENTS.has(environment) : false;
    if (isChildEnv && accountType === 'individual') {
      return res.status(400).json({
        error:
          'Learners under 13 cannot self-register as individual accounts. Please create a Parent / Guardian account and add child profiles safely from the Parent Portal.',
      });
    }

    const role = roleFromAccountType(accountType);
    const uid = `local:${crypto.randomUUID()}`;
    const passwordHash = hashPassword(password);

    const created = await db.transaction(async (tx) => {
      const [userRow] = await tx
        .insert(users)
        .values({
          uid,
          email: normalizedEmail,
          passwordHash,
          displayName: displayName.trim(),
          role,
          accountType,
        })
        .returning();

      if (role === 'LEARNER') {
        const targetEnv = environment || 'young_adults';
        const [learner] = await tx
          .insert(learnerProfiles)
          .values({
            userId: userRow.id,
            displayName: userRow.displayName,
            environment: targetEnv,
            ageRange: defaultAgeRangeForEnvironment(targetEnv),
            cefrLevel: 'A1',
            onboardingCompleted: false,
          })
          .returning();
        await tx.insert(learningGoals).values({ learnerId: learner.id });
      } else if (role === 'PARENT') {
        const explicitConsent = parentConsentAccepted === true;
        const [parentRow] = await tx
          .insert(parentProfiles)
          .values({
            userId: userRow.id,
            consentAcceptedAt: explicitConsent ? new Date() : null,
            consentVersion: explicitConsent ? CURRENT_CONSENT_VERSION : null,
            consentRevokedAt: null,
          })
          .returning();

        if (explicitConsent) {
          await tx.insert(guardianConsentEvents).values({
            parentId: parentRow.id,
            actorUserId: userRow.id,
            action: 'accepted',
            consentVersion: CURRENT_CONSENT_VERSION,
            ipAddress: getClientIp(req),
            userAgent: (req.headers['user-agent'] || '').slice(0, 250) || null,
          });
        }
      } else if (role === 'TEACHER') {
        await tx.insert(teacherProfiles).values({ userId: userRow.id });
      }

      return userRow;
    });

    const token = signSessionToken({
      userId: created.id,
      uid: created.uid,
      email: created.email,
      role: created.role,
    });

    const profileData = await buildAuthPayload(created.id);
    return res.status(201).json({ token, ...profileData });
  } catch {
    return res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

router.post('/login', authLimiter, async (req, res) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Please provide a valid email and password.' });
    }

    const normalizedEmail = parsed.data.email.toLowerCase().trim();
    const [user] = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (!user || !user.passwordHash) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const valid = verifyPassword(parsed.data.password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = signSessionToken({
      userId: user.id,
      uid: user.uid,
      email: user.email,
      role: user.role,
    });

    const profileData = await buildAuthPayload(user.id);
    return res.json({ token, ...profileData });
  } catch {
    return res.status(500).json({ error: 'Unable to sign in right now.' });
  }
});

const firebaseSyncSchema = z.object({
  accountType: z.enum(['individual', 'parent', 'teacher', 'institution']).optional(),
  environment: z
    .enum([
      'little_voices',
      'young_explorers',
      'teen_voices',
      'young_adults',
      'professional_english',
      'lifelong_english',
    ])
    .optional(),
});

router.post('/firebase-sync', authLimiter, async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Firebase ID token.' });
    }
    const idToken = authHeader.slice('Bearer '.length).trim();
    if (!idToken || idToken.length > 4096) {
      return res.status(401).json({ error: 'Invalid Firebase ID token.' });
    }

    const parsed = firebaseSyncSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid sign-in profile parameters.' });
    }

    const { accountType = 'individual', environment } = parsed.data;
    if (environment && UNDER_13_ENVIRONMENTS.has(environment) && accountType === 'individual') {
      return res.status(400).json({
        error:
          'Learners under 13 cannot self-register as individual accounts. Please select Parent / Guardian.',
      });
    }

    const decoded = await adminAuth.verifyIdToken(idToken);
    const role = roleFromAccountType(accountType);
    const user = await getOrCreateFirebaseUser(
      decoded.uid,
      decoded.email || `${decoded.uid}@firebase.local`,
      decoded.name,
      role,
      accountType
    );

    if (environment && user.role === 'LEARNER' && !UNDER_13_ENVIRONMENTS.has(environment)) {
      const [existingLearner] = await db
        .select()
        .from(learnerProfiles)
        .where(eq(learnerProfiles.userId, user.id))
        .limit(1);

      // Only apply requested environment during initial pre-onboarding setup, never downgrading/escalating existing minors.
      if (existingLearner && !existingLearner.onboardingCompleted) {
        const transition = validateEnvironmentTransition(existingLearner, environment, {
          isParentActingForChild: false,
        });
        if (transition.allowed) {
          await db
            .update(learnerProfiles)
            .set({
              environment,
              ageRange: defaultAgeRangeForEnvironment(environment),
              updatedAt: new Date(),
            })
            .where(eq(learnerProfiles.id, existingLearner.id));
        }
      }
    }

    await ensureRoleProfile(user.id, user.role, user.displayName);
    const profileData = await buildAuthPayload(user.id);
    return res.json(profileData);
  } catch {
    return res.status(401).json({ error: 'Could not verify Google Sign-In session.' });
  }
});

router.post('/forgot-password', passwordResetLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim();
    if (!email || !email.includes('@') || email.length > 254) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
    if (user) {
      const rawToken = crypto.randomBytes(24).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await db.insert(passwordResets).values({
        email,
        tokenHash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      });
    }

    return res.json({
      message: 'If an account matches this email, password reset instructions have been prepared.',
      resetRequested: true,
    });
  } catch {
    return res.status(500).json({ error: 'Unable to process password reset request.' });
  }
});

router.post('/reset-password', passwordResetLimiter, async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || typeof token !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8 || newPassword.length > 128) {
      return res.status(400).json({ error: 'Valid reset token and 8+ character password required.' });
    }
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const passwordHash = hashPassword(newPassword);

    const consumed = await db.transaction(async (tx) => {
      const [reset] = await tx
        .update(passwordResets)
        .set({ usedAt: new Date() })
        .where(
          and(
            eq(passwordResets.tokenHash, tokenHash),
            isNull(passwordResets.usedAt),
            gt(passwordResets.expiresAt, new Date())
          )
        )
        .returning();

      if (!reset) return null;

      await tx
        .update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.email, reset.email));

      return reset;
    });

    if (!consumed) {
      return res.status(400).json({ error: 'Reset token is invalid or expired.' });
    }

    return res.json({ message: 'Password updated successfully. You can now sign in.' });
  } catch {
    return res.status(500).json({ error: 'Could not reset password.' });
  }
});

router.get('/session', requireAuth, async (req: AuthRequest, res) => {
  try {
    const profileData = await buildAuthPayload(req.authUser!.id);
    if (!profileData) return res.status(404).json({ error: 'User not found.' });
    return res.json(profileData);
  } catch {
    return res.status(500).json({ error: 'Unable to load user session.' });
  }
});

const onboardingSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  ageRange: z.enum(['3-5', '6-10', '11-17', '18-25', '26-45', '46+']),
  environment: z.enum([
    'little_voices',
    'young_explorers',
    'teen_voices',
    'young_adults',
    'professional_english',
    'lifelong_english',
  ]),
  cefrLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']),
  goals: z.array(z.string().max(120)).max(10).default([]),
  preferredActivities: z.array(z.string().max(120)).max(10).default([]),
  dailyGoalMinutes: z.number().int().min(5).max(120).default(15),
  assessmentAnswers: z.record(z.string(), z.string()).optional(),
  assessmentScore: z.number().int().min(0).max(100).optional(),
});

router.post('/onboarding', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = onboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid onboarding profile.' });
    }

    const data = parsed.data;
    const userId = req.authUser!.id;

    let [learner] = await db
      .select()
      .from(learnerProfiles)
      .where(eq(learnerProfiles.userId, userId))
      .limit(1);

    if (UNDER_13_ENVIRONMENTS.has(data.environment) && (!learner || !learner.parentId)) {
      return res.status(400).json({
        error:
          'Under-13 child environments must be created and managed from a Parent Portal account with guardian consent.',
      });
    }

    if (learner) {
      const transition = validateEnvironmentTransition(learner, data.environment, {
        isParentActingForChild: false,
        isAdmin: req.authUser!.role === 'ADMIN',
      });
      if (!transition.allowed) {
        return res.status(403).json({ error: transition.error });
      }
    }

    const derivedAgeRange = defaultAgeRangeForEnvironment(data.environment);

    await db
      .update(users)
      .set({ displayName: data.displayName, updatedAt: new Date() })
      .where(eq(users.id, userId));

    if (!learner) {
      const [inserted] = await db
        .insert(learnerProfiles)
        .values({
          userId,
          displayName: data.displayName,
          ageRange: derivedAgeRange,
          environment: data.environment,
          cefrLevel: data.cefrLevel,
          goals: data.goals,
          preferredActivities: data.preferredActivities,
          dailyGoalMinutes: data.dailyGoalMinutes,
          onboardingCompleted: true,
        })
        .returning();
      learner = inserted;
    } else {
      const [updated] = await db
        .update(learnerProfiles)
        .set({
          displayName: data.displayName,
          ageRange: derivedAgeRange,
          environment: data.environment,
          cefrLevel: data.cefrLevel,
          goals: data.goals,
          preferredActivities: data.preferredActivities,
          dailyGoalMinutes: data.dailyGoalMinutes,
          onboardingCompleted: true,
          updatedAt: new Date(),
        })
        .where(eq(learnerProfiles.id, learner.id))
        .returning();
      learner = updated;
    }

    if (data.assessmentAnswers) {
      await db.insert(assessments).values({
        learnerId: learner.id,
        recommendedLevel: data.cefrLevel,
        answersJson: data.assessmentAnswers,
        score: data.assessmentScore ?? 0,
      });
    }

    const existingGoal = await db
      .select()
      .from(learningGoals)
      .where(eq(learningGoals.learnerId, learner.id))
      .limit(1);

    if (existingGoal.length === 0) {
      await db.insert(learningGoals).values({
        learnerId: learner.id,
        title: data.goals[0] || 'Build daily speaking confidence',
        targetMinutesPerDay: data.dailyGoalMinutes,
        focusSkills: data.preferredActivities.length ? data.preferredActivities : ['Speaking', 'Listening'],
      });
    } else {
      await db
        .update(learningGoals)
        .set({
          title: data.goals[0] || existingGoal[0].title,
          targetMinutesPerDay: data.dailyGoalMinutes,
          focusSkills: data.preferredActivities.length ? data.preferredActivities : existingGoal[0].focusSkills,
          updatedAt: new Date(),
        })
        .where(eq(learningGoals.learnerId, learner.id));
    }

    const payload = await buildAuthPayload(userId);
    return res.json(payload);
  } catch {
    return res.status(500).json({ error: 'Unable to save onboarding preferences.' });
  }
});

export default router;
