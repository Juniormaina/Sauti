import crypto from 'node:crypto';
import type { WebSocket } from 'ws';
import { env } from '../config/env.ts';

export interface LiveTicketPayload {
  jti: string;
  userId: number;
  learnerId: number;
  parentId: number | null;
  environment: string;
  ageRange: string;
  cefrLevel: string;
  mode: string;
  voiceName: string;
  origin: string | null;
  expiresAt: number;
}

const TICKET_TTL_MS = 45_000;
const ticketStore = new Map<string, LiveTicketPayload>();

const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [jti, record] of ticketStore.entries()) {
    if (record.expiresAt <= now) {
      ticketStore.delete(jti);
    }
  }
}, 30_000);
cleanupTimer.unref?.();

function signTicketId(jti: string): string {
  return crypto.createHmac('sha256', env.sessionSecret).update(`live:${jti}`).digest('base64url');
}

export function issueLiveTicket(
  params: Omit<LiveTicketPayload, 'jti' | 'expiresAt'> & { ttlMs?: number }
): { ticket: string; expiresAt: number } {
  const jti = crypto.randomBytes(24).toString('base64url');
  const expiresAt = Date.now() + (params.ttlMs ?? TICKET_TTL_MS);

  const record: LiveTicketPayload = {
    jti,
    userId: params.userId,
    learnerId: params.learnerId,
    parentId: params.parentId,
    environment: params.environment,
    ageRange: params.ageRange,
    cefrLevel: params.cefrLevel,
    mode: params.mode,
    voiceName: params.voiceName,
    origin: params.origin,
    expiresAt,
  };

  ticketStore.set(jti, record);
  const sig = signTicketId(jti);
  return {
    ticket: `${jti}.${sig}`,
    expiresAt,
  };
}

export function consumeLiveTicket(
  rawTicket: string | null | undefined,
  requestOrigin?: string | null
): LiveTicketPayload | null {
  if (!rawTicket || typeof rawTicket !== 'string') return null;
  const parts = rawTicket.split('.');
  if (parts.length !== 2) return null;

  const [jti, providedSig] = parts;
  if (!jti || !providedSig) return null;

  const expectedSig = signTicketId(jti);
  const sigBuf = Buffer.from(providedSig);
  const expectedBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  const record = ticketStore.get(jti);
  if (!record) return null;

  // Single-use guarantee: consume atomically before validation completes.
  ticketStore.delete(jti);

  if (record.expiresAt <= Date.now()) {
    return null;
  }

  if (record.origin && requestOrigin && record.origin !== requestOrigin) {
    return null;
  }

  return record;
}

export function clearLiveTicketStoreForTests() {
  ticketStore.clear();
}

// Active Live WebSocket registry for immediate parental revocation & connection limits
export interface ActiveLiveConnection {
  ws: WebSocket;
  userId: number;
  learnerId: number;
  parentId: number | null;
  ip: string;
  closeWithRestriction: (reason: string) => void;
}

const activeConnections = new Set<ActiveLiveConnection>();

export function countActiveConnectionsForUser(userId: number): number {
  let count = 0;
  for (const conn of activeConnections) {
    if (conn.userId === userId) count += 1;
  }
  return count;
}

export function countActiveConnectionsForIp(ip: string): number {
  let count = 0;
  for (const conn of activeConnections) {
    if (conn.ip === ip) count += 1;
  }
  return count;
}

export function registerActiveLiveConnection(conn: ActiveLiveConnection) {
  activeConnections.add(conn);
}

export function unregisterActiveLiveConnection(conn: ActiveLiveConnection) {
  activeConnections.delete(conn);
}

export function terminateLiveSessionsForParent(parentId: number, reason: string) {
  for (const conn of Array.from(activeConnections)) {
    if (conn.parentId === parentId) {
      conn.closeWithRestriction(reason);
    }
  }
}

export function terminateLiveSessionsForLearner(learnerId: number, reason: string) {
  for (const conn of Array.from(activeConnections)) {
    if (conn.learnerId === learnerId) {
      conn.closeWithRestriction(reason);
    }
  }
}
