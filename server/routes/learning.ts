import { Router } from 'express';
import { and, asc, desc, eq, inArray, sql } from 'drizzle-orm';
import { z } from 'zod';
import { db } from '../../src/db/index.ts';
import {
  achievements,
  activities,
  conversationSessions,
  courses,
  learnerAchievements,
  learnerProfiles,
  learnerProgress,
  learningAttempts,
  learningGoals,
  lessons,
  modules,
  programmes,
  voicePracticeSessions,
} from '../../src/db/schema.ts';
import { AuthRequest, optionalAuth, requireAuth } from '../middleware/auth.ts';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import { ensureSeeded } from '../services/seedService.ts';
import { compareTranscriptWords, voiceProvider } from '../services/aiVoiceService.ts';
import { parsePositiveInt, resolveAuthorizedLearner } from '../services/authorizationService.ts';
import {
  canLearnerAccessCourseEnvironment,
  defaultAgeRangeForEnvironment,
  shouldStoreTranscripts,
  validateEnvironmentTransition,
} from '../services/childSafetyService.ts';
import { awardXpAtomically, checkAndAwardAchievements } from '../services/progressService.ts';

const router = Router();

const aiActivityLimiter = createRateLimiter({
  name: 'ai-activity-eval',
  windowMs: 10 * 60 * 1000,
  maxRequests: 30,
  keyGenerator: (req) => `user:${(req as AuthRequest).authUser?.id ?? 'anon'}`,
  message: 'Too many AI-evaluated activity submissions. Please pause briefly before submitting again.',
});

const attemptSchema = z.object({
  learnerId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional(),
  clientAttemptId: z.string().trim().min(1).max(80).optional(),
  answer: z.union([
    z.string().max(4000),
    z.array(z.string().max(200)).max(100),
    z.record(z.string().max(200), z.string().max(200)),
  ]),
});

const completeLessonSchema = z.object({
  learnerId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional(),
  minutesSpent: z.number().finite().min(1).max(240).optional(),
});

const settingsSchema = z.object({
  learnerId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).optional(),
  displayName: z.string().trim().min(2).max(80).optional(),
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
  cefrLevel: z.enum(['A1', 'A2', 'B1', 'B2', 'C1', 'C2']).optional(),
  dailyGoalMinutes: z.number().int().min(5).max(120).optional(),
  voicePreferences: z
    .object({
      voiceName: z.enum(['Puck', 'Charon', 'Kore', 'Fenrir', 'Zephyr']),
      playbackSpeed: z.number().min(0.5).max(1.75),
      saveTranscripts: z.boolean(),
    })
    .optional(),
});

async function getOptionalAuthorizedLearner(req: AuthRequest) {
  if (!req.authUser) return null;
  const result = await resolveAuthorizedLearner(req.authUser, req.query.learnerId);
  return result.ok ? result.learner : null;
}

router.get('/programmes', async (_req, res) => {
  try {
    await ensureSeeded();
    const rows = await db.select().from(programmes).orderBy(asc(programmes.sortOrder));
    return res.json({ programmes: rows });
  } catch {
    return res.status(500).json({ error: 'Unable to load programmes.' });
  }
});

router.get('/courses', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const { environment, cefrLevel, topic, skillFocus, maxMinutes } = req.query;
    const learner = await getOptionalAuthorizedLearner(req);

    const allProgrammes = await db.select().from(programmes).orderBy(asc(programmes.sortOrder));
    const allCourses = await db.select().from(courses).orderBy(asc(courses.sortOrder));
    const progMap = new Map(allProgrammes.map((p) => [p.id, p]));

    let filtered = allCourses
      .filter((c) => c.isPublished)
      .map((c) => ({
        ...c,
        programme: progMap.get(c.programmeId) || null,
      }))
      .filter((c) => {
        if (!learner) return true;
        return canLearnerAccessCourseEnvironment(learner, c.programme?.environment);
      });

    if (environment && environment !== 'all') {
      filtered = filtered.filter((c) => c.programme?.environment === String(environment));
    }
    if (cefrLevel && cefrLevel !== 'all') {
      filtered = filtered.filter((c) => c.cefrLevel === String(cefrLevel));
    }
    if (topic && topic !== 'all') {
      filtered = filtered.filter((c) => c.topic.toLowerCase() === String(topic).toLowerCase());
    }
    if (skillFocus && skillFocus !== 'all') {
      filtered = filtered.filter((c) => c.skillFocus.toLowerCase() === String(skillFocus).toLowerCase());
    }
    if (maxMinutes) {
      const limit = Number(maxMinutes);
      if (!Number.isNaN(limit) && limit > 0) {
        filtered = filtered.filter((c) => c.estimatedMinutes <= limit);
      }
    }

    return res.json({ courses: filtered });
  } catch {
    return res.status(500).json({ error: 'Unable to load courses.' });
  }
});

