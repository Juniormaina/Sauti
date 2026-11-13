import { Router } from 'express';
import { and, desc, eq, inArray, lt } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../src/db/index.ts';
import {
  conversationSessions,
  guardianConsentEvents,
  learnerProfiles,
  learnerProgress,
  lessons,
  parentProfiles,
  voicePracticeSessions,
} from '../../src/db/schema.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';
import { parsePositiveInt } from '../services/authorizationService.ts';
import {
  CURRENT_CONSENT_VERSION,
  defaultAgeRangeForEnvironment,
  hasActiveGuardianConsent,
} from '../services/childSafetyService.ts';
import { terminateLiveSessionsForParent } from '../services/liveTicketService.ts';
import { getClientIp } from '../middleware/rateLimit.ts';

const router = Router();
router.use(requireAuth, requireRole('PARENT', 'ADMIN'));

async function getOrCreateParent(userId: number) {
  let [parent] = await db
    .select()
    .from(parentProfiles)
    .where(eq(parentProfiles.userId, userId))
    .limit(1);

  if (!parent) {
    const [created] = await db
      .insert(parentProfiles)
      .values({
        userId,
        consentAcceptedAt: null,
        consentVersion: null,
        consentRevokedAt: null,
      })
      .returning();
    parent = created;
  }
  return parent;
}

async function enforceChildTranscriptRetention(parentId: number, retentionDays: number) {
  const children = await db
    .select({ id: learnerProfiles.id })
    .from(learnerProfiles)
    .where(eq(learnerProfiles.parentId, parentId));
  if (children.length === 0) return;
  const childIds = children.map((c) => c.id);

  if (retentionDays <= 0) {
    await db
      .update(voicePracticeSessions)
      .set({ transcript: null })
      .where(inArray(voicePracticeSessions.learnerId, childIds));
    await db
      .update(conversationSessions)
      .set({ transcriptJson: [] })
      .where(inArray(conversationSessions.learnerId, childIds));
    return;
  }

  const cutoff = new Date(Date.now() - retentionDays * 86_400_000);
  await db
    .update(voicePracticeSessions)
    .set({ transcript: null })
    .where(
      and(
        inArray(voicePracticeSessions.learnerId, childIds),
        lt(voicePracticeSessions.createdAt, cutoff)
      )
    );
  await db
    .update(conversationSessions)
    .set({ transcriptJson: [] })
    .where(
      and(
        inArray(conversationSessions.learnerId, childIds),
        lt(conversationSessions.createdAt, cutoff)
      )
    );
}

router.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const parent = await getOrCreateParent(req.authUser!.id);
    await enforceChildTranscriptRetention(parent.id, parent.recordingRetentionDays);

    const children = await db
      .select()
      .from(learnerProfiles)
      .where(eq(learnerProfiles.parentId, parent.id));

    const enrichedChildren = await Promise.all(
      children.map(async (child) => {
        const prog = await db
          .select()
          .from(learnerProgress)
          .where(and(eq(learnerProgress.learnerId, child.id), eq(learnerProgress.status, 'completed')));
        const voice = await db
          .select()
          .from(voicePracticeSessions)
          .where(eq(voicePracticeSessions.learnerId, child.id))
          .orderBy(desc(voicePracticeSessions.createdAt))
          .limit(5);
        return {
          ...child,
          completedLessonsCount: prog.length,
          recentVoiceCount: voice.length,
        };
      })
    );

    const consentEvents = await db
      .select({
        id: guardianConsentEvents.id,
        action: guardianConsentEvents.action,
        consentVersion: guardianConsentEvents.consentVersion,
        createdAt: guardianConsentEvents.createdAt,
      })
      .from(guardianConsentEvents)
      .where(eq(guardianConsentEvents.parentId, parent.id))
      .orderBy(desc(guardianConsentEvents.createdAt))
      .limit(10);

    return res.json({
      parent: {
        ...parent,
        hasActiveConsent: hasActiveGuardianConsent(parent),
      },
      children: enrichedChildren,
      consentEvents,
    });
  } catch {
    return res.status(500).json({ error: 'Unable to load parent dashboard.' });
  }
});

