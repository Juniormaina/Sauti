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
  const derived = crypto.scryptSync(password, salt, 64);
  const keyBuf = Buffer.from(keyHex, 'hex');
  if (derived.length !== keyBuf.length) return false;
  return crypto.timingSafeEqual(derived, keyBuf);
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
  if (!token.startsWith('sauti.')) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [, encoded, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', env.sessionSecret).update(encoded).digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as SessionPayload;
    if (parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function getOrCreateFirebaseUser(
  uid: string,
  email: string,
  displayName?: string,
  role = 'LEARNER',
  accountType = 'individual'
) {
  const safeName = displayName || email.split('@')[0] || 'Learner';
  const [user] = await db
    .insert(users)
    .values({
      uid,
      email,
      displayName: safeName,
      role,
      accountType,
    })
    .onConflictDoUpdate({
      target: users.uid,
      set: {
        email,
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
      await db.insert(parentProfiles).values({
        userId,
        consentAcceptedAt: new Date(),
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
