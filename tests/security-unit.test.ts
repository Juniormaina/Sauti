import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { isPermittedOrigin } from '../server/config/env.ts';
import {
  canLearnerAccessCourseEnvironment,
  evaluateLiveVoiceSafety,
  hasActiveGuardianConsent,
  isMinorLearner,
  isUnder13Learner,
  shouldStoreTranscripts,
  validateEnvironmentTransition,
} from '../server/services/childSafetyService.ts';
import {
  clearLiveTicketStoreForTests,
  consumeLiveTicket,
  issueLiveTicket,
} from '../server/services/liveTicketService.ts';
import { createRateLimiter } from '../server/middleware/rateLimit.ts';

test('Origin allowlist rejects cross-origin requests and accepts same-host/localhost', () => {
  assert.equal(isPermittedOrigin('http://localhost:3000', 'localhost:3000'), true);
  assert.equal(isPermittedOrigin('https://app.example.com', 'app.example.com'), true);
  assert.equal(isPermittedOrigin('https://evil.example', 'localhost:3000'), false);
  assert.equal(isPermittedOrigin('javascript:alert(1)', 'localhost:3000'), false);
  assert.equal(isPermittedOrigin(undefined, 'localhost:3000', { allowMissingOrigin: false }), false);
  assert.equal(isPermittedOrigin(undefined, 'localhost:3000', { allowMissingOrigin: true }), true);
});

test('Guardian consent checks require non-revoked accepted consent', () => {
  const now = Date.now();
  assert.equal(hasActiveGuardianConsent(null), false);
  assert.equal(
    hasActiveGuardianConsent({
      id: 1,
      consentAcceptedAt: null,
      consentRevokedAt: null,
      allowAiLiveForChildren: false,
      recordingRetentionDays: 7,
    }),
    false
  );
  assert.equal(
    hasActiveGuardianConsent({
      id: 1,
      consentAcceptedAt: new Date(now - 5000),
      consentRevokedAt: null,
      allowAiLiveForChildren: false,
      recordingRetentionDays: 7,
    }),
    true
  );
  assert.equal(
    hasActiveGuardianConsent({
      id: 1,
      consentAcceptedAt: new Date(now - 5000),
      consentRevokedAt: new Date(now - 1000),
      allowAiLiveForChildren: false,
      recordingRetentionDays: 7,
    }),
    false
  );
  assert.equal(
    hasActiveGuardianConsent({
      id: 1,
      consentAcceptedAt: new Date(now),
      consentRevokedAt: new Date(now - 5000),
      allowAiLiveForChildren: false,
      recordingRetentionDays: 7,
    }),
    true
  );
});

test('Child safety evaluates little_voices, young_explorers, and teen_voices consistently', () => {
  const unlinkedChild = {
    id: 1,
    userId: 10,
    parentId: null,
    environment: 'young_explorers',
    ageRange: '6-10',
    cefrLevel: 'A1',
  };
  assert.equal(isUnder13Learner(unlinkedChild), true);
  assert.equal(isMinorLearner(unlinkedChild), true);

  const unlinkedRes = evaluateLiveVoiceSafety(unlinkedChild, null, 'Everyday conversations');
  assert.equal(unlinkedRes.allowed, false);
  if (!unlinkedRes.allowed) assert.equal(unlinkedRes.code, 'GUARDIAN_REQUIRED');

  const linkedTeen = {
    id: 2,
    userId: null,
    parentId: 5,
    environment: 'teen_voices',
    ageRange: '11-17',
    cefrLevel: 'B1',
  };
  const pausedParent = {
    id: 5,
    consentAcceptedAt: new Date(),
    consentRevokedAt: null,
    allowAiLiveForChildren: false,
    recordingRetentionDays: 7,
  };
  const pausedTeenRes = evaluateLiveVoiceSafety(linkedTeen, pausedParent, 'School conversations');
  assert.equal(pausedTeenRes.allowed, false);
  if (!pausedTeenRes.allowed) assert.equal(pausedTeenRes.code, 'SAFETY_RESTRICTED');

  const allowedParent = { ...pausedParent, allowAiLiveForChildren: true };
  assert.equal(evaluateLiveVoiceSafety(linkedTeen, allowedParent, 'School conversations').allowed, true);
  const badModeRes = evaluateLiveVoiceSafety(linkedTeen, allowedParent, 'Workplace conversations');
  assert.equal(badModeRes.allowed, false);
  if (!badModeRes.allowed) assert.equal(badModeRes.code, 'MODE_RESTRICTED');
});

