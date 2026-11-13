import crypto from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from '../../src/db/index.ts';
import {
  learnerProfiles,
  learningGoals,
  parentProfiles,
  teacherProfiles,
  users,
} from '../../src/db/schema.ts';
import { env } from '../config/env.ts';

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  const [salt, keyHex] = storedHash.split(':');
  if (!salt || !keyHex) return false;
  try {
    const derived = crypto.scryptSync(password, salt, 64);
    const keyBuf = Buffer.from(keyHex, 'hex');
    if (derived.length !== keyBuf.length) return false;
    return crypto.timingSafeEqual(derived, keyBuf);
  } catch {
    return false;
  }
}

export interface SessionPayload {
  userId: number;
  uid: string;
  email: string;
  role: string;
  exp: number;
}

export function signSessionToken(payload: Omit<SessionPayload, 'exp'>, ttlSeconds = 60 * 60 * 24 * 7): string {
  const fullPayload: SessionPayload = {
    ...payload,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const encoded = Buffer.from(JSON.stringify(fullPayload)).toString('base64url');
  const sig = crypto.createHmac('sha256', env.sessionSecret).update(encoded).digest('base64url');
  return `sauti.${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  if (!token || !token.startsWith('sauti.') || token.length > 4096) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  if (!encoded || !sig) return null;

  const expectedSig = crypto.createHmac('sha256', env.sessionSecret).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (
      !parsed ||
      typeof parsed.userId !== 'number' ||
      !Number.isSafeInteger(parsed.userId) ||
      parsed.userId <= 0 ||
      typeof parsed.exp !== 'number' ||
      parsed.exp < Math.floor(Date.now() / 1000)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export async function getOrCreateFirebaseUser(
  uid: string,
  email: string,
  displayName?: string,
  requestedRole = 'LEARNER',
  requestedAccountType = 'individual'
) {
  const safeName = (displayName || email.split('@')[0] || 'Learner').trim().slice(0, 100);
  // Never allow client sync requests to self-assign ADMIN
  const safeRole = ['LEARNER', 'PARENT', 'TEACHER'].includes(requestedRole) ? requestedRole : 'LEARNER';
  const safeAccountType = ['individual', 'parent', 'teacher', 'institution'].includes(requestedAccountType)
    ? requestedAccountType
    : 'individual';

  const [user] = await db
    .insert(users)
    .values({
      uid,
      email: email.toLowerCase().trim(),
      displayName: safeName,
      role: safeRole,
      accountType: safeAccountType,
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: {
        email: email.toLowerCase().trim(),
        updatedAt: new Date(),
      },
    })
    .returning();

  await ensureRoleProfile(user.id, user.role, user.displayName);
  return user;
}

export async function ensureRoleProfile(userId: number, role: string, displayName: string) {
  if (role === 'PARENT') {
    const existing = await db.query.parentProfiles.findFirst({
      where: eq(parentProfiles.userId, userId),
    });
    if (!existing) {
      // Do NOT silently auto-grant guardian consent; explicit acceptance is required.
      await db.insert(parentProfiles).values({
        userId,
        consentAcceptedAt: null,
        consentVersion: null,
        consentRevokedAt: null,
      });
    }
  } else if (role === 'TEACHER') {
    const existing = await db.query.teacherProfiles.findFirst({
      where: eq(teacherProfiles.userId, userId),
    });
    if (!existing) {
      await db.insert(teacherProfiles).values({ userId });
    }
  } else if (role === 'LEARNER') {
    const existing = await db.query.learnerProfiles.findFirst({
      where: eq(learnerProfiles.userId, userId),
    });
    if (!existing) {
      const [learner] = await db
        .insert(learnerProfiles)
        .values({
          userId,
          displayName,
          ageRange: '18-25',
          environment: 'young_adults',
          cefrLevel: 'A1',
        })
        .returning();
      await db.insert(learningGoals).values({
        learnerId: learner.id,
      });
    }
  }
}