const acceptConsentSchema = z.object({
  confirmed: z.literal(true, {
    error: 'You must explicitly confirm guardian consent.',
  }),
  consentVersion: z.string().trim().min(1).max(40).optional(),
});

router.post('/consent', async (req: AuthRequest, res) => {
  try {
    const parsed = acceptConsentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Explicit consent confirmation is required.' });
    }

    const parent = await getOrCreateParent(req.authUser!.id);
    const now = new Date();
    const version = parsed.data.consentVersion || CURRENT_CONSENT_VERSION;

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(parentProfiles)
        .set({
          consentAcceptedAt: now,
          consentRevokedAt: null,
          consentVersion: version,
        })
        .where(eq(parentProfiles.id, parent.id))
        .returning();

      await tx.insert(guardianConsentEvents).values({
        parentId: parent.id,
        actorUserId: req.authUser!.id,
        action: 'accepted',
        consentVersion: version,
        ipAddress: getClientIp(req),
        userAgent: (req.headers['user-agent'] || '').slice(0, 250) || null,
      });

      return row;
    });

    return res.json({
      parent: {
        ...updated,
        hasActiveConsent: hasActiveGuardianConsent(updated),
      },
    });
  } catch {
    return res.status(500).json({ error: 'Unable to record guardian consent.' });
  }
});

router.post('/consent/revoke', async (req: AuthRequest, res) => {
  try {
    const parent = await getOrCreateParent(req.authUser!.id);
    const now = new Date();
    const version = parent.consentVersion || CURRENT_CONSENT_VERSION;

    const updated = await db.transaction(async (tx) => {
      const [row] = await tx
        .update(parentProfiles)
        .set({
          consentRevokedAt: now,
          allowAiLiveForChildren: false,
        })
        .where(eq(parentProfiles.id, parent.id))
        .returning();

      await tx.insert(guardianConsentEvents).values({
        parentId: parent.id,
        actorUserId: req.authUser!.id,
        action: 'revoked',
        consentVersion: version,
        ipAddress: getClientIp(req),
        userAgent: (req.headers['user-agent'] || '').slice(0, 250) || null,
      });

      return row;
    });

    terminateLiveSessionsForParent(
      parent.id,
      'Guardian consent was revoked in the Parent Portal. Live AI voice has ended.'
    );

    return res.json({
      parent: {
        ...updated,
        hasActiveConsent: hasActiveGuardianConsent(updated),
      },
    });
  } catch {
    return res.status(500).json({ error: 'Unable to revoke guardian consent.' });
  }
});

const createChildSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  ageRange: z.enum(['3-5', '6-10', '11-17']).optional(),
  environment: z.enum(['little_voices', 'young_explorers', 'teen_voices']),
  cefrLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).default('A1'),
  dailyGoalMinutes: z.number().int().min(5).max(90).default(15),
  consentConfirmed: z.boolean().refine((v) => v === true, 'Guardian consent is required.'),
});

router.post('/children', async (req: AuthRequest, res) => {
  try {
    const parsed = createChildSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid child profile.' });
    }
    const parent = await getOrCreateParent(req.authUser!.id);

    // Do NOT treat a request-body boolean as sufficient if guardian consent has not been explicitly recorded or was revoked.
    if (!hasActiveGuardianConsent(parent)) {
      return res.status(403).json({
        error: 'Explicit guardian consent must be accepted and active in the Parent Portal before adding a child profile.',
        code: 'CONSENT_REQUIRED',
      });
    }

    const expectedAgeRange = defaultAgeRangeForEnvironment(parsed.data.environment);

    const child = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(learnerProfiles)
        .values({
          parentId: parent.id,
          displayName: parsed.data.displayName,
          ageRange: expectedAgeRange,
          environment: parsed.data.environment,
          cefrLevel: parsed.data.cefrLevel,
          dailyGoalMinutes: parsed.data.dailyGoalMinutes,
          onboardingCompleted: true,
        })
        .returning();

      await tx.insert(guardianConsentEvents).values({
        parentId: parent.id,
        actorUserId: req.authUser!.id,
        action: 'child_created',
        consentVersion: parent.consentVersion || CURRENT_CONSENT_VERSION,
        ipAddress: getClientIp(req),
        userAgent: (req.headers['user-agent'] || '').slice(0, 250) || null,
        metadataJson: {
          childId: created.id,
          environment: created.environment,
        },
      });

      return created;
    });

    return res.status(201).json({ child });
  } catch {
    return res.status(500).json({ error: 'Unable to create child profile.' });
  }
});