test('Environment transitions and course access enforce age-tier isolation', () => {
  const teen = { environment: 'teen_voices', ageRange: '11-17', parentId: null };
  assert.equal(validateEnvironmentTransition(teen, 'young_adults', { isParentActingForChild: false }).allowed, false);
  assert.equal(canLearnerAccessCourseEnvironment(teen, 'professional_english'), false);
  assert.equal(canLearnerAccessCourseEnvironment(teen, 'teen_voices'), true);

  const child = { environment: 'little_voices', ageRange: '3-5', parentId: 99 };
  assert.equal(validateEnvironmentTransition(child, 'young_explorers', { isParentActingForChild: false }).allowed, false);
  assert.equal(validateEnvironmentTransition(child, 'young_explorers', { isParentActingForChild: true }).allowed, true);
  assert.equal(validateEnvironmentTransition(child, 'young_adults', { isParentActingForChild: true }).allowed, false);
});

test('Transcript storage respects saveTranscripts and retention days', () => {
  const parent = {
    id: 1,
    consentAcceptedAt: new Date(),
    consentRevokedAt: null,
    allowAiLiveForChildren: true,
    recordingRetentionDays: 7,
  };
  const child = {
    id: 2,
    userId: null,
    parentId: 1,
    environment: 'young_explorers',
    ageRange: '6-10',
    cefrLevel: 'A1',
    voicePreferences: { saveTranscripts: true },
  };
  assert.equal(shouldStoreTranscripts(child, parent), true);
  assert.equal(shouldStoreTranscripts(child, { ...parent, recordingRetentionDays: 0 }), false);
  assert.equal(
    shouldStoreTranscripts({ ...child, voicePreferences: { saveTranscripts: false } }, parent),
    false
  );
});

test('Live tickets are single-use, bound to origin, and expire properly', () => {
  clearLiveTicketStoreForTests();
  const { ticket } = issueLiveTicket({
    userId: 1,
    learnerId: 2,
    parentId: null,
    environment: 'young_adults',
    ageRange: '18-25',
    cefrLevel: 'B1',
    mode: 'Everyday conversations',
    voiceName: 'Zephyr',
    origin: 'http://localhost:3000',
  });

  // Origin mismatch rejected without invalidating or wait—it consumes atomically and rejects
  assert.equal(consumeLiveTicket(ticket, 'https://evil.example'), null);
  // Already consumed/rejected ticket cannot be reused
  assert.equal(consumeLiveTicket(ticket, 'http://localhost:3000'), null);

  const { ticket: validTicket } = issueLiveTicket({
    userId: 1,
    learnerId: 2,
    parentId: null,
    environment: 'young_adults',
    ageRange: '18-25',
    cefrLevel: 'B1',
    mode: 'Everyday conversations',
    voiceName: 'Zephyr',
    origin: 'http://localhost:3000',
  });
  const payload = consumeLiveTicket(validTicket, 'http://localhost:3000');
  assert.ok(payload);
  assert.equal(payload.learnerId, 2);
  // Single-use: second consume returns null
  assert.equal(consumeLiveTicket(validTicket, 'http://localhost:3000'), null);

  // Expired ticket rejected
  const { ticket: expiredTicket } = issueLiveTicket({
    userId: 1,
    learnerId: 2,
    parentId: null,
    environment: 'young_adults',
    ageRange: '18-25',
    cefrLevel: 'B1',
    mode: 'Everyday conversations',
    voiceName: 'Zephyr',
    origin: null,
    ttlMs: -10,
  });
  assert.equal(consumeLiveTicket(expiredTicket, null), null);
});

test('Sliding-window rate limiter enforces maxRequests and sets 429 Retry-After', async () => {
  const limiter = createRateLimiter({
    name: 'unit-test-limiter',
    windowMs: 60_000,
    maxRequests: 2,
  });

  const app = express();
  app.get('/ping', limiter, (_req, res) => res.json({ ok: true }));
  const server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));

  try {
    const addr = server.address() as { port: number };
    const url = `http://127.0.0.1:${addr.port}/ping`;

    const r1 = await fetch(url);
    assert.equal(r1.status, 200);
    const r2 = await fetch(url);
    assert.equal(r2.status, 200);
    const r3 = await fetch(url);
    assert.equal(r3.status, 429);
    assert.ok(r3.headers.get('retry-after'));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
