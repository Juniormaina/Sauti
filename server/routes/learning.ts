import { Router } from 'express';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
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
import { AuthRequest, requireAuth } from '../middleware/auth.ts';
import { ensureSeeded } from '../services/seedService.ts';
import { compareTranscriptWords, voiceProvider } from '../services/aiVoiceService.ts';

const router = Router();

async function getLearnerForUser(userId: number, activeChildId?: number) {
  if (activeChildId) {
    const [child] = await db
      .select()
      .from(learnerProfiles)
      .where(eq(learnerProfiles.id, activeChildId))
      .limit(1);
    if (child) return child;
  }
  const [learner] = await db
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.userId, userId))
    .limit(1);
  return learner || null;
}

async function checkAndAwardAchievements(learnerId: number) {
  const allAchievements = await db.select().from(achievements);
  const existing = await db
    .select()
    .from(learnerAchievements)
    .where(eq(learnerAchievements.learnerId, learnerId));
  const earnedIds = new Set(existing.map((e) => e.achievementId));

  const completedLessons = await db
    .select()
    .from(learnerProgress)
    .where(and(eq(learnerProgress.learnerId, learnerId), eq(learnerProgress.status, 'completed')));

  const voiceCount = await db
    .select()
    .from(voicePracticeSessions)
    .where(eq(voicePracticeSessions.learnerId, learnerId));

  const convCount = await db
    .select()
    .from(conversationSessions)
    .where(eq(conversationSessions.learnerId, learnerId));

  const [learner] = await db
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.id, learnerId))
    .limit(1);

  const newlyEarned: string[] = [];

  for (const ach of allAchievements) {
    if (earnedIds.has(ach.id)) continue;
    let qualifies = false;
    if (ach.code === 'FIRST_LESSON' && completedLessons.length >= 1) qualifies = true;
    if (ach.code === 'FIVE_LESSONS' && completedLessons.length >= 5) qualifies = true;
    if (ach.code === 'VOICE_PIONEER' && voiceCount.length >= 1) qualifies = true;
    if (ach.code === 'CONVERSATION_BUILDER' && convCount.length >= 1) qualifies = true;
    if (ach.code === 'STREAK_THREE' && (learner?.streakDays || 0) >= 3) qualifies = true;

    if (qualifies) {
      await db.insert(learnerAchievements).values({ learnerId, achievementId: ach.id }).onConflictDoNothing();
      if (learner) {
        await db
          .update(learnerProfiles)
          .set({ xp: learner.xp + ach.xpReward })
          .where(eq(learnerProfiles.id, learnerId));
      }
      newlyEarned.push(ach.title);
    }
  }
  return newlyEarned;
}

router.get('/programmes', async (_req, res) => {
  try {
    await ensureSeeded();
    const rows = await db.select().from(programmes).orderBy(asc(programmes.sortOrder));
    return res.json({ programmes: rows });
  } catch (err: any) {
    console.error('Programmes fetch error:', err);
    return res.status(500).json({ error: 'Unable to load programmes.' });
  }
});

router.get('/courses', async (req, res) => {
  try {
    await ensureSeeded();
    const { environment, cefrLevel, topic, skillFocus, maxMinutes } = req.query;

    const allProgrammes = await db.select().from(programmes).orderBy(asc(programmes.sortOrder));
    const allCourses = await db.select().from(courses).orderBy(asc(courses.sortOrder));
    const progMap = new Map(allProgrammes.map((p) => [p.id, p]));

    let filtered = allCourses
      .filter((c) => c.isPublished)
      .map((c) => ({
        ...c,
        programme: progMap.get(c.programmeId) || null,
      }));

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
  } catch (err: any) {
    console.error('Courses fetch error:', err);
    return res.status(500).json({ error: 'Unable to load courses.' });
  }
});

router.get('/courses/:id', async (req, res) => {
  try {
    await ensureSeeded();
    const courseId = Number(req.params.id);
    if (Number.isNaN(courseId)) return res.status(400).json({ error: 'Invalid course ID.' });

    const [course] = await db.select().from(courses).where(eq(courses.id, courseId)).limit(1);
    if (!course) return res.status(404).json({ error: 'Course not found.' });

    const [programme] = await db.select().from(programmes).where(eq(programmes.id, course.programmeId)).limit(1);
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
  } catch (err: any) {
    console.error('Course detail error:', err);
    return res.status(500).json({ error: 'Unable to load course details.' });
  }
});

