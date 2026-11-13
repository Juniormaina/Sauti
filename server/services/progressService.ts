import { and, eq, sql } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  achievements,
  conversationSessions,
  learnerAchievements,
  learnerProfiles,
  learnerProgress,
  voicePracticeSessions,
} from '../../src/db/schema.ts';

type DbExecutor = Pick<typeof db, 'select' | 'insert' | 'update'>;

export async function awardXpAtomically(
  executor: DbExecutor,
  learnerId: number,
  xpDelta: number
): Promise<void> {
  if (!Number.isFinite(xpDelta) || xpDelta <= 0) return;
  const amount = Math.round(xpDelta);
  await executor
    .update(learnerProfiles)
    .set({
      xp: sql`${learnerProfiles.xp} + ${amount}`,
      updatedAt: new Date(),
    })
    .where(eq(learnerProfiles.id, learnerId));
}

export async function awardSingleAchievement(
  executor: DbExecutor,
  learnerId: number,
  achievementCode: string
): Promise<string | null> {
  const [ach] = await executor
    .select()
    .from(achievements)
    .where(eq(achievements.code, achievementCode))
    .limit(1);

  if (!ach) return null;

  const inserted = await executor
    .insert(learnerAchievements)
    .values({ learnerId, achievementId: ach.id })
    .onConflictDoNothing()
    .returning();

  if (inserted.length > 0) {
    await awardXpAtomically(executor, learnerId, ach.xpReward);
    return ach.title;
  }

  return null;
}

export async function checkAndAwardAchievements(
  executor: DbExecutor,
  learnerId: number
): Promise<string[]> {
  const allAchievements = await executor.select().from(achievements);
  const existing = await executor
    .select()
    .from(learnerAchievements)
    .where(eq(learnerAchievements.learnerId, learnerId));
  const completedLessons = await executor
    .select()
    .from(learnerProgress)
    .where(and(eq(learnerProgress.learnerId, learnerId), eq(learnerProgress.status, 'completed')));
  const voiceRows = await executor
    .select({ id: voicePracticeSessions.id })
    .from(voicePracticeSessions)
    .where(eq(voicePracticeSessions.learnerId, learnerId));
  const convRows = await executor
    .select({ id: conversationSessions.id })
    .from(conversationSessions)
    .where(eq(conversationSessions.learnerId, learnerId));
  const learnerRows = await executor
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.id, learnerId))
    .limit(1);

  const learner = learnerRows[0];
  if (!learner) return [];

  const earnedIds = new Set(existing.map((e) => e.achievementId));
  const newlyEarned: string[] = [];

  for (const ach of allAchievements) {
    if (earnedIds.has(ach.id)) continue;

    let qualifies = false;
    if (ach.code === 'FIRST_LESSON' && completedLessons.length >= 1) qualifies = true;
    if (ach.code === 'FIVE_LESSONS' && completedLessons.length >= 5) qualifies = true;
    if (ach.code === 'VOICE_PIONEER' && voiceRows.length >= 1) qualifies = true;
    if (ach.code === 'CONVERSATION_BUILDER' && convRows.length >= 1) qualifies = true;
    if (ach.code === 'STREAK_THREE' && (learner.streakDays || 0) >= 3) qualifies = true;

    if (qualifies) {
      const inserted = await executor
        .insert(learnerAchievements)
        .values({ learnerId, achievementId: ach.id })
        .onConflictDoNothing()
        .returning();

      if (inserted.length > 0) {
        await awardXpAtomically(executor, learnerId, ach.xpReward);
        newlyEarned.push(ach.title);
      }
    }
  }

  return newlyEarned;
}
