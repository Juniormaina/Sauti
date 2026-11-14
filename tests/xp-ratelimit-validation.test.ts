import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import {
  activities,
  courses,
  learnerProfiles,
  lessons,
  modules,
  programmes,
  users,
} from '../src/db/schema.ts';
import { createSautiApp } from '../server/app.ts';
import { ensureSeeded } from '../server/services/seedService.ts';

let server: http.Server;
let baseUrl = '';

const createdUserIds: number[] = [];
let learnerToken = '';
let learnerId = 0;
let targetLessonId = 0;
let lessonActivities: (typeof activities.$inferSelect)[] = [];

async function jsonReq(path: string, options: RequestInit = {}, token?: string) {
  const headers = new Headers(options.headers || {});
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  if (token) headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(`${baseUrl}${path}`, { ...options, headers });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body };
}

function getCorrectAnswer(act: typeof activities.$inferSelect): unknown {
  const payload = act.payloadJson as Record<string, any>;
  switch (act.type) {
    case 'multiple_choice':
    case 'listen_select':
    case 'story_comprehension':
      return payload.correctAnswer;
    case 'picture_recognition':
      return payload.correctId;
    case 'fill_blanks':
    case 'spelling':
      return payload.blankAnswer || payload.correctAnswer;
    case 'grammar_correction':
      return Array.isArray(payload.acceptableAnswers)
        ? payload.acceptableAnswers[0]
        : payload.correctAnswer;
    case 'sentence_building':
      return payload.words || [];
    case 'word_matching': {
      const pairs: Record<string, string> = {};
      for (const p of payload.pairs || []) {
        pairs[p.left] = p.right;
      }
      return pairs;
    }
    case 'listen_repeat':
    case 'read_aloud':
    case 'voice_recording':
      return payload.targetText || 'Good morning';
    default:
      return 'I really enjoy practising spoken English every morning with calm confidence.';
  }
}

before(async () => {
  await ensureSeeded();
  const app = createSautiApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;

  const suffix = crypto.randomBytes(4).toString('hex');
  const reg = await jsonReq('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `xp-test-${suffix}@test.local`,
      password: 'Password123!',
      displayName: 'XP Tester',
      accountType: 'individual',
      environment: 'young_adults',
    }),
  });
  assert.equal(reg.status, 201);
  learnerToken = reg.body.token;
  learnerId = reg.body.learnerProfile.id;
  createdUserIds.push(reg.body.user.id);

  // Pick a lesson belonging to young_adults with deterministic non-AI activities if possible
  const [yaProg] = await db
    .select()
    .from(programmes)
    .where(eq(programmes.environment, 'young_adults'))
    .limit(1);
  const [yaCourse] = await db
    .select()
    .from(courses)
    .where(eq(courses.programmeId, yaProg.id))
    .limit(1);
  const [yaMod] = await db
    .select()
    .from(modules)
    .where(eq(modules.courseId, yaCourse.id))
    .limit(1);
  const [yaLesson] = await db
    .select()
    .from(lessons)
    .where(eq(lessons.moduleId, yaMod.id))
    .limit(1);
  assert.ok(yaLesson);
  targetLessonId = yaLesson.id;

  lessonActivities = await db
    .select()
    .from(activities)
    .where(eq(activities.lessonId, targetLessonId));
  assert.ok(lessonActivities.length > 0);
});

after(async () => {
  if (createdUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('Priority 6: Server-verified lesson completion, anti-farming XP, and atomic achievements', async () => {
  // 1. Completing lesson before attempting activities is rejected
  const prematureComplete = await jsonReq(
    `/api/learning/lessons/${targetLessonId}/complete`,
    {
      method: 'POST',
      body: JSON.stringify({ score: 100, minutesSpent: 15 }),
    },
    learnerToken
  );
  assert.equal(prematureComplete.status, 400);
  assert.ok(Array.isArray(prematureComplete.body.missingActivityIds));

  // 2. Submit all lesson activities; repeat first correct activity to prove zero duplicate XP
  const firstAct = lessonActivities[0];
  const correct1 = await jsonReq(
    `/api/learning/activities/${firstAct.id}/attempt`,
    {
      method: 'POST',
      body: JSON.stringify({ answer: getCorrectAnswer(firstAct) }),
    },
    learnerToken
  );
  assert.equal(correct1.status, 200);
  assert.equal(correct1.body.isCorrect, true);
  assert.equal(correct1.body.xpAwarded, firstAct.points);

  const correctRepeat = await jsonReq(
    `/api/learning/activities/${firstAct.id}/attempt`,
    {
      method: 'POST',
      body: JSON.stringify({ answer: getCorrectAnswer(firstAct) }),
    },
    learnerToken
  );
  assert.equal(correctRepeat.status, 200);
  assert.equal(correctRepeat.body.isCorrect, true);
  assert.equal(correctRepeat.body.alreadyMastered, true);
  assert.equal(correctRepeat.body.xpAwarded, 0);

  let expectedActivityXp = firstAct.points;
  for (const act of lessonActivities.slice(1)) {
    const res = await jsonReq(
      `/api/learning/activities/${act.id}/attempt`,
      {
        method: 'POST',
        body: JSON.stringify({ answer: getCorrectAnswer(act) }),
      },
      learnerToken
    );
    assert.equal(res.status, 200);
    expectedActivityXp += res.body.xpAwarded || 0;
  }

  // 3. Complete lesson once -> awards +40 XP + FIRST_LESSON (+50 XP)
  const comp1 = await jsonReq(
    `/api/learning/lessons/${targetLessonId}/complete`,
    {
      method: 'POST',
      body: JSON.stringify({ score: 100, minutesSpent: 180 }),
    },
    learnerToken
  );
  assert.equal(comp1.status, 200);
  assert.equal(comp1.body.completed, true);
  assert.equal(comp1.body.xpEarned, 40);
  assert.ok(comp1.body.newlyEarnedAchievements.includes('First Voice Step'));

  const [afterFirstComp] = await db
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.id, learnerId))
    .limit(1);
  assert.equal(afterFirstComp.xp, expectedActivityXp + 40 + 50);

  // 4. Repeat lesson completion -> awards 0 XP and does NOT re-award achievement XP
  const comp2 = await jsonReq(
    `/api/learning/lessons/${targetLessonId}/complete`,
    {
      method: 'POST',
      body: JSON.stringify({ score: 100, minutesSpent: 10 }),
    },
    learnerToken
  );
  assert.equal(comp2.status, 200);
  assert.equal(comp2.body.xpEarned, 0);
  assert.equal(comp2.body.alreadyCompleted, true);
  assert.equal(comp2.body.newlyEarnedAchievements.length, 0);

  const [afterRepeatComp] = await db
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.id, learnerId))
    .limit(1);
  assert.equal(afterRepeatComp.xp, expectedActivityXp + 40 + 50);
});