router.get('/courses/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const courseId = parsePositiveInt(req.params.id);
    if (!courseId) return res.status(400).json({ error: 'Invalid course ID.' });

    const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
    if (!course) return res.status(404).json({ error: 'Course not found.' });

    const [programme] = await db.select().from(programmes).where(eq(programmes.id, course.programmeId)).limit(1);
    const learner = await getOptionalAuthorizedLearner(req);
    if (learner && !canLearnerAccessCourseEnvironment(learner, programme?.environment)) {
      return res.status(403).json({
        error: 'This course is outside the age environment permitted for the active learner profile.',
      });
    }

    const courseModules = await db
      .select()
      .from(modules)
      .where(eq(modules.courseId, course.id))
      .orderBy(asc(modules.sortOrder));

    const modIds = courseModules.map((m) => m.id);
    const courseLessons = modIds.length
      ? await db.select().from(lessons).where(inArray(lessons.moduleId, modIds)).orderBy(asc(lessons.sortOrder))
      : [];

    const enrichedModules = courseModules.map((m) => ({
      ...m,
      lessons: courseLessons.filter((l) => l.moduleId === m.id),
    }));

    return res.json({ course, programme, modules: enrichedModules });
  } catch {
    return res.status(500).json({ error: 'Unable to load course details.' });
  }
});

router.get('/modules/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const moduleId = parsePositiveInt(req.params.id);
    if (!moduleId) return res.status(400).json({ error: 'Invalid module ID.' });

    const [mod] = await db.select().from(modules).where(eq(modules.id, moduleId)).limit(1);
    if (!mod) return res.status(404).json({ error: 'Module not found.' });

    const [course] = await db.select().from(courses).where(eq(courses.id, mod.courseId)).limit(1);
    const [programme] = course
      ? await db.select().from(programmes).where(eq(programmes.id, course.programmeId)).limit(1)
      : [null];

    const learner = await getOptionalAuthorizedLearner(req);
    if (learner && !canLearnerAccessCourseEnvironment(learner, programme?.environment)) {
      return res.status(403).json({
        error: 'This module is outside the age environment permitted for the active learner profile.',
      });
    }

    const modLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.moduleId, mod.id))
      .orderBy(asc(lessons.sortOrder));

    return res.json({ module: mod, course, lessons: modLessons });
  } catch {
    return res.status(500).json({ error: 'Unable to load module.' });
  }
});

router.get('/lessons/:id', optionalAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const lessonId = parsePositiveInt(req.params.id);
    if (!lessonId) return res.status(400).json({ error: 'Invalid lesson ID.' });

    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });

    const [mod] = await db.select().from(modules).where(eq(modules.id, lesson.moduleId)).limit(1);
    const [course] = mod ? await db.select().from(courses).where(eq(courses.id, mod.courseId)).limit(1) : [null];
    const [programme] = course
      ? await db.select().from(programmes).where(eq(programmes.id, course.programmeId)).limit(1)
      : [null];

    const learner = await getOptionalAuthorizedLearner(req);
    if (learner && !canLearnerAccessCourseEnvironment(learner, programme?.environment)) {
      return res.status(403).json({
        error: 'This lesson is outside the age environment permitted for the active learner profile.',
      });
    }

    const lessonActivities = await db
      .select()
      .from(activities)
      .where(eq(activities.lessonId, lesson.id))
      .orderBy(asc(activities.sortOrder));

    return res.json({ lesson, module: mod, course, activities: lessonActivities });
  } catch {
    return res.status(500).json({ error: 'Unable to load lesson.' });
  }
});

