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
import { runScopedQueueSync } from '../lib/offlineSyncEngine';
import { apiFetch } from '../services/api';

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

let inFlightSyncPromise: Promise<{ synced: number; remaining: number }> | null = null;

interface OfflineState {
  isOnline: boolean;
  lowBandwidthMode: boolean;
  activeScopeKey: string | null;
  pendingSyncCount: number;
  queuedItems: SyncQueueItem[];
  needsAuthRecovery: boolean;
  verifiedByEndpoint: Record<string, any>;
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
  syncPendingQueue: (options?: {
    silent?: boolean;
    forceRetryAll?: boolean;
  }) => Promise<{ synced: number; remaining: number }>;
  retryQueueItem: (id: string) => Promise<void>;
  dismissQueueItem: (id: string) => Promise<void>;
  clearPendingQueue: () => Promise<void>;
  clearActiveScopeData: () => Promise<void>;
}

const syncStorageAdapter = {
  list: listSyncQueue,
  update: updateSyncItem,
  remove: removeSyncItem,
};

const syncTransportAdapter = {
  submit: (endpoint: string, payload: Record<string, unknown>) =>
    apiFetch(endpoint, {
      method: 'POST',
      body: JSON.stringify(payload),
      timeoutMs: 25000,
    }),
};

export const useOfflineStore = create<OfflineState>((set, get) => ({
  isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
  lowBandwidthMode: detectInitialLowBandwidth(),
  activeScopeKey: null,
  pendingSyncCount: 0,
  queuedItems: [],
  needsAuthRecovery: false,
  verifiedByEndpoint: {},
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
    set({
      activeScopeKey: scopeKey,
      syncError: null,
      syncMessage: null,
    });
    if (!scopeKey) {
      set({ pendingSyncCount: 0, queuedItems: [], needsAuthRecovery: false });
      return;
    }
    try {
      const queue = await listSyncQueue(scopeKey);
      if (get().activeScopeKey !== scopeKey) return;
      set({
        queuedItems: queue,
        pendingSyncCount: queue.length,
        needsAuthRecovery: queue.some((q) => q.status === 'auth_required'),
      });
    } catch {
      if (get().activeScopeKey !== scopeKey) return;
      set({ queuedItems: [], pendingSyncCount: 0, needsAuthRecovery: false });
    }
  },

  refreshSyncCount: async () => {
    const scopeKey = get().activeScopeKey;
    if (!scopeKey) {
      set({ pendingSyncCount: 0, queuedItems: [], needsAuthRecovery: false });
      return;
    }
    try {
      const queue = await listSyncQueue(scopeKey);
      if (get().activeScopeKey !== scopeKey) return;
      set({
        queuedItems: queue,
        pendingSyncCount: queue.length,
        needsAuthRecovery: queue.some((q) => q.status === 'auth_required'),
      });
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
      status: 'pending',
    };
    await enqueueSyncItem(item);
    await get().refreshSyncCount();
  },

  syncPendingQueue: async (options) => {
    if (inFlightSyncPromise) {
      return inFlightSyncPromise;
    }

    const targetScopeKey = get().activeScopeKey;
    const currentlyOnline =
      get().isOnline && (typeof navigator === 'undefined' || navigator.onLine);
    if (!targetScopeKey || !currentlyOnline) {
      return { synced: 0, remaining: get().pendingSyncCount };
    }

    const runPromise = (async () => {
      set({ isSyncing: true, syncError: null });
      if (!options?.silent) {
        set({ syncMessage: null });
      }

      try {
        const result = await runScopedQueueSync({
          targetScopeKey,
          getActiveScopeKey: () => get().activeScopeKey,
          isOnline: () =>
            get().isOnline && (typeof navigator === 'undefined' || navigator.onLine),
          storage: syncStorageAdapter,
          transport: syncTransportAdapter,
          forceRetryAll: options?.forceRetryAll ?? false,
        });

        // If user switched learner/account mid-sync, do not touch the new scope's state
        if (result.abortedForScopeChange || get().activeScopeKey !== targetScopeKey) {
          return { synced: result.synced, remaining: result.remaining };
        }

        const remainingList = await listSyncQueue(targetScopeKey);
        if (get().activeScopeKey !== targetScopeKey) {
          return { synced: result.synced, remaining: result.remaining };
        }

        const nextVerified = { ...get().verifiedByEndpoint };
        for (const entry of result.verifiedItems) {
          nextVerified[`${targetScopeKey}::${entry.item.endpoint}`] = entry.response;
          nextVerified[`${targetScopeKey}::attempt::${entry.item.id}`] = entry.response;
        }

        set({
          queuedItems: remainingList,
          pendingSyncCount: remainingList.length,
          needsAuthRecovery: result.needsAuthRecovery,
          verifiedByEndpoint: nextVerified,
          lastSyncedAt: result.synced > 0 ? new Date().toISOString() : get().lastSyncedAt,
          syncMessage:
            result.synced > 0
              ? result.syncMessage
              : options?.silent
              ? get().syncMessage
              : null,
          syncError: result.syncError,
        });

        return { synced: result.synced, remaining: remainingList.length };
      } finally {
        inFlightSyncPromise = null;
        set({ isSyncing: false });
      }
    })();

    inFlightSyncPromise = runPromise;
    return runPromise;
  },

  retryQueueItem: async (id) => {
    if (inFlightSyncPromise) {
      await inFlightSyncPromise.catch(() => {});
    }
    const targetScopeKey = get().activeScopeKey;
    const currentlyOnline =
      get().isOnline && (typeof navigator === 'undefined' || navigator.onLine);
    if (!targetScopeKey || !currentlyOnline) return;

    const existing = get().queuedItems.find((q) => q.id === id);
    if (existing) {
      await updateSyncItem({
        ...existing,
        status: 'pending',
        nextRetryAt: undefined,
      });
    }

    set({ isSyncing: true, syncError: null });
    try {
      const result = await runScopedQueueSync({
        targetScopeKey,
        getActiveScopeKey: () => get().activeScopeKey,
        isOnline: () =>
          get().isOnline && (typeof navigator === 'undefined' || navigator.onLine),
        storage: syncStorageAdapter,
        transport: syncTransportAdapter,
        forceRetryAll: true,
        onlyItemId: id,
      });

      if (result.abortedForScopeChange || get().activeScopeKey !== targetScopeKey) {
        return;
      }

      const remainingList = await listSyncQueue(targetScopeKey);
      if (get().activeScopeKey !== targetScopeKey) return;

      const nextVerified = { ...get().verifiedByEndpoint };
      for (const entry of result.verifiedItems) {
        nextVerified[`${targetScopeKey}::${entry.item.endpoint}`] = entry.response;
        nextVerified[`${targetScopeKey}::attempt::${entry.item.id}`] = entry.response;
      }

      set({
        queuedItems: remainingList,
        pendingSyncCount: remainingList.length,
        needsAuthRecovery: remainingList.some((q) => q.status === 'auth_required'),
        verifiedByEndpoint: nextVerified,
        lastSyncedAt: result.synced > 0 ? new Date().toISOString() : get().lastSyncedAt,
        syncMessage: result.syncMessage,
        syncError: result.syncError,
      });
    } finally {
      set({ isSyncing: false });
    }
  },

  dismissQueueItem: async (id) => {
    await removeSyncItem(id);
    await get().refreshSyncCount();
    set({ syncError: null });
  },

  clearPendingQueue: async () => {
    const scopeKey = get().activeScopeKey;
    if (!scopeKey) return;
    await clearSyncQueueForScope(scopeKey);
    set({
      queuedItems: [],
      pendingSyncCount: 0,
      needsAuthRecovery: false,
      syncMessage: 'Cleared pending offline sync queue.',
      syncError: null,
    });
  },

  clearActiveScopeData: async () => {
    const scopeKey = get().activeScopeKey;
    if (!scopeKey) return;
    await clearScopeOfflineData(scopeKey);
    set({
      queuedItems: [],
      pendingSyncCount: 0,
      needsAuthRecovery: false,
      verifiedByEndpoint: {},
      syncMessage: 'Cleared locally stored learner data.',
      syncError: null,
    });
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
