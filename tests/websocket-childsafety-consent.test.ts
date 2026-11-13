import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { eq, inArray } from 'drizzle-orm';
import { WebSocket } from 'ws';
import { db } from '../src/db/index.ts';
import {
  courses,
  guardianConsentEvents,
  learnerProfiles,
  parentProfiles,
  programmes,
  users,
} from '../src/db/schema.ts';
import { createSautiApp } from '../server/app.ts';
import { attachLiveVoiceWebSocket } from '../server/ws/liveVoiceServer.ts';
import { ensureSeeded } from '../server/services/seedService.ts';
import { issueLiveTicket } from '../server/services/liveTicketService.ts';

let server: http.Server;
let baseUrl = '';
let wsBaseUrl = '';

const createdUserIds: number[] = [];

let parentToken = '';
let parentId = 0;
let littleVoicesChildId = 0;
let youngExplorersChildId = 0;
let teenChildId = 0;
let adultToken = '';
let adultLearnerId = 0;
let standaloneTeenToken = '';
let adultCourseId = 0;

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

function connectWsExpectUpgradeFailure(url: string, headers?: Record<string, string>) {
  return new Promise<{ statusCode: number }>((resolve, reject) => {
    const ws = new WebSocket(url, { headers });
    let settled = false;
    ws.on('unexpected-response', (_req, res) => {
      if (settled) return;
      settled = true;
      res.resume();
      resolve({ statusCode: res.statusCode || 0 });
    });
    ws.on('open', () => {
      if (settled) return;
      settled = true;
      ws.close();
      reject(new Error('Expected WebSocket upgrade to fail, but connection opened.'));
    });
    ws.on('error', (err) => {
      if (settled) return;
      // Only reject if unexpected-response didn't already capture status
      setTimeout(() => {
        if (!settled) {
          settled = true;
          reject(err);
        }
      }, 25);
    });
  });
}

before(async () => {
  await ensureSeeded();
  const app = createSautiApp();
  server = http.createServer(app);
  attachLiveVoiceWebSocket(server);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;
  wsBaseUrl = `ws://127.0.0.1:${addr.port}`;

  const suffix = crypto.randomBytes(4).toString('hex');

  // Register parent WITHOUT checking consent initially
  const parRes = await jsonReq('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `safety-parent-${suffix}@test.local`,
      password: 'Password123!',
      displayName: 'Safety Parent',
      accountType: 'parent',
    }),
  });
  assert.equal(parRes.status, 201);
  parentToken = parRes.body.token;
  parentId = parRes.body.parentProfile.id;
  assert.equal(parRes.body.parentProfile.consentAcceptedAt, null);
  assert.equal(parRes.body.parentProfile.hasActiveConsent, false);
  createdUserIds.push(parRes.body.user.id);

  // Adult learner for valid WS ticket testing
  const adultRes = await jsonReq('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `safety-adult-${suffix}@test.local`,
      password: 'Password123!',
      displayName: 'Adult Learner',
      accountType: 'individual',
      environment: 'young_adults',
    }),
  });
  assert.equal(adultRes.status, 201);
  adultToken = adultRes.body.token;
  adultLearnerId = adultRes.body.learnerProfile.id;
  createdUserIds.push(adultRes.body.user.id);

  // Standalone teen learner (11-17)
  const teenRes = await jsonReq('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `safety-teen-${suffix}@test.local`,
      password: 'Password123!',
      displayName: 'Teen Learner',
      accountType: 'individual',
      environment: 'teen_voices',
    }),
  });
  assert.equal(teenRes.status, 201);
  standaloneTeenToken = teenRes.body.token;
  createdUserIds.push(teenRes.body.user.id);

  // Find an adult course id
  const [adultProg] = await db
    .select()
    .from(programmes)
    .where(eq(programmes.environment, 'professional_english'))
    .limit(1);
  assert.ok(adultProg);
  const [adultCourse] = await db
    .select()
    .from(courses)
    .where(eq(courses.programmeId, adultProg.id))
    .limit(1);
  assert.ok(adultCourse);
  adultCourseId = adultCourse.id;
});