router.post('/activities/:id/attempt', requireAuth, async (req: AuthRequest, res) => {
  try {
    const activityId = parsePositiveInt(req.params.id);
    if (!activityId) return res.status(400).json({ error: 'Invalid activity ID.' });

    const parsed = attemptSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid activity answer.' });
    }

    const [activity] = await db.select().from(activities).where(eq(activities.id, activityId)).limit(1);
    if (!activity) return res.status(404).json({ error: 'Activity not found.' });

    const access = await resolveAuthorizedLearner(req.authUser!, parsed.data.learnerId, {
      requireGuardianConsentForChild: true,
    });
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const { learner } = access;

    // Enforce age-tier curriculum boundary on activity attempts
    const [lessonRow] = await db.select().from(lessons).where(eq(lessons.id, activity.lessonId)).limit(1);
    const [modRow] = lessonRow
      ? await db.select().from(modules).where(eq(modules.id, lessonRow.moduleId)).limit(1)
      : [null];
    const [courseRow] = modRow
      ? await db.select().from(courses).where(eq(courses.id, modRow.courseId)).limit(1)
      : [null];
    const [progRow] = courseRow
      ? await db.select().from(programmes).where(eq(programmes.id, courseRow.programmeId)).limit(1)
      : [null];
    if (!canLearnerAccessCourseEnvironment(learner, progRow?.environment)) {
      return res.status(403).json({ error: 'This activity is outside your permitted learning environment.' });
    }

    const clientAttemptId = parsed.data.clientAttemptId;
    if (clientAttemptId) {
      const [existingAttempt] = await db
        .select()
        .from(learningAttempts)
        .where(
          and(
            eq(learningAttempts.learnerId, learner.id),
            eq(learningAttempts.activityId, activity.id),
            eq(learningAttempts.clientAttemptId, clientAttemptId)
          )
        )
        .limit(1);

      if (existingAttempt) {
        return res.json({
          alreadyProcessed: true,
          isCorrect: existingAttempt.isCorrect,
          score: existingAttempt.score,
          xpAwarded: 0,
          alreadyMastered: existingAttempt.isCorrect,
          feedback: existingAttempt.feedback,
        });
      }
    }

    const answer = parsed.data.answer;
    const payload = activity.payloadJson as Record<string, any>;
    let isCorrect = false;
    let feedback = '';

    if (['writing', 'conversation_sim', 'role_play'].includes(activity.type)) {
      let limited = false;
      aiActivityLimiter(req, res, () => {
        limited = false;
      });
      if (res.headersSent) return;
      void limited;
    }

    switch (activity.type) {
      case 'multiple_choice':
      case 'listen_select':
      case 'story_comprehension': {
        isCorrect = String(answer || '').trim() === String(payload.correctAnswer || '').trim();
        feedback = isCorrect
          ? 'Spot on! You chose the clearest, most natural response.'
          : `Not quite yet — the expected answer was "${payload.correctAnswer}".`;
        break;
      }
      case 'picture_recognition': {
        isCorrect = String(answer || '') === String(payload.correctId || '');
        feedback = isCorrect
          ? 'Wonderful! You matched the sound and picture.'
          : 'Try listening again and tapping the matching picture.';
        break;
      }
      case 'fill_blanks':
      case 'spelling': {
        const expected = String(payload.blankAnswer || payload.correctAnswer || '').trim().toLowerCase();
        isCorrect = String(answer || '').trim().toLowerCase() === expected;
        feedback = isCorrect
          ? 'Accurate spelling and word choice!'
          : `Check your spelling — hint: ${payload.hint || expected}.`;
        break;
      }
      case 'grammar_correction': {
        const acceptable = Array.isArray(payload.acceptableAnswers)
          ? payload.acceptableAnswers.map((a: string) => a.trim().toLowerCase())
          : [String(payload.correctAnswer || '').trim().toLowerCase()];
        isCorrect = acceptable.includes(String(answer || '').trim().toLowerCase());
        feedback = isCorrect
          ? 'Clean grammar! Subject and verb agree smoothly.'
          : `Compare with: "${payload.correctAnswer}"`;
        break;
      }
      case 'sentence_building': {
        const expectedSentence = (payload.words || []).join(' ').trim();
        const userSentence = Array.isArray(answer) ? answer.join(' ').trim() : String(answer || '').trim();
        isCorrect = userSentence.toLowerCase() === expectedSentence.toLowerCase();
        feedback = isCorrect
          ? 'Great word order! That sounds natural.'
          : `Expected order: "${expectedSentence}"`;
        break;
      }
      case 'word_matching': {
        const pairs = (payload.pairs || []) as { left: string; right: string }[];
        const userPairs = (typeof answer === 'object' && !Array.isArray(answer) ? answer : {}) as Record<
          string,
          string
        >;
        const matchedAll = pairs.length > 0 && pairs.every((p) => userPairs[p.left] === p.right);
        isCorrect = matchedAll;
        feedback = isCorrect
          ? 'All pairs matched accurately!'
          : 'Some pairs do not match yet. Check each clue carefully.';
        break;
      }
      case 'listen_repeat':
      case 'read_aloud':
      case 'voice_recording': {
        const transcript = String(answer || '').trim();
        const target = String(payload.targetText || '');
        if (!transcript) {
          isCorrect = false;
          feedback = 'No spoken or typed response was received. Try recording again.';
        } else if (target) {
          const { matchedRatio } = compareTranscriptWords(target, transcript);
          isCorrect = matchedRatio >= 0.6;
          feedback = isCorrect
            ? `Clear spoken practice! Transcript matched ${Math.round(matchedRatio * 100)}% of target words.`
            : `Good effort! Transcript captured: "${transcript}". Listen once more to the reference phrase.`;
        } else {
          isCorrect = transcript.length > 3;
          feedback = 'Voice practice recorded! Keep building speaking rhythm.';
        }
        break;
      }
      case 'writing':
      case 'conversation_sim':
      case 'role_play': {
        const textResp = String(answer || '').trim();
        const minWords = Number(payload.minWords || 5);
        const wordCount = textResp.split(/\s+/).filter(Boolean).length;
        isCorrect = wordCount >= minWords;
        if (isCorrect) {
          const evalResult = await voiceProvider.evaluateActivityAnswer(
            activity.prompt,
            textResp,
            learner.environment,
            learner.cefrLevel
          );
          feedback = `${evalResult.feedback} ${evalResult.suggestions[0] || ''}`.trim();
        } else {
          feedback = `Try writing or speaking at least ${minWords} words so you can express a complete idea.`;
        }
        break;
      }
      default:
        isCorrect = Boolean(answer);
        feedback = 'Response recorded.';
    }

    const score = isCorrect ? activity.points : Math.round(activity.points * 0.25);

    const txResult = await db.transaction(async (tx) => {
      // Serialize concurrent attempts for the same learner to prevent XP race conditions
      await tx.execute(
        sql`SELECT id FROM learner_profiles WHERE id = ${learner.id} FOR UPDATE`
      );

      const priorMastered = await tx
        .select({ id: learningAttempts.id })
        .from(learningAttempts)
        .where(
          and(
            eq(learningAttempts.learnerId, learner.id),
            eq(learningAttempts.activityId, activity.id),
            eq(learningAttempts.isCorrect, true)
          )
        )
        .limit(1);

      const alreadyMastered = priorMastered.length > 0;
      const xpAwarded = isCorrect && !alreadyMastered ? activity.points : 0;

      if (clientAttemptId) {
        const inserted = await tx
          .insert(learningAttempts)
          .values({
            learnerId: learner.id,
            lessonId: activity.lessonId,
            activityId: activity.id,
            clientAttemptId,
            answerJson: { answer, clientAttemptId },
            isCorrect,
            score,
            xpAwarded,
            feedback,
          })
          .onConflictDoNothing({
            target: [
              learningAttempts.learnerId,
              learningAttempts.activityId,
              learningAttempts.clientAttemptId,
            ],
          })
          .returning();

        if (inserted.length === 0) {
          const [existing] = await tx
            .select()
            .from(learningAttempts)
            .where(
              and(
                eq(learningAttempts.learnerId, learner.id),
                eq(learningAttempts.activityId, activity.id),
                eq(learningAttempts.clientAttemptId, clientAttemptId)
              )
            )
            .limit(1);

          return {
            alreadyProcessed: true,
            isCorrect: existing?.isCorrect ?? isCorrect,
            score: existing?.score ?? score,
            xpAwarded: 0,
            alreadyMastered: existing?.isCorrect ?? alreadyMastered,
            feedback: existing?.feedback ?? feedback,
          };
        }
      } else {
        await tx.insert(learningAttempts).values({
          learnerId: learner.id,
          lessonId: activity.lessonId,
          activityId: activity.id,
          clientAttemptId: null,
          answerJson: { answer },
          isCorrect,
          score,
          xpAwarded,
          feedback,
        });
      }

      if (xpAwarded > 0) {
        await awardXpAtomically(tx, learner.id, xpAwarded);
      }

      return {
        alreadyProcessed: false,
        isCorrect,
        score,
        xpAwarded,
        alreadyMastered,
        feedback,
      };
    });

    return res.json({
      ...(txResult.alreadyProcessed ? { alreadyProcessed: true } : {}),
      isCorrect: txResult.isCorrect,
      score: txResult.score,
      xpAwarded: txResult.xpAwarded,
      alreadyMastered: txResult.alreadyMastered,
      feedback: txResult.feedback,
    });
  } catch {
    return res.status(500).json({ error: 'Unable to evaluate activity.' });
  }
});

