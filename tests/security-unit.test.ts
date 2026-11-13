import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import http from 'node:http';
import { isAuthenticatedNonBrowserClient, isPermittedOrigin } from '../server/config/env.ts';
import { parseTrustProxyConfig, resolveClientIp } from '../server/config/trustProxy.ts';
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

test('Origin allowlist enforces explicit trusted origins and rejects missing/unlisted/wildcard origins', () => {
  const allowlist = ['http://localhost:3000', 'https://ais-dev-example.run.app'];

  assert.equal(
    isPermittedOrigin('http://localhost:3000', { allowMissingOrigin: false, allowedOrigins: allowlist }),
    true
  );
  assert.equal(
    isPermittedOrigin('https://ais-dev-example.run.app', { allowMissingOrigin: false, allowedOrigins: allowlist }),
    true
  );
  // Unlisted origins must be rejected even if another origin looks similar
  assert.equal(
    isPermittedOrigin('https://app.example.com', { allowMissingOrigin: false, allowedOrigins: allowlist }),
    false
  );
  assert.equal(
    isPermittedOrigin('https://evil.example', { allowMissingOrigin: false, allowedOrigins: allowlist }),
    false
  );
  assert.equal(
    isPermittedOrigin('javascript:alert(1)', { allowMissingOrigin: false, allowedOrigins: allowlist }),
    false
  );
  assert.equal(
    isPermittedOrigin('*', { allowMissingOrigin: false, allowedOrigins: allowlist }),
    false
  );
  assert.equal(
    isPermittedOrigin('null', { allowMissingOrigin: false, allowedOrigins: allowlist }),
    false
  );
  assert.equal(
    isPermittedOrigin(undefined, { allowMissingOrigin: false, allowedOrigins: allowlist }),
    false
  );
  assert.equal(
    isPermittedOrigin('', { allowMissingOrigin: false, allowedOrigins: allowlist }),
    false
  );
  assert.equal(
    isPermittedOrigin(undefined, { allowMissingOrigin: true, allowedOrigins: allowlist }),
    true
  );
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

test('Live tickets require origin binding, never skip missing origin checks, are single-use, and expire', () => {
  clearLiveTicketStoreForTests();

  // Issuing browser ticket without valid origin must throw
  assert.throws(() =>
    issueLiveTicket({
      userId: 1,
      learnerId: 2,
      parentId: null,
      environment: 'young_adults',
      ageRange: '18-25',
      cefrLevel: 'B1',
      mode: 'Everyday conversations',
      voiceName: 'Zephyr',
      origin: null,
    })
  );

  // Origin A ticket rejected when consumed from Origin B
  const { ticket: originATicket } = issueLiveTicket({
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
  assert.equal(consumeLiveTicket(originATicket, { requestOrigin: 'https://evil.example' }), null);
  // Already consumed/rejected ticket cannot be reused
  assert.equal(consumeLiveTicket(originATicket, { requestOrigin: 'http://localhost:3000' }), null);

  // Missing requestOrigin on consumption must be rejected even for valid ticket
  const { ticket: validTicketMissingReqOrigin } = issueLiveTicket({
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
  assert.equal(consumeLiveTicket(validTicketMissingReqOrigin, { requestOrigin: null }), null);

  // Exact matching origin succeeds once, then single-use blocks replay
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
  const payload = consumeLiveTicket(validTicket, { requestOrigin: 'http://localhost:3000' });
  assert.ok(payload);
  assert.equal(payload.learnerId, 2);
  assert.equal(consumeLiveTicket(validTicket, { requestOrigin: 'http://localhost:3000' }), null);

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
    origin: 'http://localhost:3000',
    ttlMs: -10,
  });
  assert.equal(consumeLiveTicket(expiredTicket, { requestOrigin: 'http://localhost:3000' }), null);

  // Non-browser authentication cannot bypass browser Origin checks when Origin header is present
  assert.equal(
    isAuthenticatedNonBrowserClient(
      { origin: 'https://evil.example', 'x-sauti-client-key': 'super-secret-non-browser-key' },
      { enabled: true, clientKey: 'super-secret-non-browser-key' }
    ),
    false
  );
  assert.equal(
    isAuthenticatedNonBrowserClient(
      { 'x-sauti-client-key': 'super-secret-non-browser-key' },
      { enabled: true, clientKey: 'super-secret-non-browser-key' }
    ),
    true
  );
});

test('Trust proxy configuration fails safely when invalid and resists X-Forwarded-For spoofing', () => {
  for (const invalidVal of [true, 'true', '*', '0.0.0.0/0', '::/0', -1, 'invalid-cidr', '999.999.999.999', 99]) {
    const parsed = parseTrustProxyConfig(invalidVal as any);
    assert.equal(parsed.isValid, false, `Expected invalid for ${String(invalidVal)}`);
    assert.equal(parsed.mode, 'none');
    assert.equal(parsed.expressValue, false);
  }

  // Disabled proxy trust ignores X-Forwarded-For completely
  assert.equal(
    resolveClientIp(
      { headers: { 'x-forwarded-for': '1.2.3.4' }, socket: { remoteAddress: '198.51.100.20' } as any },
      false
    ),
    '198.51.100.20'
  );

  // Trusted loopback proxy ignores X-Forwarded-For if TCP peer is NOT loopback
  assert.equal(
    resolveClientIp(
      { headers: { 'x-forwarded-for': '1.2.3.4' }, socket: { remoteAddress: '198.51.100.20' } as any },
      'loopback'
    ),
    '198.51.100.20'
  );

  // Behind trusted loopback proxy, attacker prepending spoofed XFF still resolves to proxy-appended real IP
  assert.equal(
    resolveClientIp(
      {
        headers: { 'x-forwarded-for': '9.9.9.9, 203.0.113.50' },
        socket: { remoteAddress: '::ffff:127.0.0.1' } as any,
      },
      'loopback, uniquelocal'
    ),
    '203.0.113.50'
  );

  // Behind 1-hop trust, rightmost untrusted entry is used rather than leftmost spoofed entry
  assert.equal(
    resolveClientIp(
      {
        headers: { 'x-forwarded-for': '9.9.9.9, 203.0.113.77' },
        socket: { remoteAddress: '127.0.0.1' } as any,
      },
      1
    ),
    '203.0.113.77'
  );
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