after(async () => {
  if (createdUserIds.length > 0) {
    const parentRows = await db
      .select({ id: parentProfiles.id })
      .from(parentProfiles)
      .where(inArray(parentProfiles.userId, createdUserIds));
    if (parentRows.length > 0) {
      await db
        .delete(learnerProfiles)
        .where(inArray(learnerProfiles.parentId, parentRows.map((p) => p.id)));
    }
    await db.delete(users).where(inArray(users.id, createdUserIds));
  }
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

test('Priority 4: Under-13 self-registration blocked; guardian consent must be explicit & audited', async () => {
  const under13Self = await jsonReq('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `kid-${Date.now()}@test.local`,
      password: 'Password123!',
      displayName: 'Young Kid',
      accountType: 'individual',
      environment: 'little_voices',
      parentConsentAccepted: true,
    }),
  });
  assert.equal(under13Self.status, 400);

  // Parent without active consent cannot create child even with consentConfirmed: true in body
  const blockedChild = await jsonReq(
    '/api/parent/children',
    {
      method: 'POST',
      body: JSON.stringify({
        displayName: 'Child Unconsented',
        environment: 'little_voices',
        consentConfirmed: true,
      }),
    },
    parentToken
  );
  assert.equal(blockedChild.status, 403);
  assert.equal(blockedChild.body.code, 'CONSENT_REQUIRED');

  // Parent cannot enable Live AI before granting consent
  const blockedLiveSetting = await jsonReq(
    '/api/parent/settings',
    {
      method: 'PATCH',
      body: JSON.stringify({ allowAiLiveForChildren: true }),
    },
    parentToken
  );
  assert.equal(blockedLiveSetting.status, 403);

  // Explicit consent grant succeeds and writes audit event
  const grant = await jsonReq(
    '/api/parent/consent',
    { method: 'POST', body: JSON.stringify({ confirmed: true }) },
    parentToken
  );
  assert.equal(grant.status, 200);
  assert.equal(grant.body.parent.hasActiveConsent, true);

  const events = await db
    .select()
    .from(guardianConsentEvents)
    .where(eq(guardianConsentEvents.parentId, parentId));
  assert.ok(events.some((e) => e.action === 'accepted'));

  // Now create child profiles across all 3 child/minor tiers
  const lv = await jsonReq(
    '/api/parent/children',
    {
      method: 'POST',
      body: JSON.stringify({
        displayName: 'Little Kid',
        environment: 'little_voices',
        consentConfirmed: true,
      }),
    },
    parentToken
  );
  assert.equal(lv.status, 201);
  littleVoicesChildId = lv.body.child.id;

  const ye = await jsonReq(
    '/api/parent/children',
    {
      method: 'POST',
      body: JSON.stringify({
        displayName: 'Explorer Kid',
        environment: 'young_explorers',
        consentConfirmed: true,
      }),
    },
    parentToken
  );
  assert.equal(ye.status, 201);
  youngExplorersChildId = ye.body.child.id;

  const tv = await jsonReq(
    '/api/parent/children',
    {
      method: 'POST',
      body: JSON.stringify({
        displayName: 'Teen Kid',
        environment: 'teen_voices',
        consentConfirmed: true,
      }),
    },
    parentToken
  );
  assert.equal(tv.status, 201);
  teenChildId = tv.body.child.id;
});

test('Priority 3: Child safety gates Live Voice across little_voices, young_explorers, and teen_voices + blocks adult content', async () => {
  // With allowAiLiveForChildren = false, all three child/minor tiers are blocked from Live tickets
  for (const childId of [littleVoicesChildId, youngExplorersChildId, teenChildId]) {
    const res = await jsonReq(
      '/api/voice/live-ticket',
      {
        method: 'POST',
        body: JSON.stringify({ learnerId: childId, mode: 'Everyday conversations' }),
      },
      parentToken
    );
    assert.equal(res.status, 403);
    assert.equal(res.body.code, 'SAFETY_RESTRICTED');
  }

  // Enable allowAiLiveForChildren
  const enable = await jsonReq(
    '/api/parent/settings',
    { method: 'PATCH', body: JSON.stringify({ allowAiLiveForChildren: true }) },
    parentToken
  );
  assert.equal(enable.status, 200);

  // Child is allowed age-appropriate mode, but blocked from adult workplace/interview mode
  const allowedTicket = await jsonReq(
    '/api/voice/live-ticket',
    {
      method: 'POST',
      body: JSON.stringify({ learnerId: youngExplorersChildId, mode: 'School conversations' }),
    },
    parentToken
  );
  assert.equal(allowedTicket.status, 201);
  assert.equal(allowedTicket.body.environment, 'young_explorers');

  const adultModeBlocked = await jsonReq(
    '/api/voice/live-ticket',
    {
      method: 'POST',
      body: JSON.stringify({ learnerId: youngExplorersChildId, mode: 'Workplace conversations' }),
    },
    parentToken
  );
  assert.equal(adultModeBlocked.status, 403);
  assert.equal(adultModeBlocked.body.code, 'MODE_RESTRICTED');

  // Standalone teen cannot promote environment to adult or view adult course
  const promoSettings = await jsonReq(
    '/api/learning/settings',
    { method: 'PATCH', body: JSON.stringify({ environment: 'young_adults' }) },
    standaloneTeenToken
  );
  assert.equal(promoSettings.status, 403);

  const promoOnboarding = await jsonReq(
    '/api/auth/onboarding',
    {
      method: 'POST',
      body: JSON.stringify({
        displayName: 'Teen Learner',
        ageRange: '18-25',
        environment: 'young_adults',
        cefrLevel: 'B1',
        dailyGoalMinutes: 15,
      }),
    },
    standaloneTeenToken
  );
  assert.equal(promoOnboarding.status, 403);

  const adultCourseCheck = await jsonReq(
    `/api/learning/courses/${adultCourseId}`,
    {},
    standaloneTeenToken
  );
  assert.equal(adultCourseCheck.status, 403);
});