router.post('/lessons/:id/complete', requireAuth, async (req: AuthRequest, res) => {
  try {
    const lessonId = parsePositiveInt(req.params.id);
    if (!lessonId) return res.status(400).json({ error: 'Invalid lesson ID.' });

    const parsed = completeLessonSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid completion request.' });
    }

    const access = await resolveAuthorizedLearner(req.authUser!, parsed.data.learnerId, {
      requireGuardianConsentForChild: true,
    });
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const { learner } = access;

    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });

    const [modRow] = await db.select().from(modules).where(eq(modules.id, lesson.moduleId)).limit(1);
    const [courseRow] = modRow
      ? await db.select().from(courses).where(eq(courses.id, modRow.courseId)).limit(1)
      : [null];
    const [progRow] = courseRow
      ? await db.select().from(programmes).where(eq(programmes.id, courseRow.programmeId)).limit(1)
      : [null];
    if (!canLearnerAccessCourseEnvironment(learner, progRow?.environment)) {
      return res.status(403).json({ error: 'This lesson is outside your permitted learning environment.' });
    }

    const lessonActivities = await db
      .select()
      .from(activities)
      .where(eq(activities.lessonId, lesson.id));

    const learnerAttempts = await db
      .select()
      .from(learningAttempts)
      .where(
        and(eq(learningAttempts.learnerId, learner.id), eq(learningAttempts.lessonId, lesson.id))
      );

    // Server-side verification: every lesson activity must have at least one real recorded attempt.
    if (lessonActivities.length > 0) {
      const attemptedIds = new Set(
        learnerAttempts.map((a) => a.activityId).filter((id): id is number => id !== null)
      );
      const missingActivityIds = lessonActivities
        .filter((act) => !attemptedIds.has(act.id))
        .map((act) => act.id);

      if (missingActivityIds.length > 0) {
        return res.status(400).json({
          error: 'Please attempt all activities in this lesson before marking it complete.',
          missingActivityIds,
        });
      }
    }

    // Compute score server-side from actual best recorded attempts per activity.
    let serverScore = 100;
    if (lessonActivities.length > 0) {
      const bestScoreByActivity = new Map<number, number>();
      for (const att of learnerAttempts) {
        if (!att.activityId) continue;
        const prev = bestScoreByActivity.get(att.activityId) ?? 0;
        if (att.score > prev) bestScoreByActivity.set(att.activityId, att.score);
      }
      const totalPossible = lessonActivities.reduce((sum, a) => sum + Math.max(1, a.points), 0);
      const totalBest = lessonActivities.reduce(
        (sum, a) => sum + Math.min(a.points, bestScoreByActivity.get(a.id) ?? 0),
        0
      );
      serverScore = Math.max(0, Math.min(100, Math.round((totalBest / totalPossible) * 100)));
    }

    const maxReasonableMinutes = Math.max(lesson.durationMinutes * 3, 60);
    const minutesSpent = Math.min(
      maxReasonableMinutes,
      Math.max(1, Math.round(parsed.data.minutesSpent ?? lesson.durationMinutes))
    );

    const completionResult = await db.transaction(async (tx) => {
      const [freshLearner] = await tx
        .select()
        .from(learnerProfiles)
        .where(eq(learnerProfiles.id, learner.id))
        .limit(1);

      const [existingProgress] = await tx
        .select()
        .from(learnerProgress)
        .where(
          and(eq(learnerProgress.learnerId, learner.id), eq(learnerProgress.lessonId, lesson.id))
        )
        .limit(1);

      const alreadyAwardedLessonXp = (existingProgress?.xpAwarded ?? 0) > 0;
      const xpEarned = alreadyAwardedLessonXp ? 0 : 40;
      const finalXpAwarded = alreadyAwardedLessonXp ? existingProgress!.xpAwarded : xpEarned;

      await tx
        .insert(learnerProgress)
        .values({
          learnerId: learner.id,
          lessonId: lesson.id,
          status: 'completed',
          score: serverScore,
          xpAwarded: finalXpAwarded,
          minutesSpent,
          completedAt: new Date(),
          updatedAt: new Date(),
        })
        .onConflictDoUpdate({
          target: [learnerProgress.learnerId, learnerProgress.lessonId],
          set: {
            status: 'completed',
            score: serverScore,
            xpAwarded: finalXpAwarded,
            minutesSpent,
            completedAt: existingProgress?.completedAt ?? new Date(),
            updatedAt: new Date(),
          },
        });

      const today = new Date().toISOString().slice(0, 10);
      let newStreak = freshLearner?.streakDays ?? learner.streakDays;
      if (freshLearner?.lastPracticeDate !== today) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        newStreak =
          freshLearner?.lastPracticeDate === yesterday ? (freshLearner?.streakDays || 0) + 1 : 1;
      }

      await tx
        .update(learnerProfiles)
        .set({
          xp: sql`${learnerProfiles.xp} + ${xpEarned}`,
          streakDays: newStreak,
          lastPracticeDate: today,
          updatedAt: new Date(),
        })
        .where(eq(learnerProfiles.id, learner.id));

      const newlyEarned = await checkAndAwardAchievements(tx, learner.id);
      return {
        xpEarned,
        alreadyCompleted: alreadyAwardedLessonXp,
        streakDays: newStreak,
        newlyEarned,
      };
    });

    return res.json({
      completed: true,
      score: serverScore,
      xpEarned: completionResult.xpEarned,
      alreadyCompleted: completionResult.alreadyCompleted,
      streakDays: completionResult.streakDays,
      newlyEarnedAchievements: completionResult.newlyEarned,
    });
  } catch {
    return res.status(500).json({ error: 'Unable to save lesson completion.' });
  }
});

