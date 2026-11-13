import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import http from 'node:http';
import { eq, inArray } from 'drizzle-orm';
import { db } from '../src/db/index.ts';
import {
  activities,
  classrooms,
  learnerProfiles,
  lessons,
  parentProfiles,
  passwordResets,
  users,
} from '../src/db/schema.ts';
import { createSautiApp } from '../server/app.ts';
import { ensureSeeded } from '../server/services/seedService.ts';
import { hashPassword } from '../server/services/authService.ts';

let server: http.Server;
let baseUrl = '';

const createdUserIds: number[] = [];
const createdResetEmails: string[] = [];

let tokenLearnerA = '';
let learnerAId = 0;
let tokenLearnerB = '';
let learnerBId = 0;
let tokenParentA = '';
let childAId = 0;
let tokenParentB = '';
let childBId = 0;
let tokenTeacherA = '';
let classroomAId = 0;
let tokenTeacherB = '';
let classroomBId = 0;
let tokenAdmin = '';
let sampleActivityId = 0;
let sampleLessonId = 0;

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

before(async () => {
  await ensureSeeded();
  const app = createSautiApp();
  server = http.createServer(app);
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const addr = server.address() as { port: number };
  baseUrl = `http://127.0.0.1:${addr.port}`;

  const suffix = crypto.randomBytes(4).toString('hex');

  // Register Learner A & Learner B
  const regA = await jsonReq('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `learner-a-${suffix}@test.local`,
      password: 'Password123!',
      displayName: 'Learner A',
      accountType: 'individual',
      environment: 'young_adults',
    }),
  });
  assert.equal(regA.status, 201);
  tokenLearnerA = regA.body.token;
  learnerAId = regA.body.learnerProfile.id;
  createdUserIds.push(regA.body.user.id);

  const regB = await jsonReq('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `learner-b-${suffix}@test.local`,
      password: 'Password123!',
      displayName: 'Learner B',
      accountType: 'individual',
      environment: 'young_adults',
    }),
  });
  assert.equal(regB.status, 201);
  tokenLearnerB = regB.body.token;
  learnerBId = regB.body.learnerProfile.id;
  createdUserIds.push(regB.body.user.id);

  // Register Parent A & Parent B with explicit consent and create child A (userId: null) and child B
  const parA = await jsonReq('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `parent-a-${suffix}@test.local`,
      password: 'Password123!',
      displayName: 'Parent A',
      accountType: 'parent',
      parentConsentAccepted: true,
    }),
  });
  assert.equal(parA.status, 201);
  tokenParentA = parA.body.token;
  createdUserIds.push(parA.body.user.id);

  const cA = await jsonReq(
    '/api/parent/children',
    {
      method: 'POST',
      body: JSON.stringify({
        displayName: 'Child A',
        environment: 'young_explorers',
        cefrLevel: 'A1',
        consentConfirmed: true,
      }),
    },
    tokenParentA
  );
  assert.equal(cA.status, 201);
  childAId = cA.body.child.id;
  assert.equal(cA.body.child.userId, null);

  const parB = await jsonReq('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `parent-b-${suffix}@test.local`,
      password: 'Password123!',
      displayName: 'Parent B',
      accountType: 'parent',
      parentConsentAccepted: true,
    }),
  });
  assert.equal(parB.status, 201);
  tokenParentB = parB.body.token;
  createdUserIds.push(parB.body.user.id);

  const cB = await jsonReq(
    '/api/parent/children',
    {
      method: 'POST',
      body: JSON.stringify({
        displayName: 'Child B',
        environment: 'little_voices',
        cefrLevel: 'A1',
        consentConfirmed: true,
      }),
    },
    tokenParentB
  );
  assert.equal(cB.status, 201);
  childBId = cB.body.child.id;

  // Register Teacher A & Teacher B
  const tA = await jsonReq('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `teacher-a-${suffix}@test.local`,
      password: 'Password123!',
      displayName: 'Teacher A',
      accountType: 'teacher',
    }),
  });
  assert.equal(tA.status, 201);
  tokenTeacherA = tA.body.token;
  createdUserIds.push(tA.body.user.id);

  const clsA = await jsonReq(
    '/api/teacher/classrooms',
    {
      method: 'POST',
      body: JSON.stringify({ name: 'Class A', environment: 'teen_voices', cefrLevel: 'A2' }),
    },
    tokenTeacherA
  );
  assert.equal(clsA.status, 201);
  classroomAId = clsA.body.classroom.id;

  const tB = await jsonReq('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({
      email: `teacher-b-${suffix}@test.local`,
      password: 'Password123!',
      displayName: 'Teacher B',
      accountType: 'teacher',
    }),
  });
  assert.equal(tB.status, 201);
  tokenTeacherB = tB.body.token;
  createdUserIds.push(tB.body.user.id);

  const clsB = await jsonReq(
    '/api/teacher/classrooms',
    {
      method: 'POST',
      body: JSON.stringify({ name: 'Class B', environment: 'teen_voices', cefrLevel: 'A2' }),
    },
    tokenTeacherB
  );
  assert.equal(clsB.status, 201);
  classroomBId = clsB.body.classroom.id;

  // Create Admin user directly in DB and log in
  const adminEmail = `admin-${suffix}@test.local`;
  const [adminRow] = await db
    .insert(users)
    .values({
      uid: `local:admin-${suffix}`,
      email: adminEmail,
      passwordHash: hashPassword('Password123!'),
      displayName: 'Test Admin',
      role: 'ADMIN',
      accountType: 'individual',
    })
    .returning();
  createdUserIds.push(adminRow.id);

  const adminLogin = await jsonReq('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: adminEmail, password: 'Password123!' }),
  });
  assert.equal(adminLogin.status, 200);
  tokenAdmin = adminLogin.body.token;

  // Pick a real seeded lesson + its activities (from young_explorers or little_voices so child A can also use it)
  const [act] = await db.select().from(activities).limit(1);
  assert.ok(act);
  sampleActivityId = act.id;
  sampleLessonId = act.lessonId;
});

