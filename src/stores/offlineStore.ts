import { create } from 'zustand';
import {
  clearScopeOfflineData,
  clearSyncQueueForScope,
  enqueueSyncItem,
  listSyncQueue,
  removeSyncItem,
  SyncQueueItem,
  SyncQueueKind,
  updateSyncItem,
} from '../lib/offlineDb';
import { apiFetch, isOfflineOrNetworkError } from '../services/api';

const LOW_BANDWIDTH_KEY = 'sauti_low_bandwidth_mode';

function detectInitialLowBandwidth(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const saved = window.localStorage.getItem(LOW_BANDWIDTH_KEY);
    if (saved === 'true') return true;
    if (saved === 'false') return false;
    const conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return Boolean(conn?.saveData);
  } catch {
    return false;
  }
}

export function createClientAttemptId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `att-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

interface OfflineState {
  isOnline: boolean;
  lowBandwidthMode: boolean;
  activeScopeKey: string | null;
  pendingSyncCount: number;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncMessage: string | null;
  syncError: string | null;
  setLowBandwidthMode: (enabled: boolean) => void;
  setActiveScopeKey: (scopeKey: string | null) => Promise<void>;
  refreshSyncCount: () => Promise<void>;
  queueProgressUpdate: (input: {
    id?: string;
    scopeKey: string;
    learnerId: number | null;
    kind: SyncQueueKind;
    endpoint: string;
    payload: Record<string, unknown>;
    label: string;
  }) => Promise<void>;
  syncPendingQueue: (options?: { silent?: boolean }) => Promise<{ synced: number; remaining: number }>;
  clearPendingQueue: () => Promise<void>;
  clearActiveScopeData: () => Promise<void>;
}

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lowBandwidthMode: detectInitialLowBandwidth(),
  activeScopeKey: null,
  pendingSyncCount: 0,
  isSyncing: false,
  lastSyncedAt: null,
  syncMessage: null,
  syncError: null,

  setLowBandwidthMode: (enabled) => {
    try {
      window.localStorage.setItem(LOW_BANDWIDTH_KEY, enabled ? 'true' : 'false');
    } catch {
      // ignore storage failure
    }
    set({ lowBandwidthMode: enabled });
  },

  setActiveScopeKey: async (scopeKey) => {
    set({ activeScopeKey: scopeKey, syncError: null, syncMessage: null });
    if (!scopeKey) {
      set({ pendingSyncCount: 0 });
      return;
    }
    try {
      const queue = await listSyncQueue(scopeKey);
      set({ pendingSyncCount: queue.length });
    } catch {
      set({ pendingSyncCount: 0 });
    }
  },

  refreshSyncCount: async () => {
    const scopeKey = get().activeScopeKey;
    if (!scopeKey) {
      set({ pendingSyncCount: 0 });
      return;
    }
    try {
      const queue = await listSyncQueue(scopeKey);
      set({ pendingSyncCount: queue.length });
    } catch {
      // ignore
    }
  },

  queueProgressUpdate: async (input) => {
    const item: SyncQueueItem = {
      id: input.id || createClientAttemptId(),
      scopeKey: input.scopeKey,
      learnerId: input.learnerId,
      kind: input.kind,
      endpoint: input.endpoint,
      payload: input.payload,
      label: input.label,
      createdAt: new Date().toISOString(),
      retryCount: 0,
    };
    await enqueueSyncItem(item);
    await get().refreshSyncCount();
  },

  syncPendingQueue: async (options) => {
    const { activeScopeKey, isSyncing, isOnline } = get();
    if (!activeScopeKey || isSyncing || !isOnline) {
      return { synced: 0, remaining: get().pendingSyncCount };
    }

    set({ isSyncing: true, syncError: null });
    if (!options?.silent) {
      set({ syncMessage: null });
    }

    let synced = 0;
    try {
      const queue = await listSyncQueue(activeScopeKey);
      if (queue.length === 0) {
        set({ pendingSyncCount: 0, isSyncing: false });
        return { synced: 0, remaining: 0 };
      }

      for (const item of queue) {
        if (typeof navigator !== 'undefined' && !navigator.onLine) {
          set({ isOnline: false });
          break;
        }
        try {
          await apiFetch(item.endpoint, {
            method: 'POST',
            body: JSON.stringify(item.payload),
            timeoutMs: 25000,
          });
          await removeSyncItem(item.id);
          synced += 1;
        } catch (err: any) {
          if (isOfflineOrNetworkError(err)) {
            await updateSyncItem({
              ...item,
              retryCount: item.retryCount + 1,
              lastError: 'Waiting for internet connection',
            });
            break;
          }

          const status = typeof err?.status === 'number' ? err.status : 0;
          if (status >= 400 && status < 500 && status !== 429 && status !== 408) {
            // Permanent client error (e.g. validation/permission/already invalid) — remove from queue cleanly
            await removeSyncItem(item.id);
            set({
              syncError: `Removed "${item.label}" from sync queue: ${err?.message || 'Server rejected entry.'}`,
            });
          } else {
            await updateSyncItem({
              ...item,
              retryCount: item.retryCount + 1,
              lastError: err?.message || 'Temporary server error',
            });
            set({ syncError: err?.message || 'Some queued updates will retry automatically.' });
            break;
          }
        }
      }

      const remainingList = await listSyncQueue(activeScopeKey);
      set({
        pendingSyncCount: remainingList.length,
        lastSyncedAt: synced > 0 ? new Date().toISOString() : get().lastSyncedAt,
        syncMessage:
          synced > 0
            ? `Synchronised ${synced} offline update${synced === 1 ? '' : 's'}.`
            : get().syncMessage,
      });
      return { synced, remaining: remainingList.length };
    } finally {
      set({ isSyncing: false });
    }
  },

  clearPendingQueue: async () => {
    const scopeKey = get().activeScopeKey;
    if (!scopeKey) return;
    await clearSyncQueueForScope(scopeKey);
    set({ pendingSyncCount: 0, syncMessage: 'Cleared pending offline sync queue.', syncError: null });
  },

  clearActiveScopeData: async () => {
    const scopeKey = get().activeScopeKey;
    if (!scopeKey) return;
    await clearScopeOfflineData(scopeKey);
    set({ pendingSyncCount: 0, syncMessage: 'Cleared locally stored learner data.', syncError: null });
  },
}));

if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    useOfflineStore.setState({ isOnline: true });
    void useOfflineStore.getState().syncPendingQueue({ silent: false });
  });
  window.addEventListener('offline', () => {
    useOfflineStore.setState({ isOnline: false });
  });
}
