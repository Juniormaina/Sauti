import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { and, eq, inArray } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import {
  activities,
  courses,
  learnerProfiles,
  learningAttempts,
  lessons,
  modules,
  programmes,
  users,
} from '../src/db/schema.ts';
import { createSautiApp } from '../server/app.ts';
import { ensureSeeded } from '../server/services/seedService.ts';
import type { SyncQueueItem } from '../src/lib/offlineDb.ts';
import {
  buildOfflineActivityOutcome,
  buildServerVerifiedActivityOutcome,
  runScopedQueueSync,
  type SyncQueueStorage,
} from '../src/lib/offlineSyncEngine.ts';
import { ApiError } from '../src/services/api.ts';

let server: http.Server;
let baseUrl = '';
const createdUserIds: number[] = [];
let learnerToken = '';
let learnerId = 0;
let deterministicActivity!: typeof activities.$inferSelect;
let secondDeterministicActivity!: typeof activities.$inferSelect;

const DETERMINISTIC_TYPES = new Set([
  'multiple_choice',
  'listen_select',
  'story_comprehension',
  'picture_recognition',
  'fill_blanks',
  'spelling',
  'grammar_correction',
  'sentence_building',
  'word_matching',
  'listen_repeat',
  'read_aloud',
  'voice_recording',
]);

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
    default:
      return payload.targetText || 'Good morning';
  }
}

function createMemoryQueueStorage(initial: SyncQueueItem[]): {
  items: SyncQueueItem[];
  storage: SyncQueueStorage;
} {
  const items = initial.map((x) => ({ ...x }));
  const storage: SyncQueueStorage = {
    async list(scopeKey) {
      return items
        .filter((i) => i.scopeKey === scopeKey)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
        .map((i) => ({ ...i }));
    },
    async update(updated) {
      const idx = items.findIndex((i) => i.id === updated.id);
      if (idx >= 0) items[idx] = { ...updated };
      else items.push({ ...updated });
    },
    async remove(id) {
      const idx = items.findIndex((i) => i.id === id);
      if (idx >= 0) items.splice(idx, 1);
    },
  };
  return { items, storage };
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
      email: `sync-reliability-${suffix}@test.local`,
      password: 'Password123!',
      displayName: 'Sync Reliability Tester',
      accountType: 'individual',
      environment: 'young_adults',
    }),
  });
  assert.equal(reg.status, 201);
  learnerToken = reg.body.token;
  learnerId = reg.body.learnerProfile.id;
  createdUserIds.push(reg.body.user.id);

  const [yaProg] = await db
    .select()
    .from(programmes)
    .where(eq(programmes.environment, 'young_adults'))
    .limit(1);
  const yaCourses = await db
    .select()
    .from(courses)
    .where(eq(courses.programmeId, yaProg.id));
  const yaMods = await db
    .select()
    .from(modules)
    .where(inArray(modules.courseId, yaCourses.map((c) => c.id)));
  const yaLessons = await db
    .select()
    .from(lessons)
    .where(inArray(lessons.moduleId, yaMods.map((m) => m.id)));
  const allActs = await db
    .select()
    .from(activities)
    .where(inArray(activities.lessonId, yaLessons.map((l) => l.id)));

  const detList = allActs.filter((a) => DETERMINISTIC_TYPES.has(a.type));
  assert.ok(detList.length >= 2, 'Expected at least 2 deterministic young_adults activities');
  deterministicActivity = detList[0];
  secondDeterministicActivity = detList[1];
});