test('Priority 2 & 3: WebSocket pre-upgrade auth, origin check, single-use tickets, and active parental revocation', async () => {
  // 1. Unauthenticated WS rejected before upgrade (401)
  const unauth = await connectWsExpectUpgradeFailure(`${wsBaseUrl}/ws/live`);
  assert.equal(unauth.statusCode, 401);

  // 2. Legacy token in WS URL rejected before upgrade (401)
  const legacyToken = await connectWsExpectUpgradeFailure(
    `${wsBaseUrl}/ws/live?token=${encodeURIComponent(adultToken)}`
  );
  assert.equal(legacyToken.statusCode, 401);

  // 3. Disallowed Origin rejected before upgrade (403)
  const { ticket: validAdultTicket } = issueLiveTicket({
    userId: createdUserIds[1],
    learnerId: adultLearnerId,
    parentId: null,
    environment: 'young_adults',
    ageRange: '18-25',
    cefrLevel: 'A1',
    mode: 'Everyday conversations',
    voiceName: 'Zephyr',
    origin: baseUrl,
  });
  const badOrigin = await connectWsExpectUpgradeFailure(
    `${wsBaseUrl}/ws/live?ticket=${encodeURIComponent(validAdultTicket)}`,
    { Origin: 'https://evil.example' }
  );
  assert.equal(badOrigin.statusCode, 403);

  // 4. Expired ticket rejected before upgrade (401)
  const { ticket: expiredTicket } = issueLiveTicket({
    userId: createdUserIds[1],
    learnerId: adultLearnerId,
    parentId: null,
    environment: 'young_adults',
    ageRange: '18-25',
    cefrLevel: 'A1',
    mode: 'Everyday conversations',
    voiceName: 'Zephyr',
    origin: null,
    ttlMs: -50,
  });
  const expiredRes = await connectWsExpectUpgradeFailure(
    `${wsBaseUrl}/ws/live?ticket=${encodeURIComponent(expiredTicket)}`
  );
  assert.equal(expiredRes.statusCode, 401);

  // 5. Valid child ticket connects over WS, cannot be reused, and is immediately terminated upon consent revocation
  const childTicketRes = await jsonReq(
    '/api/voice/live-ticket',
    {
      method: 'POST',
      body: JSON.stringify({ learnerId: littleVoicesChildId, mode: 'Everyday conversations' }),
    },
    parentToken
  );
  assert.equal(childTicketRes.status, 201);
  const childTicket = childTicketRes.body.ticket as string;

  const wsUrl = `${wsBaseUrl}/ws/live?ticket=${encodeURIComponent(childTicket)}`;
  const activeWs = new WebSocket(wsUrl, { headers: { Origin: baseUrl } });
  const closePromise = new Promise<{ code: number; messages: any[] }>((resolve) => {
    const messages: any[] = [];
    activeWs.on('message', (data) => {
      try {
        messages.push(JSON.parse(data.toString()));
      } catch {
        // ignore
      }
    });
    activeWs.on('close', (code) => resolve({ code, messages }));
  });

  await new Promise<void>((resolve, reject) => {
    activeWs.on('open', () => resolve());
    activeWs.on('error', reject);
  });

  // Reusing the same ticket must fail before upgrade (401)
  const reuseRes = await connectWsExpectUpgradeFailure(wsUrl, { Origin: baseUrl });
  assert.equal(reuseRes.statusCode, 401);

  // Revoke guardian consent -> active Live WS must terminate immediately with safety_restricted
  const revokeRes = await jsonReq('/api/parent/consent/revoke', { method: 'POST', body: '{}' }, parentToken);
  assert.equal(revokeRes.status, 200);
  assert.equal(revokeRes.body.parent.hasActiveConsent, false);

  const closedInfo = await closePromise;
  assert.ok(
    closedInfo.messages.some((m) => m.type === 'safety_restricted') || closedInfo.code === 1008 || closedInfo.code === 1000
  );

  // Subsequent child ticket request is blocked after revocation
  const afterRevokeTicket = await jsonReq(
    '/api/voice/live-ticket',
    {
      method: 'POST',
      body: JSON.stringify({ learnerId: littleVoicesChildId, mode: 'Everyday conversations' }),
    },
    parentToken
  );
  assert.equal(afterRevokeTicket.status, 403);
  assert.equal(afterRevokeTicket.body.code, 'CONSENT_REQUIRED');
});
