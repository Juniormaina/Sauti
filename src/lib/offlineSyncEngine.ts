import { SyncQueueItem } from './offlineDb';

export interface SyncQueueStorage {
  list(scopeKey: string): Promise<SyncQueueItem[]>;
  update(item: SyncQueueItem): Promise<void>;
  remove(id: string): Promise<void>;
}

export interface SyncTransport {
  submit(endpoint: string, payload: Record<string, unknown>): Promise<any>;
}

export interface SyncRunResult {
  synced: number;
  remaining: number;
  needsAuthRecovery: boolean;
  abortedForScopeChange: boolean;
  deferredCount: number;
  attentionCount: number;
  verifiedItems: Array<{ item: SyncQueueItem; response: any }>;
  syncMessage: string | null;
  syncError: string | null;
}

export type ActivityVerificationState = 'verified' | 'queued_offline' | 'error';

export interface ActivityOutcome {
  verificationStatus: ActivityVerificationState;
  isCorrect: boolean | null;
  score: number | null;
  xpAwarded: number | null;
  feedback: string;
  clientAttemptId?: string;
  alreadyProcessed?: boolean;
  alreadyMastered?: boolean;
}

const AI_EVALUATED_TYPES = new Set(['writing', 'conversation_sim', 'role_play']);

export function buildOfflineActivityOutcome(
  activityType: string,
  clientAttemptId: string
): ActivityOutcome {
  const isAiType = AI_EVALUATED_TYPES.has(activityType);
  return {
    verificationStatus: 'queued_offline',
    isCorrect: null,
    score: null,
    xpAwarded: null,
    clientAttemptId,
    feedback: isAiType
      ? 'Attempted locally — saved offline. Cloud AI evaluation, correctness, and XP require an internet connection and will be verified on sync.'
      : 'Attempted locally — saved offline and queued to sync. Correctness and XP will be verified by SAUTI once your connection returns.',
  };
}

export function buildServerVerifiedActivityOutcome(
  response: {
    isCorrect: boolean;
    score: number;
    xpAwarded?: number;
    feedback: string;
    alreadyProcessed?: boolean;
    alreadyMastered?: boolean;
  },
  clientAttemptId?: string
): ActivityOutcome {
  return {
    verificationStatus: 'verified',
    isCorrect: response.isCorrect,
    score: response.score,
    xpAwarded: response.xpAwarded ?? 0,
    alreadyProcessed: response.alreadyProcessed,
    alreadyMastered: response.alreadyMastered,
    feedback: response.feedback,
    clientAttemptId,
  };
}

export function computeBackoffMs(retryCount: number, retryAfterSeconds?: number): number {
  if (typeof retryAfterSeconds === 'number' && Number.isFinite(retryAfterSeconds) && retryAfterSeconds > 0) {
    return Math.min(300_000, retryAfterSeconds * 1000);
  }
  const exp = Math.min(5, Math.max(0, retryCount));
  return Math.min(60_000, 1000 * 2 ** exp);
}

export function classifySyncError(err: any): {
  kind: 'network' | 'auth' | 'resolution' | 'retryable';
  status: number;
  message: string;
  retryAfterSeconds?: number;
} {
  const status = typeof err?.status === 'number' ? err.status : 0;
  const isNetwork = Boolean(err?.isNetworkError) || status === 0 || err?.name === 'TypeError' || err?.name === 'AbortError';
  const rawMessage = typeof err?.message === 'string' && err.message.trim() ? err.message.trim() : '';

  if (isNetwork) {
    return {
      kind: 'network',
      status: 0,
      message: rawMessage || 'Waiting for internet connection.',
    };
  }
  if (status === 401) {
    return {
      kind: 'auth',
      status: 401,
      message: rawMessage || 'Authentication expired. Sign in again to sync queued progress.',
    };
  }
  if (status === 408 || status === 429 || status >= 500) {
    return {
      kind: 'retryable',
      status,
      message: rawMessage || `Temporary server response (${status}). Will retry with backoff.`,
      retryAfterSeconds: typeof err?.retryAfterSeconds === 'number' ? err.retryAfterSeconds : undefined,
    };
  }
  if (status >= 400 && status < 500) {
    return {
      kind: 'resolution',
      status,
      message: rawMessage || `Request could not be accepted (${status}). Review or retry manually.`,
    };
  }
  return {
    kind: 'retryable',
    status,
    message: rawMessage || 'Temporary error while syncing.',
  };
}