after(async () => {
  if (createdUserIds.length > 0) {
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('1 & 2 & 3. Database-enforced idempotency: simultaneous duplicate clientAttemptId requests insert once and award XP once; sequential replay returns original result with 0 XP', async () => {
  const [beforeLearner] = await db
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.id, learnerId))
    .limit(1);

  const concurrentAttemptId = `concurrent-${crypto.randomUUID()}`;
  const correctAnswer = getCorrectAnswer(deterministicActivity);

  const responses = await Promise.all([
    jsonReq(
      `/api/learning/activities/${deterministicActivity.id}/attempt`,
      {
        method: 'POST',
        body: JSON.stringify({ answer: correctAnswer, clientAttemptId: concurrentAttemptId }),
      },
      learnerToken
    ),
    jsonReq(
      `/api/learning/activities/${deterministicActivity.id}/attempt`,
      {
        method: 'POST',
        body: JSON.stringify({ answer: correctAnswer, clientAttemptId: concurrentAttemptId }),
      },
      learnerToken
    ),
    jsonReq(
      `/api/learning/activities/${deterministicActivity.id}/attempt`,
      {
        method: 'POST',
        body: JSON.stringify({ answer: correctAnswer, clientAttemptId: concurrentAttemptId }),
      },
      learnerToken
    ),
  ]);

  for (const r of responses) {
    assert.equal(r.status, 200);
    assert.equal(r.body.isCorrect, true);
    assert.equal(r.body.score, deterministicActivity.points);
  }

  const freshAwards = responses.filter((r) => !r.body.alreadyProcessed);
  const duplicateReplays = responses.filter((r) => r.body.alreadyProcessed === true);
  assert.equal(freshAwards.length, 1, 'Exactly one concurrent request should process the attempt');
  assert.equal(duplicateReplays.length, 2, 'Other concurrent duplicates must return alreadyProcessed');
  assert.equal(freshAwards[0].body.xpAwarded, deterministicActivity.points);
  for (const dup of duplicateReplays) {
    assert.equal(dup.body.xpAwarded, 0);
  }

  const rows = await db
    .select()
    .from(learningAttempts)
    .where(
      and(
        eq(learningAttempts.learnerId, learnerId),
        eq(learningAttempts.activityId, deterministicActivity.id),
        eq(learningAttempts.clientAttemptId, concurrentAttemptId)
      )
    );
  assert.equal(rows.length, 1, 'DB unique constraint must enforce only 1 attempt row');

  const [afterLearner] = await db
    .select()
    .from(learnerProfiles)
    .where(eq(learnerProfiles.id, learnerId))
    .limit(1);
  assert.equal(afterLearner.xp, beforeLearner.xp + deterministicActivity.points);

  // Sequential replay of a second activity attempt preserves original outcome & feedback with 0 extra XP
  const replayId = `seq-${crypto.randomUUID()}`;
  const firstSeq = await jsonReq(
    `/api/learning/activities/${secondDeterministicActivity.id}/attempt`,
    {
      method: 'POST',
      body: JSON.stringify({
        answer: getCorrectAnswer(secondDeterministicActivity),
        clientAttemptId: replayId,
      }),
    },
    learnerToken
  );
  assert.equal(firstSeq.status, 200);
  assert.equal(firstSeq.body.xpAwarded, secondDeterministicActivity.points);

  const replaySeq = await jsonReq(
    `/api/learning/activities/${secondDeterministicActivity.id}/attempt`,
    {
      method: 'POST',
      body: JSON.stringify({
        answer: getCorrectAnswer(secondDeterministicActivity),
        clientAttemptId: replayId,
      }),
    },
    learnerToken
  );
  assert.equal(replaySeq.status, 200);
  assert.equal(replaySeq.body.alreadyProcessed, true);
  assert.equal(replaySeq.body.isCorrect, firstSeq.body.isCorrect);
  assert.equal(replaySeq.body.score, firstSeq.body.score);
  assert.equal(replaySeq.body.feedback, firstSeq.body.feedback);
  assert.equal(replaySeq.body.xpAwarded, 0);
});

test('4. HTTP 401 retains queued progress and requests authentication recovery instead of deleting', async () => {
  const { items, storage } = createMemoryQueueStorage([
    {
      id: 'att-401',
      scopeKey: 'u:1:l:1',
      learnerId: 1,
      kind: 'activity_attempt',
      endpoint: '/api/learning/activities/1/attempt',
      payload: { answer: 'Hello', clientAttemptId: 'att-401' },
      label: 'Activity #1',
      createdAt: '2026-01-01T00:00:00.000Z',
      retryCount: 0,
      status: 'pending',
    },
  ]);

  const result = await runScopedQueueSync({
    targetScopeKey: 'u:1:l:1',
    getActiveScopeKey: () => 'u:1:l:1',
    isOnline: () => true,
    storage,
    transport: {
      async submit() {
        throw new ApiError('Your session expired.', 401, false);
      },
    },
  });

  assert.equal(result.synced, 0);
  assert.equal(result.remaining, 1);
  assert.equal(result.needsAuthRecovery, true);
  assert.equal(items.length, 1);
  assert.equal(items[0].status, 'auth_required');
  assert.equal(items[0].lastStatusCode, 401);
});

test('5. HTTP 403 and 400 validation failures preserve queued records with clear explanations instead of silently deleting', async () => {
  const { items, storage } = createMemoryQueueStorage([
    {
      id: 'att-403',
      scopeKey: 'u:1:l:1',
      learnerId: 1,
      kind: 'activity_attempt',
      endpoint: '/api/learning/activities/1/attempt',
      payload: { answer: 'Hello', clientAttemptId: 'att-403' },
      label: 'Activity #1',
      createdAt: '2026-01-01T00:00:01.000Z',
      retryCount: 0,
      status: 'pending',
    },
    {
      id: 'att-400',
      scopeKey: 'u:1:l:1',
      learnerId: 1,
      kind: 'lesson_complete',
      endpoint: '/api/learning/lessons/1/complete',
      payload: { minutesSpent: 5 },
      label: 'Complete lesson: Greetings',
      createdAt: '2026-01-01T00:00:02.000Z',
      retryCount: 0,
      status: 'pending',
    },
  ]);

  const result = await runScopedQueueSync({
    targetScopeKey: 'u:1:l:1',
    getActiveScopeKey: () => 'u:1:l:1',
    isOnline: () => true,
    storage,
    transport: {
      async submit(endpoint) {
        if (endpoint.includes('/activities/')) {
          throw new ApiError('Parent consent required for child profile.', 403, false);
        }
        throw new ApiError('Please attempt all activities first.', 400, false);
      },
    },
  });

  assert.equal(result.synced, 0);
  assert.equal(result.remaining, 2);
  assert.equal(result.attentionCount, 2);
  assert.equal(items.length, 2);
  assert.equal(items[0].status, 'needs_resolution');
  assert.equal(items[0].lastStatusCode, 403);
  assert.match(items[0].lastError || '', /Parent consent required/);
  assert.equal(items[1].status, 'needs_resolution');
  assert.equal(items[1].lastStatusCode, 400);
  assert.match(items[1].lastError || '', /attempt all activities/);
});

test('6. Transient 408/429/503 errors retain queue items with backoff and remove only after 2xx confirmation', async () => {
  let fakeNow = Date.parse('2026-06-01T10:00:00.000Z');
  const { items, storage } = createMemoryQueueStorage([
    {
      id: 'att-transient',
      scopeKey: 'u:2:l:3',
      learnerId: 3,
      kind: 'activity_attempt',
      endpoint: '/api/learning/activities/9/attempt',
      payload: { answer: 'Good morning', clientAttemptId: 'att-transient' },
      label: 'Activity #9',
      createdAt: '2026-06-01T09:59:00.000Z',
      retryCount: 0,
      status: 'pending',
    },
  ]);

  let attemptNumber = 0;
  const transport = {
    async submit() {
      attemptNumber += 1;
      if (attemptNumber === 1) throw new ApiError('Request timeout', 408, false);
      if (attemptNumber === 2) throw new ApiError('Too many requests', 429, false, 15);
      if (attemptNumber === 3) throw new ApiError('Service temporarily unavailable', 503, false);
      return { isCorrect: true, score: 20, xpAwarded: 20, feedback: 'Verified!' };
    },
  };

  // Run 1: hits 408 -> backoff 2s
  const r1 = await runScopedQueueSync({
    targetScopeKey: 'u:2:l:3',
    getActiveScopeKey: () => 'u:2:l:3',
    isOnline: () => true,
    storage,
    transport,
    now: () => fakeNow,
  });
  assert.equal(r1.synced, 0);
  assert.equal(items[0].retryCount, 1);
  assert.equal(items[0].lastStatusCode, 408);
  assert.ok(Date.parse(items[0].nextRetryAt!) > fakeNow);

  // Immediately re-running before backoff expires defers without hitting transport
  const deferred = await runScopedQueueSync({
    targetScopeKey: 'u:2:l:3',
    getActiveScopeKey: () => 'u:2:l:3',
    isOnline: () => true,
    storage,
    transport,
    now: () => fakeNow + 500,
  });
  assert.equal(deferred.deferredCount, 1);
  assert.equal(attemptNumber, 1);

  // Advance past 408 backoff -> hits 429 with Retry-After: 15s
  fakeNow += 5_000;
  const r2 = await runScopedQueueSync({
    targetScopeKey: 'u:2:l:3',
    getActiveScopeKey: () => 'u:2:l:3',
    isOnline: () => true,
    storage,
    transport,
    now: () => fakeNow,
  });
  assert.equal(r2.remaining, 1);
  assert.equal(items[0].retryCount, 2);
  assert.equal(items[0].lastStatusCode, 429);
  assert.equal(Date.parse(items[0].nextRetryAt!), fakeNow + 15_000);

  // Advance past 15s -> hits 503
  fakeNow += 16_000;
  await runScopedQueueSync({
    targetScopeKey: 'u:2:l:3',
    getActiveScopeKey: () => 'u:2:l:3',
    isOnline: () => true,
    storage,
    transport,
    now: () => fakeNow,
  });
  assert.equal(items[0].retryCount, 3);
  assert.equal(items[0].lastStatusCode, 503);

  // Advance past 503 backoff -> hits 200 and removes ONLY after confirmation
  fakeNow += 30_000;
  const r4 = await runScopedQueueSync({
    targetScopeKey: 'u:2:l:3',
    getActiveScopeKey: () => 'u:2:l:3',
    isOnline: () => true,
    storage,
    transport,
    now: () => fakeNow,
  });
  assert.equal(r4.synced, 1);
  assert.equal(r4.remaining, 0);
  assert.equal(items.length, 0);
  assert.equal(r4.verifiedItems.length, 1);
  assert.equal(r4.verifiedItems[0].response.xpAwarded, 20);
});

test('7. Learner/account switching during sync aborts cleanly without cross-scope deletion or corruption', async () => {
  const { items, storage } = createMemoryQueueStorage([
    {
      id: 'scope-a-1',
      scopeKey: 'u:5:l:10',
      learnerId: 10,
      kind: 'activity_attempt',
      endpoint: '/api/learning/activities/1/attempt',
      payload: { answer: 'A', clientAttemptId: 'scope-a-1' },
      label: 'Learner A #1',
      createdAt: '2026-06-01T09:00:00.000Z',
      retryCount: 0,
      status: 'pending',
    },
    {
      id: 'scope-a-2',
      scopeKey: 'u:5:l:10',
      learnerId: 10,
      kind: 'activity_attempt',
      endpoint: '/api/learning/activities/2/attempt',
      payload: { answer: 'B', clientAttemptId: 'scope-a-2' },
      label: 'Learner A #2',
      createdAt: '2026-06-01T09:01:00.000Z',
      retryCount: 0,
      status: 'pending',
    },
    {
      id: 'scope-b-1',
      scopeKey: 'u:5:l:20',
      learnerId: 20,
      kind: 'activity_attempt',
      endpoint: '/api/learning/activities/1/attempt',
      payload: { answer: 'C', clientAttemptId: 'scope-b-1' },
      label: 'Learner B #1',
      createdAt: '2026-06-01T09:02:00.000Z',
      retryCount: 0,
      status: 'pending',
    },
  ]);

  let currentActiveScope = 'u:5:l:10';
  const submittedEndpoints: string[] = [];

  const result = await runScopedQueueSync({
    targetScopeKey: 'u:5:l:10',
    getActiveScopeKey: () => currentActiveScope,
    isOnline: () => true,
    storage,
    transport: {
      async submit(endpoint) {
        submittedEndpoints.push(endpoint);
        // Simulate parent switching active child learner right as first request resolves
        currentActiveScope = 'u:5:l:20';
        return { isCorrect: true, score: 10, xpAwarded: 10, feedback: 'OK' };
      },
    },
  });

  assert.equal(result.abortedForScopeChange, true);
  assert.deepEqual(submittedEndpoints, ['/api/learning/activities/1/attempt']);
  assert.ok(items.some((i) => i.id === 'scope-a-2'), 'Remaining Learner A item preserved');
  assert.ok(items.some((i) => i.id === 'scope-b-1'), 'Learner B item untouched');
});

test('8. Offline activity attempts never award unverified XP or claim correctness until server sync verification', () => {
  const detOffline = buildOfflineActivityOutcome('multiple_choice', 'att-det-1');
  assert.equal(detOffline.verificationStatus, 'queued_offline');
  assert.equal(detOffline.isCorrect, null);
  assert.equal(detOffline.score, null);
  assert.equal(detOffline.xpAwarded, null);
  assert.match(detOffline.feedback, /Attempted locally/i);

  const aiOffline = buildOfflineActivityOutcome('writing', 'att-ai-1');
  assert.equal(aiOffline.verificationStatus, 'queued_offline');
  assert.equal(aiOffline.isCorrect, null);
  assert.equal(aiOffline.score, null);
  assert.equal(aiOffline.xpAwarded, null);
  assert.match(aiOffline.feedback, /Cloud AI evaluation/i);

  const verified = buildServerVerifiedActivityOutcome(
    { isCorrect: true, score: 15, xpAwarded: 15, feedback: 'Great job!' },
    'att-det-1'
  );
  assert.equal(verified.verificationStatus, 'verified');
  assert.equal(verified.isCorrect, true);
  assert.equal(verified.score, 15);
  assert.equal(verified.xpAwarded, 15);
});