router.get('/children/:id', async (req: AuthRequest, res) => {
  try {
    const childId = parsePositiveInt(req.params.id);
    if (!childId) return res.status(400).json({ error: 'Invalid child identifier.' });

    const parent = await getOrCreateParent(req.authUser!.id);
    await enforceChildTranscriptRetention(parent.id, parent.recordingRetentionDays);

    const [child] = await db
      .select()
      .from(learnerProfiles)
      .where(and(eq(learnerProfiles.id, childId), eq(learnerProfiles.parentId, parent.id)))
      .limit(1);

    if (!child) return res.status(404).json({ error: 'Child profile not found.' });

    const progressRows = await db
      .select()
      .from(learnerProgress)
      .where(eq(learnerProgress.learnerId, child.id));
    const allLessons = await db.select().from(lessons);
    const lessonMap = new Map(allLessons.map((l) => [l.id, l]));

    const voiceHistory = await db
      .select()
      .from(voicePracticeSessions)
      .where(eq(voicePracticeSessions.learnerId, child.id))
      .orderBy(desc(voicePracticeSessions.createdAt))
      .limit(15);

    return res.json({
      child,
      completedLessons: progressRows.map((p) => ({
        ...p,
        lessonTitle: lessonMap.get(p.lessonId)?.title || 'Lesson',
      })),
      voiceSessions: voiceHistory,
    });
  } catch {
    return res.status(500).json({ error: 'Unable to load child progress.' });
  }
});

const parentSettingsSchema = z.object({
  recordingRetentionDays: z.number().int().min(0).max(90).optional(),
  allowAiLiveForChildren: z.boolean().optional(),
});

router.patch('/settings', async (req: AuthRequest, res) => {
  try {
    const parsed = parentSettingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid parent settings.' });
    }

    const parent = await getOrCreateParent(req.authUser!.id);

    if (parsed.data.allowAiLiveForChildren === true && !hasActiveGuardianConsent(parent)) {
      return res.status(403).json({
        error: 'Active guardian consent is required before enabling Live AI conversations for children.',
        code: 'CONSENT_REQUIRED',
      });
    }

    const nextRetention =
      parsed.data.recordingRetentionDays !== undefined
        ? parsed.data.recordingRetentionDays
        : parent.recordingRetentionDays;

    const nextAllowLive =
      parsed.data.allowAiLiveForChildren !== undefined
        ? parsed.data.allowAiLiveForChildren
        : parent.allowAiLiveForChildren;

    const [updated] = await db
      .update(parentProfiles)
      .set({
        recordingRetentionDays: nextRetention,
        allowAiLiveForChildren: nextAllowLive,
      })
      .where(eq(parentProfiles.id, parent.id))
      .returning();

    if (nextAllowLive === false) {
      terminateLiveSessionsForParent(
        parent.id,
        'Live AI conversations were paused by parent privacy settings.'
      );
    }

    if (parsed.data.recordingRetentionDays !== undefined) {
      await enforceChildTranscriptRetention(parent.id, nextRetention);
    }

    return res.json({
      parent: {
        ...updated,
        hasActiveConsent: hasActiveGuardianConsent(updated),
      },
    });
  } catch {
    return res.status(500).json({ error: 'Unable to update parent privacy controls.' });
  }
});

export default router;