export async function runScopedQueueSync(params: {
  targetScopeKey: string;
  getActiveScopeKey: () => string | null;
  isOnline: () => boolean;
  storage: SyncQueueStorage;
  transport: SyncTransport;
  now?: () => number;
  forceRetryAll?: boolean;
  onlyItemId?: string;
}): Promise<SyncRunResult> {
  const {
    targetScopeKey,
    getActiveScopeKey,
    isOnline,
    storage,
    transport,
    now = () => Date.now(),
    forceRetryAll = false,
    onlyItemId,
  } = params;

  const queue = await storage.list(targetScopeKey);
  if (queue.length === 0) {
    return {
      synced: 0,
      remaining: 0,
      needsAuthRecovery: false,
      abortedForScopeChange: false,
      deferredCount: 0,
      attentionCount: 0,
      verifiedItems: [],
      syncMessage: null,
      syncError: null,
    };
  }

  let synced = 0;
  let needsAuthRecovery = false;
  let abortedForScopeChange = false;
  let deferredCount = 0;
  const verifiedItems: Array<{ item: SyncQueueItem; response: any }> = [];
  const errors: string[] = [];

  for (const item of queue) {
    if (onlyItemId && item.id !== onlyItemId) {
      continue;
    }

    if (getActiveScopeKey() !== targetScopeKey) {
      abortedForScopeChange = true;
      break;
    }

    if (!isOnline()) {
      break;
    }

    if (item.scopeKey !== targetScopeKey) {
      continue;
    }

    if (item.status === 'needs_resolution' && !forceRetryAll && !onlyItemId) {
      continue;
    }

    if (!forceRetryAll && !onlyItemId && item.nextRetryAt) {
      const retryTs = Date.parse(item.nextRetryAt);
      if (!Number.isNaN(retryTs) && retryTs > now()) {
        deferredCount += 1;
        continue;
      }
    }

    try {
      const response = await transport.submit(item.endpoint, item.payload);

      // Server confirmed 2xx for this scoped item: remove only after confirmation
      await storage.remove(item.id);
      synced += 1;
      verifiedItems.push({ item, response });

      if (getActiveScopeKey() !== targetScopeKey) {
        abortedForScopeChange = true;
        break;
      }
    } catch (err: any) {
      const classified = classifySyncError(err);

      if (classified.kind === 'network') {
        const nextRetryCount = item.retryCount + 1;
        await storage.update({
          ...item,
          status: 'pending',
          retryCount: nextRetryCount,
          lastStatusCode: 0,
          lastError: classified.message,
          nextRetryAt: new Date(now() + computeBackoffMs(nextRetryCount)).toISOString(),
        });
        break;
      }

      if (classified.kind === 'auth') {
        await storage.update({
          ...item,
          status: 'auth_required',
          lastStatusCode: 401,
          lastError: classified.message,
        });
        needsAuthRecovery = true;
        errors.push(classified.message);
        break;
      }

      if (classified.kind === 'resolution') {
        // NEVER delete 403/validation items automatically — preserve with clear explanation
        await storage.update({
          ...item,
          status: 'needs_resolution',
          lastStatusCode: classified.status,
          lastError: classified.message,
        });
        errors.push(`${item.label}: ${classified.message}`);
        continue;
      }

      // 408 / 429 / 5xx -> keep in queue with backoff and stop further pressure
      const nextRetryCount = item.retryCount + 1;
      await storage.update({
        ...item,
        status: 'pending',
        retryCount: nextRetryCount,
        lastStatusCode: classified.status,
        lastError: classified.message,
        nextRetryAt: new Date(
          now() + computeBackoffMs(nextRetryCount, classified.retryAfterSeconds)
        ).toISOString(),
      });
      errors.push(`${item.label}: ${classified.message}`);
      break;
    }
  }

  const remainingList = await storage.list(targetScopeKey);
  const attentionCount = remainingList.filter(
    (q) => q.status === 'needs_resolution' || q.status === 'auth_required'
  ).length;
  if (remainingList.some((q) => q.status === 'auth_required')) {
    needsAuthRecovery = true;
  }

  return {
    synced,
    remaining: remainingList.length,
    needsAuthRecovery,
    abortedForScopeChange,
    deferredCount,
    attentionCount,
    verifiedItems,
    syncMessage:
      synced > 0 ? `Synchronised and verified ${synced} offline update${synced === 1 ? '' : 's'}.` : null,
    syncError: errors.length > 0 ? errors[0] : null,
  };
}