router.get('/modules/:id', async (req, res) => {
  try {
    await ensureSeeded();
    const moduleId = Number(req.params.id);
    if (Number.isNaN(moduleId)) return res.status(400).json({ error: 'Invalid module ID.' });

    const [mod] = await db.select().from(modules).where(eq(modules.id, moduleId)).limit(1);
    if (!mod) return res.status(404).json({ error: 'Module not found.' });

    const [course] = await db.select().from(courses).where(eq(courses.id, mod.courseId)).limit(1);
    const modLessons = await db
      .select()
      .from(lessons)
      .where(eq(lessons.moduleId, mod.id))
      .orderBy(asc(lessons.sortOrder));

    return res.json({ module: mod, course, lessons: modLessons });
  } catch (err: any) {
    console.error('Module detail error:', err);
    return res.status(500).json({ error: 'Unable to load module.' });
  }
});

router.get('/lessons/:id', async (req, res) => {
  try {
    await ensureSeeded();
    const lessonId = Number(req.params.id);
    if (Number.isNaN(lessonId)) return res.status(400).json({ error: 'Invalid lesson ID.' });

    const [lesson] = await db.select().from(lessons).where(eq(lessons.id, lessonId)).limit(1);
    if (!lesson) return res.status(404).json({ error: 'Lesson not found.' });

    const [mod] = await db.select().from(modules).where(eq(modules.id, lesson.moduleId)).limit(1);
    const [course] = mod ? await db.select().from(courses).where(eq(courses.id, mod.courseId)).limit(1) : [null];
    const lessonActivities = await db
      .select()
      .from(activities)
      .where(eq(activities.lessonId, lesson.id))
      .orderBy(asc(activities.sortOrder));

    return res.json({ lesson, module: mod, course, activities: lessonActivities });
  } catch (err: any) {
    console.error('Lesson detail error:', err);
    return res.status(500).json({ error: 'Unable to load lesson.' });
  }
});

router.post('/activities/:id/attempt', requireAuth, async (req: AuthRequest, res) => {
  try {
    const activityId = Number(req.params.id);
    const [activity] = await db.select().from(activities).where(eq(activities.id, activityId)).limit(1);
    if (!activity) return res.status(404).json({ error: 'Activity not found.' });

    const learner = await getLearnerForUser(req.authUser!.id, Number(req.body?.learnerId) || undefined);
    if (!learner) return res.status(404).json({ error: 'Learner profile not found.' });

    const answer = req.body?.answer;
    const payload = activity.payloadJson as Record<string, any>;
    let isCorrect = false;
    let feedback = '';

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
        const userPairs = (answer || {}) as Record<string, string>;
        const matchedAll = pairs.every((p) => userPairs[p.left] === p.right);
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

    await db.insert(learningAttempts).values({
      learnerId: learner.id,
      lessonId: activity.lessonId,
      activityId: activity.id,
      answerJson: { answer },
      isCorrect,
      score,
      feedback,
    });

    if (isCorrect) {
      await db
        .update(learnerProfiles)
        .set({ xp: learner.xp + score, updatedAt: new Date() })
        .where(eq(learnerProfiles.id, learner.id));
    }

    return res.json({ isCorrect, score, feedback });
  } catch (err: any) {
    console.error('Activity attempt error:', err);
    return res.status(500).json({ error: 'Unable to evaluate activity.' });
  }
});

