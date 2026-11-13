import { NextFunction, Request, Response } from 'express';
import { eq } from 'drizzle-orm';
import { adminAuth } from '../../src/lib/firebase-admin.ts';
import { db } from '../../src/db/index.ts';
import { users } from '../../src/db/schema.ts';
import { getOrCreateFirebaseUser, verifySessionToken } from '../services/authService.ts';

export interface AuthUserContext {
  id: number;
  uid: string;
  email: string;
  displayName: string;
  role: string;
  accountType: string;
}

export interface AuthRequest extends Request {
  authUser?: AuthUserContext;
}

const MAX_TOKEN_LENGTH = 4096;

export async function authenticateToken(token: string): Promise<AuthUserContext | null> {
  if (!token || typeof token !== 'string' || token.length > MAX_TOKEN_LENGTH) {
    return null;
  }

  // 1. Check SAUTI signed HMAC session token (email/password login)
  if (token.startsWith('sauti.')) {
    const payload = verifySessionToken(token);
    if (!payload) return null;
    const [user] = await db.select().from(users).where(eq(users.id, payload.userId)).limit(1);
    if (!user) return null;
    return {
      id: user.id,
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      accountType: user.accountType,
    };
  }

  // 2. Otherwise verify Firebase Auth ID Token
  try {
    const decoded = await adminAuth.verifyIdToken(token);
    const user = await getOrCreateFirebaseUser(
      decoded.uid,
      decoded.email || `${decoded.uid}@firebase.local`,
      decoded.name
    );
    return {
      id: user.id,
      uid: user.uid,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      accountType: user.accountType,
    };
  } catch {
    return null;
  }
}

export const optionalAuth = async (req: AuthRequest, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.slice('Bearer '.length).trim();
    if (token) {
      const authUser = await authenticateToken(token);
      if (authUser) {
        req.authUser = authUser;
      }
    }
  }
  next();
};

export const requireAuth = async (req: AuthRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authentication required.' });
  }

  const token = authHeader.slice('Bearer '.length).trim();
  const authUser = await authenticateToken(token);
  if (!authUser) {
    return res.status(401).json({ error: 'Invalid or expired session.' });
  }

  req.authUser = authUser;
  next();
};

export const requireRole = (...allowedRoles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.authUser) {
      return res.status(401).json({ error: 'Authentication required.' });
    }
    if (!allowedRoles.includes(req.authUser.role)) {
      return res.status(403).json({
        error: 'Access restricted for this account role.',
      });
    }
    next();
  };
};