test('Offline sync idempotency: duplicate clientAttemptId replays without duplicate DB write or XP', async () => {
  const act = lessonActivities[0];
  const clientAttemptId = `offline-sync-${crypto.randomUUID()}`;
  const first = await jsonReq(
    `/api/learning/activities/${act.id}/attempt`,
    {
      method: 'POST',
      body: JSON.stringify({
        answer: getCorrectAnswer(act),
        clientAttemptId,
      }),
    },
    learnerToken
  );
  assert.equal(first.status, 200);
  assert.equal(first.body.alreadyProcessed, undefined);

  const replay = await jsonReq(
    `/api/learning/activities/${act.id}/attempt`,
    {
      method: 'POST',
      body: JSON.stringify({
        answer: getCorrectAnswer(act),
        clientAttemptId,
      }),
    },
    learnerToken
  );
  assert.equal(replay.status, 200);
  assert.equal(replay.body.alreadyProcessed, true);
  assert.equal(replay.body.xpAwarded, 0);
});

test('Priority 5 & 7: Voice validation, MIME allowlist, size bounds, cross-origin check, and TTS rate limit', async () => {
  // Cross-origin mutating API blocked
  const csrf = await jsonReq(
    '/api/learning/settings',
    {
      method: 'PATCH',
      headers: { Origin: 'https://evil.example' },
      body: JSON.stringify({ dailyGoalMinutes: 20 }),
    },
    learnerToken
  );
  assert.equal(csrf.status, 403);

  // Empty & oversized TTS dialogue rejected
  const emptyTts = await jsonReq('/api/voice/tts', { method: 'POST', body: JSON.stringify({ text: '' }) });
  assert.equal(emptyTts.status, 400);

  const longDialogue = await jsonReq('/api/voice/tts-dialogue', {
    method: 'POST',
    body: JSON.stringify({
      lines: Array.from({ length: 9 }, (_, i) => ({ speaker: `S${i}`, text: 'Hello' })),
    }),
  });
  assert.equal(longDialogue.status, 400);

  // Transcribe validation: bad MIME type, bad base64, oversized payload
  const badMime = await jsonReq(
    '/api/voice/transcribe',
    {
      method: 'POST',
      body: JSON.stringify({ audioBase64: 'UklGRiQAAABXQVZFZm10IBAAAA==', mimeType: 'application/pdf' }),
    },
    learnerToken
  );
  assert.equal(badMime.status, 400);

  const badB64 = await jsonReq(
    '/api/voice/transcribe',
    {
      method: 'POST',
      body: JSON.stringify({ audioBase64: '!!!not-valid-base64!!!', mimeType: 'audio/webm' }),
    },
    learnerToken
  );
  assert.equal(badB64.status, 400);

  const hugeAudio = await jsonReq(
    '/api/voice/transcribe',
    {
      method: 'POST',
      body: JSON.stringify({
        audioBase64: Buffer.alloc(3.2 * 1024 * 1024).toString('base64'),
        mimeType: 'audio/webm',
      }),
    },
    learnerToken
  );
  assert.equal(hugeAudio.status, 413);

  // TTS rate limiter triggers 429 after 35 calls per IP (no text needed beyond max; wait: let's avoid burning Gemini quota if configured by checking invalid/limit? Wait: limiter runs BEFORE handler, so even if GEMINI_API_KEY isn't used or if 400 passes Zod... wait: limiter runs BEFORE route handler!)
  // Use a unique synthetic x-forwarded-for IP so we don't hit real Gemini TTS 35 times or wait—if GEMINI_API_KEY is present, valid requests would hit Gemini unless text fails Zod inside handler!
  // Rate limiter middleware runs BEFORE Zod inside handler, so invalid body still increments rate limit cleanly without calling Gemini!
  let saw429 = false;
  for (let i = 0; i < 37; i++) {
    const r = await jsonReq('/api/voice/tts', {
      method: 'POST',
      headers: { 'x-forwarded-for': '203.0.113.77' },
      body: JSON.stringify({ text: '' }),
    });
    if (r.status === 429) {
      saw429 = true;
      break;
    }
  }
  assert.equal(saw429, true);
});