router.get('/dashboard', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const access = await resolveAuthorizedLearner(req.authUser!, req.query.learnerId);
    if (!access.ok) {
      const hasRequestedId =
        req.query.learnerId !== undefined &&
        req.query.learnerId !== null &&
        req.query.learnerId !== '';
      if (!hasRequestedId && access.status === 404) {
        return res.json({ learner: null, courses: [], progress: [], achievements: [], recentActivity: [] });
      }
      return res.status(access.status).json({ error: access.error });
    }
    const { learner, parent } = access;

    const allProgrammes = await db.select().from(programmes);
    const allCourses = await db.select().from(courses).orderBy(asc(courses.sortOrder));
    const allLessons = await db.select().from(lessons).orderBy(asc(lessons.sortOrder));
    const allModules = await db.select().from(modules);

    const progById = new Map(allProgrammes.map((p) => [p.id, p]));
    const matchingCourses = allCourses
      .filter((c) => progById.get(c.programmeId)?.environment === learner.environment)
      .map((c) => ({ ...c, programme: progById.get(c.programmeId) }));

    const recommendedCourses =
      matchingCourses.length > 0
        ? matchingCourses
        : allCourses
            .filter((c) => canLearnerAccessCourseEnvironment(learner, progById.get(c.programmeId)?.environment))
            .map((c) => ({ ...c, programme: progById.get(c.programmeId) }))
            .slice(0, 3);

    const progressRows = await db
      .select()
      .from(learnerProgress)
      .where(eq(learnerProgress.learnerId, learner.id))
      .orderBy(desc(learnerProgress.updatedAt));

    const completedLessonIds = new Set(
      progressRows.filter((p) => p.status === 'completed').map((p) => p.lessonId)
    );

    const earned = await db
      .select()
      .from(learnerAchievements)
      .where(eq(learnerAchievements.learnerId, learner.id));
    const allAchievements = await db.select().from(achievements);
    const earnedSet = new Set(earned.map((e) => e.achievementId));

    const allowTranscripts = shouldStoreTranscripts(learner, parent);
    const voiceHistoryRaw = await db
      .select()
      .from(voicePracticeSessions)
      .where(eq(voicePracticeSessions.learnerId, learner.id))
      .orderBy(desc(voicePracticeSessions.createdAt))
      .limit(5);

    const voiceHistory = allowTranscripts
      ? voiceHistoryRaw
      : voiceHistoryRaw.map((v) => ({ ...v, transcript: null }));

    const [goal] = await db
      .select()
      .from(learningGoals)
      .where(eq(learningGoals.learnerId, learner.id))
      .limit(1);

    const recommendedLessons = allLessons
      .filter((l) => {
        const mod = allModules.find((m) => m.id === l.moduleId);
        const course = recommendedCourses.find((c) => c.id === mod?.courseId);
        return Boolean(course);
      })
      .map((l) => ({
        ...l,
        completed: completedLessonIds.has(l.id),
      }));

    return res.json({
      learner,
      goal: goal || null,
      recommendedCourses,
      recommendedLessons,
      progress: progressRows,
      completedLessonsCount: completedLessonIds.size,
      totalLessonsCount: recommendedLessons.length,
      achievements: allAchievements.map((a) => ({
        ...a,
        earned: earnedSet.has(a.id),
      })),
      recentVoiceSessions: voiceHistory,
    });
  } catch {
    return res.status(500).json({ error: 'Unable to load learning dashboard.' });
  }
});

