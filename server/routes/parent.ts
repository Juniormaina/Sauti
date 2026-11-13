import { Router } from 'express';
import { and, desc, eq } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../src/db/index.ts';
import {
  learnerProfiles,
  learnerProgress,
  lessons,
  parentProfiles,
  voicePracticeSessions,
} from '../../src/db/schema.ts';
import { AuthRequest, requireAuth, requireRole } from '../middleware/auth.ts';

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
      .values({ userId, consentAcceptedAt: new Date() })
      .returning();
    parent = created;
  }
  return parent;
}

router.get('/dashboard', async (req: AuthRequest, res) => {
  try {
    const parent = await getOrCreateParent(req.authUser!.id);
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

    return res.json({ parent, children: enrichedChildren });
  } catch (err: any) {
    console.error('Parent dashboard error:', err);
    return res.status(500).json({ error: 'Unable to load parent dashboard.' });
  }
});

const createChildSchema = z.object({
  displayName: z.string().min(2),
  ageRange: z.enum(['3-5', '6-10', '11-17']),
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

    const [child] = await db
      .insert(learnerProfiles)
      .values({
        parentId: parent.id,
        displayName: parsed.data.displayName,
        ageRange: parsed.data.ageRange,
        environment: parsed.data.environment,
        cefrLevel: parsed.data.cefrLevel,
        dailyGoalMinutes: parsed.data.dailyGoalMinutes,
        onboardingCompleted: true,
      })
      .returning();

    return res.status(201).json({ child });
  } catch (err: any) {
    console.error('Create child profile error:', err);
    return res.status(500).json({ error: 'Unable to create child profile.' });
  }
});

router.get('/children/:id', async (req: AuthRequest, res) => {
  try {
    const childId = Number(req.params.id);
    const parent = await getOrCreateParent(req.authUser!.id);

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
  } catch (err: any) {
    console.error('Child detail error:', err);
    return res.status(500).json({ error: 'Unable to load child progress.' });
  }
});

router.patch('/settings', async (req: AuthRequest, res) => {
  try {
    const parent = await getOrCreateParent(req.authUser!.id);
    const { recordingRetentionDays, allowAiLiveForChildren } = req.body || {};

    const [updated] = await db
      .update(parentProfiles)
      .set({
        recordingRetentionDays:
          typeof recordingRetentionDays === 'number'
            ? recordingRetentionDays
            : parent.recordingRetentionDays,
        allowAiLiveForChildren:
          typeof allowAiLiveForChildren === 'boolean'
            ? allowAiLiveForChildren
            : parent.allowAiLiveForChildren,
      })
      .where(eq(parentProfiles.id, parent.id))
      .returning();

    return res.json({ parent: updated });
  } catch (err: any) {
    console.error('Parent settings error:', err);
    return res.status(500).json({ error: 'Unable to update parent privacy controls.' });
  }
});

export default router;