router.post('/lessons/:id/complete', requireAuth, async (req: AuthRequest, res) => {
  try {
    const lessonId = Number(req.params.id);
    const learner = await getLearnerForUser(req.authUser!.id, Number(req.body?.learnerId) || undefined);
    if (!learner) return res.status(404).json({ error: 'Learner profile not found.' });

    const score = Number(req.body?.score || 100);
    const minutesSpent = Number(req.body?.minutesSpent || 10);

    await db
      .insert(learnerProgress)
      .values({
        learnerId: learner.id,
        lessonId,
        status: 'completed',
        score,
        minutesSpent,
        completedAt: new Date(),
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: [learnerProgress.learnerId, learnerProgress.lessonId],
        set: {
          status: 'completed',
          score,
          minutesSpent,
          completedAt: new Date(),
          updatedAt: new Date(),
        },
      });

    const today = new Date().toISOString().slice(0, 10);
    let newStreak = learner.streakDays;
    if (learner.lastPracticeDate !== today) {
      const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
      newStreak = learner.lastPracticeDate === yesterday ? learner.streakDays + 1 : 1;
    }

    await db
      .update(learnerProfiles)
      .set({
        xp: learner.xp + 40,
        streakDays: newStreak,
        lastPracticeDate: today,
        updatedAt: new Date(),
      })
      .where(eq(learnerProfiles.id, learner.id));

    const newlyEarned = await checkAndAwardAchievements(learner.id);
    return res.json({
      completed: true,
      xpEarned: 40,
      streakDays: newStreak,
      newlyEarnedAchievements: newlyEarned,
    });
  } catch (err: any) {
    console.error('Lesson completion error:', err);
    return res.status(500).json({ error: 'Unable to save lesson completion.' });
  }
});

router.get('/dashboard', requireAuth, async (req: AuthRequest, res) => {
  try {
    await ensureSeeded();
    const learner = await getLearnerForUser(req.authUser!.id, Number(req.query.learnerId) || undefined);
    if (!learner) {
      return res.json({ learner: null, courses: [], progress: [], achievements: [], recentActivity: [] });
    }

    const allProgrammes = await db.select().from(programmes);
    const allCourses = await db.select().from(courses).orderBy(asc(courses.sortOrder));
    const allLessons = await db.select().from(lessons).orderBy(asc(lessons.sortOrder));
    const allModules = await db.select().from(modules);

    const progById = new Map(allProgrammes.map((p) => [p.id, p]));
    const matchingCourses = allCourses
      .filter((c) => progById.get(c.programmeId)?.environment === learner.environment)
      .map((c) => ({ ...c, programme: progById.get(c.programmeId) }));

    const recommendedCourses = matchingCourses.length > 0 ? matchingCourses : allCourses.slice(0, 3);

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

    const voiceHistory = await db
      .select()
      .from(voicePracticeSessions)
      .where(eq(voicePracticeSessions.learnerId, learner.id))
      .orderBy(desc(voicePracticeSessions.createdAt))
      .limit(5);

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
  } catch (err: any) {
    console.error('Dashboard fetch error:', err);
    return res.status(500).json({ error: 'Unable to load learning dashboard.' });
  }
});

router.get('/history', requireAuth, async (req: AuthRequest, res) => {
  try {
    const learner = await getLearnerForUser(req.authUser!.id);
    if (!learner) return res.json({ attempts: [], progress: [], voiceSessions: [], conversations: [] });

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

    const voiceSessions = await db
      .select()
      .from(voicePracticeSessions)
      .where(eq(voicePracticeSessions.learnerId, learner.id))
      .orderBy(desc(voicePracticeSessions.createdAt))
      .limit(20);

    const conversations = await db
      .select()
      .from(conversationSessions)
      .where(eq(conversationSessions.learnerId, learner.id))
      .orderBy(desc(conversationSessions.createdAt))
      .limit(20);

    return res.json({ attempts, progress, voiceSessions, conversations });
  } catch (err: any) {
    console.error('History fetch error:', err);
    return res.status(500).json({ error: 'Unable to load learning history.' });
  }
});

router.patch('/settings', requireAuth, async (req: AuthRequest, res) => {
  try {
    const learner = await getLearnerForUser(req.authUser!.id);
    if (!learner) return res.status(404).json({ error: 'Learner profile not found.' });

    const {
      displayName,
      environment,
      cefrLevel,
      dailyGoalMinutes,
      voicePreferences,
    } = req.body || {};

    const [updated] = await db
      .update(learnerProfiles)
      .set({
        displayName: displayName || learner.displayName,
        environment: environment || learner.environment,
        cefrLevel: cefrLevel || learner.cefrLevel,
        dailyGoalMinutes: dailyGoalMinutes ? Number(dailyGoalMinutes) : learner.dailyGoalMinutes,
        voicePreferences: voicePreferences || learner.voicePreferences,
        updatedAt: new Date(),
      })
      .where(eq(learnerProfiles.id, learner.id))
      .returning();

    return res.json({ learnerProfile: updated });
  } catch (err: any) {
    console.error('Settings update error:', err);
    return res.status(500).json({ error: 'Unable to update learner settings.' });
  }
});

export default router;