router.get('/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const access = await resolveAuthorizedLearner(req.authUser!, req.query.learnerId);
    if (!access.ok) {
      const hasRequestedId =
        req.query.learnerId !== undefined &&
        req.query.learnerId !== null &&
        req.query.learnerId !== '';
      if (!hasRequestedId && access.status === 404) {
        return res.json({ attempts: [], progress: [], voiceSessions: [], conversations: [] });
      }
      return res.status(access.status).json({ error: access.error });
    }
    const { learner, parent } = access;
    const allowTranscripts = shouldStoreTranscripts(learner, parent);

    const attempts = await db
      .select()
      .from(learningAttempts)
      .where(eq(learningAttempts.learnerId, learner.id))
      .orderBy(desc(learningAttempts.createdAt))
      .limit(20);

    const progress = await db
      .select()
      .from(learnerProgress)
      .where(eq(learnerProgress.learnerId, learner.id))
      .orderBy(desc(learnerProgress.updatedAt));

    const voiceSessionsRaw = await db
      .select()
      .from(voicePracticeSessions)
      .where(eq(voicePracticeSessions.learnerId, learner.id))
      .orderBy(desc(voicePracticeSessions.createdAt))
      .limit(20);

    const conversationsRaw = await db
      .select()
      .from(conversationSessions)
      .where(eq(conversationSessions.learnerId, learner.id))
      .orderBy(desc(conversationSessions.createdAt))
      .limit(20);

    return res.json({
      attempts,
      progress,
      voiceSessions: allowTranscripts
        ? voiceSessionsRaw
        : voiceSessionsRaw.map((v) => ({ ...v, transcript: null })),
      conversations: allowTranscripts
        ? conversationsRaw
        : conversationsRaw.map((c) => ({ ...c, transcriptJson: [] })),
    });
  } catch {
    return res.status(500).json({ error: 'Unable to load learning history.' });
  }
});