after(async () => {
  if (createdResetEmails.length > 0) {
    await db.delete(passwordResets).where(inArray(passwordResets.email, createdResetEmails));
  }
  if (createdUserIds.length > 0) {
    // Deleting parent/learner/teacher users cascades cleanly; also remove orphaned child profiles tied to parents
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

test('Priority 1.1: Learner A can access their own profile and progress', async () => {
  const dash = await jsonReq('/api/learning/dashboard', {}, tokenLearnerA);
  assert.equal(dash.status, 200);
  assert.equal(dash.body.learner.id, learnerAId);

  const hist = await jsonReq('/api/learning/history', {}, tokenLearnerA);
  assert.equal(hist.status, 200);
  assert.ok(Array.isArray(hist.body.attempts));
});

test('Priority 1.2: Learner A cannot access Learner B profile or progress (IDOR blocked)', async () => {
  const dash = await jsonReq(`/api/learning/dashboard?learnerId=${learnerBId}`, {}, tokenLearnerA);
  assert.equal(dash.status, 404);

  const dashMissing = await jsonReq('/api/learning/dashboard?learnerId=99999999', {}, tokenLearnerA);
  assert.equal(dashMissing.status, 404);
  assert.equal(dash.body.error, dashMissing.body.error);

  const hist = await jsonReq(`/api/learning/history?learnerId=${learnerBId}`, {}, tokenLearnerA);
  assert.equal(hist.status, 404);

  const voiceHist = await jsonReq(`/api/voice/history?learnerId=${learnerBId}`, {}, tokenLearnerA);
  assert.equal(voiceHist.status, 404);
});

test('Priority 1.3: Learner A cannot submit activity attempts for Learner B', async () => {
  const res = await jsonReq(
    `/api/learning/activities/${sampleActivityId}/attempt`,
    {
      method: 'POST',
      body: JSON.stringify({ learnerId: learnerBId, answer: 'test' }),
    },
    tokenLearnerA
  );
  assert.equal(res.status, 404);
});

test('Priority 1.4: Learner A cannot complete lessons for Learner B', async () => {
  const res = await jsonReq(
    `/api/learning/lessons/${sampleLessonId}/complete`,
    {
      method: 'POST',
      body: JSON.stringify({ learnerId: learnerBId, minutesSpent: 5 }),
    },
    tokenLearnerA
  );
  assert.equal(res.status, 404);
});

test('Priority 1.5 & 1.8: Parent A can access and operate their own nullable-userId child', async () => {
  const detail = await jsonReq(`/api/parent/children/${childAId}`, {}, tokenParentA);
  assert.equal(detail.status, 200);
  assert.equal(detail.body.child.id, childAId);

  const dash = await jsonReq(`/api/learning/dashboard?learnerId=${childAId}`, {}, tokenParentA);
  assert.equal(dash.status, 200);
  assert.equal(dash.body.learner.id, childAId);

  // Complete all activities in sampleLessonId as Parent A acting for Child A, then complete lesson
  const lessonActs = await db
    .select()
    .from(activities)
    .where(eq(activities.lessonId, sampleLessonId));
  for (const act of lessonActs) {
    const att = await jsonReq(
      `/api/learning/activities/${act.id}/attempt`,
      {
        method: 'POST',
        body: JSON.stringify({ learnerId: childAId, answer: 'hello' }),
      },
      tokenParentA
    );
    assert.equal(att.status, 200);
  }

  const complete = await jsonReq(
    `/api/learning/lessons/${sampleLessonId}/complete`,
    {
      method: 'POST',
      body: JSON.stringify({ learnerId: childAId, minutesSpent: 10 }),
    },
    tokenParentA
  );
  assert.equal(complete.status, 200);
  assert.equal(complete.body.completed, true);
});

test('Priority 1.6: Parent A cannot access Parent B child', async () => {
  const pDetail = await jsonReq(`/api/parent/children/${childBId}`, {}, tokenParentA);
  assert.equal(pDetail.status, 404);

  const lDash = await jsonReq(`/api/learning/dashboard?learnerId=${childBId}`, {}, tokenParentA);
  assert.equal(lDash.status, 404);

  const vLog = await jsonReq(
    '/api/voice/speak-log',
    {
      method: 'POST',
      body: JSON.stringify({ learnerId: childBId, transcript: 'hijack attempt' }),
    },
    tokenParentA
  );
  assert.equal(vLog.status, 404);
});

test('Priority 1.7: Unauthenticated requests are rejected', async () => {
  assert.equal((await jsonReq('/api/learning/dashboard')).status, 401);
  assert.equal(
    (
      await jsonReq(`/api/learning/activities/${sampleActivityId}/attempt`, {
        method: 'POST',
        body: JSON.stringify({ answer: 'a' }),
      })
    ).status,
    401
  );
  assert.equal(
    (
      await jsonReq(`/api/learning/lessons/${sampleLessonId}/complete`, {
        method: 'POST',
        body: JSON.stringify({}),
      })
    ).status,
    401
  );
  assert.equal((await jsonReq('/api/parent/dashboard')).status, 401);
  assert.equal((await jsonReq('/api/teacher/dashboard')).status, 401);
  assert.equal((await jsonReq('/api/admin/stats')).status, 401);
});

test('Priority 7: Teacher classroom IDOR, Admin safe user fields, and atomic password reset', async () => {
  // Teacher A can view Class A, cannot view or mutate Class B
  assert.equal((await jsonReq(`/api/teacher/classrooms/${classroomAId}`, {}, tokenTeacherA)).status, 200);
  assert.equal((await jsonReq(`/api/teacher/classrooms/${classroomBId}`, {}, tokenTeacherA)).status, 404);
  assert.equal(
    (
      await jsonReq(
        `/api/teacher/classrooms/${classroomBId}/learners`,
        { method: 'POST', body: JSON.stringify({ displayName: 'Unauth Student' }) },
        tokenTeacherA
      )
    ).status,
    404
  );

  // Admin role update never leaks passwordHash and rejects self-demotion
  const roleRes = await jsonReq(
    `/api/admin/users/${createdUserIds[0]}/role`,
    { method: 'PATCH', body: JSON.stringify({ role: 'LEARNER' }) },
    tokenAdmin
  );
  assert.equal(roleRes.status, 200);
  assert.equal('passwordHash' in roleRes.body.user, false);

  const selfDemote = await jsonReq(
    `/api/admin/users/${createdUserIds[createdUserIds.length - 1]}/role`,
    { method: 'PATCH', body: JSON.stringify({ role: 'LEARNER' }) },
    tokenAdmin
  );
  assert.equal(selfDemote.status, 400);

  // Atomic single-use password reset
  const [userRow] = await db.select().from(users).where(eq(users.id, createdUserIds[0])).limit(1);
  const rawToken = crypto.randomBytes(16).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  createdResetEmails.push(userRow.email);
  await db.insert(passwordResets).values({
    email: userRow.email,
    tokenHash,
    expiresAt: new Date(Date.now() + 60_000),
  });

  const reset1 = await jsonReq('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token: rawToken, newPassword: 'NewPassword123!' }),
  });
  assert.equal(reset1.status, 200);

  const reset2 = await jsonReq('/api/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token: rawToken, newPassword: 'AnotherPassword123!' }),
  });
  assert.equal(reset2.status, 400);
});
