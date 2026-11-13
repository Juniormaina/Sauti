import crypto from 'node:crypto';
import { Router } from 'express';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../src/db/index.ts';
import {
  assessments,
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
import { adminAuth } from '../../src/lib/firebase-admin.ts';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(2, 'Display name must be at least 2 characters'),
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
  email: z.string().email(),
  password: z.string().min(1),
});

function roleFromAccountType(accountType: string): string {
  if (accountType === 'parent') return 'PARENT';
  if (accountType === 'teacher' || accountType === 'institution') return 'TEACHER';
  return 'LEARNER';
}

function defaultAgeForEnvironment(env?: string): string {
  switch (env) {
    case 'little_voices':
      return '3-5';
    case 'young_explorers':
      return '6-10';
    case 'teen_voices':
      return '11-17';
    case 'professional_english':
      return '26-45';
    case 'lifelong_english':
      return '46+';
    default:
      return '18-25';
  }
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
    parentProfile: parent || null,
    teacherProfile: teacher || null,
  };
}

router.post('/register', async (req, res) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid registration data' });
    }

    const { email, password, displayName, accountType, environment, ageRange, parentConsentAccepted } =
      parsed.data;

    const normalizedEmail = email.toLowerCase().trim();
    const existing = await db.select().from(users).where(eq(users.email, normalizedEmail)).limit(1);
    if (existing.length > 0) {
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    const isChildEnv = environment === 'little_voices' || environment === 'young_explorers';
    if (isChildEnv && accountType === 'individual' && !parentConsentAccepted) {
      return res.status(400).json({
        error: 'Children under 13 require parent or guardian registration and consent.',
      });
    }

    const role = roleFromAccountType(accountType);
    const uid = `local:${crypto.randomUUID()}`;
    const passwordHash = hashPassword(password);

    const [created] = await db
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
      const [learner] = await db
        .insert(learnerProfiles)
        .values({
          userId: created.id,
          displayName: created.displayName,
          environment: targetEnv,
          ageRange: ageRange || defaultAgeForEnvironment(targetEnv),
          cefrLevel: 'A1',
          onboardingCompleted: false,
        })
        .returning();
      await db.insert(learningGoals).values({ learnerId: learner.id });
    } else {
      await ensureRoleProfile(created.id, role, created.displayName);
    }

    const token = signSessionToken({
      userId: created.id,
      uid: created.uid,
      email: created.email,
      role: created.role,
    });

    const profileData = await buildAuthPayload(created.id);
    return res.status(201).json({ token, ...profileData });
  } catch (err: any) {
    console.error('Register error:', err);
    return res.status(500).json({ error: 'Failed to create account. Please try again.' });
  }
});

router.post('/login', async (req, res) => {
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
  } catch (err: any) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Unable to sign in right now.' });
  }
});

router.post('/firebase-sync', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Missing Firebase ID token.' });
    }
    const idToken = authHeader.slice('Bearer '.length).trim();
    const decoded = await adminAuth.verifyIdToken(idToken);
    const { accountType, environment } = req.body || {};

    const role = accountType ? roleFromAccountType(accountType) : 'LEARNER';
    const user = await getOrCreateFirebaseUser(
      decoded.uid,
      decoded.email || `${decoded.uid}@firebase.local`,
      decoded.name,
      role,
      accountType || 'individual'
    );

    if (environment && user.role === 'LEARNER') {
      await db
        .update(learnerProfiles)
        .set({
          environment,
          ageRange: defaultAgeForEnvironment(environment),
          updatedAt: new Date(),
        })
        .where(eq(learnerProfiles.userId, user.id));
    }

    const profileData = await buildAuthPayload(user.id);
    return res.json(profileData);
  } catch (err: any) {
    console.error('Firebase sync error:', err);
    return res.status(401).json({ error: 'Could not verify Google Sign-In session.' });
  }
});

router.post('/forgot-password', async (req, res) => {
  try {
    const email = String(req.body?.email || '').toLowerCase().trim();
    if (!email || !email.includes('@')) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    if (user) {
      const rawToken = crypto.randomBytes(24).toString('hex');
      const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
      await db.insert(passwordResets).values({
        email,
        tokenHash,
        expiresAt: new Date(Date.now() + 1000 * 60 * 30),
      });
      // In a real email environment, send rawToken via transactional email provider.
      // Return generic confirmation without leaking account existence or tokens in prod.
      return res.json({
        message: 'If an account matches this email, password reset instructions have been prepared.',
        resetRequested: true,
      });
    }

    return res.json({
      message: 'If an account matches this email, password reset instructions have been prepared.',
      resetRequested: true,
    });
  } catch (err: any) {
    console.error('Forgot password error:', err);
    return res.status(500).json({ error: 'Unable to process password reset request.' });
  }
});

router.post('/reset-password', async (req, res) => {
  try {
    const { token, newPassword } = req.body || {};
    if (!token || typeof newPassword !== 'string' || newPassword.length < 8) {
      return res.status(400).json({ error: 'Valid reset token and 8+ character password required.' });
    }
    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex');
    const [reset] = await db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.tokenHash, tokenHash))
      .limit(1);

    if (!reset || reset.usedAt || reset.expiresAt < new Date()) {
      return res.status(400).json({ error: 'Reset token is invalid or expired.' });
    }

    const passwordHash = hashPassword(newPassword);
    await db.update(users).set({ passwordHash, updatedAt: new Date() }).where(eq(users.email, reset.email));
    await db.update(passwordResets).set({ usedAt: new Date() }).where(eq(passwordResets.id, reset.id));
    return res.json({ message: 'Password updated successfully. You can now sign in.' });
  } catch (err: any) {
    console.error('Reset password error:', err);
    return res.status(500).json({ error: 'Could not reset password.' });
  }
});

router.get('/session', requireAuth, async (req: AuthRequest, res) => {
  try {
    const profileData = await buildAuthPayload(req.authUser!.id);
    if (!profileData) return res.status(404).json({ error: 'User not found.' });
    return res.json(profileData);
  } catch (err: any) {
    console.error('Session fetch error:', err);
    return res.status(500).json({ error: 'Unable to load user session.' });
  }
});

const onboardingSchema = z.object({
  displayName: z.string().min(2),
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
  goals: z.array(z.string()).default([]),
  preferredActivities: z.array(z.string()).default([]),
  dailyGoalMinutes: z.number().int().min(5).max(120).default(15),
  assessmentAnswers: z.record(z.string(), z.string()).optional(),
  assessmentScore: z.number().int().optional(),
});

router.post('/onboarding', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = onboardingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid onboarding profile.' });
    }

    const data = parsed.data;
    const userId = req.authUser!.id;

    await db
      .update(users)
      .set({ displayName: data.displayName, updatedAt: new Date() })
      .where(eq(users.id, userId));

    let [learner] = await db
      .select()
      .from(learnerProfiles)
      .where(eq(learnerProfiles.userId, userId))
      .limit(1);

    if (!learner) {
      const [inserted] = await db
        .insert(learnerProfiles)
        .values({
          userId,
          displayName: data.displayName,
          ageRange: data.ageRange,
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
          ageRange: data.ageRange,
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
  } catch (err: any) {
    console.error('Onboarding save error:', err);
    return res.status(500).json({ error: 'Unable to save onboarding preferences.' });
  }
});

export default router;