router.patch('/settings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const parsed = settingsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.issues[0]?.message || 'Invalid learner settings.' });
    }

    const access = await resolveAuthorizedLearner(req.authUser!, parsed.data.learnerId, {
      requireGuardianConsentForChild: true,
    });
    if (!access.ok) return res.status(access.status).json({ error: access.error });
    const { learner, isParentActingForChild } = access;

    let nextEnvironment = learner.environment;
    let nextAgeRange = learner.ageRange;

    if (parsed.data.environment && parsed.data.environment !== learner.environment) {
      const transition = validateEnvironmentTransition(learner, parsed.data.environment, {
        isParentActingForChild,
        isAdmin: req.authUser!.role === 'ADMIN',
      });
      if (!transition.allowed) {
        return res.status(403).json({ error: transition.error });
      }
      nextEnvironment = parsed.data.environment;
      nextAgeRange = defaultAgeRangeForEnvironment(nextEnvironment);
    }

    const [updated] = await db
      .update(learnerProfiles)
      .set({
        displayName: parsed.data.displayName || learner.displayName,
        environment: nextEnvironment,
        ageRange: nextAgeRange,
        cefrLevel: parsed.data.cefrLevel || learner.cefrLevel,
        dailyGoalMinutes: parsed.data.dailyGoalMinutes ?? learner.dailyGoalMinutes,
        voicePreferences: parsed.data.voicePreferences || learner.voicePreferences,
        updatedAt: new Date(),
      })
      .where(eq(learnerProfiles.id, learner.id))
      .returning();

    return res.json({ learnerProfile: updated });
  } catch {
    return res.status(500).json({ error: 'Unable to update learner settings.' });
  }
});

export default router;
