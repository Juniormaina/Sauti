import { Activity, Course, Lesson, Module, Programme } from '../types/sauti';

const DB_NAME = 'sauti_offline_v1';
const DB_VERSION = 1;

export const LOCAL_RECORDING_MAX_BYTES = 25 * 1024 * 1024; // 25 MB cap per learner scope

export interface OfflineLessonRecord {
  storageKey: string;
  scopeKey: string;
  lessonId: number;
  courseId: number | null;
  lesson: Lesson;
  module: Module | null;
  course: Course | null;
  activities: Activity[];
  downloadedAt: string;
  sizeBytes: number;
}

export interface OfflineCourseRecord {
  storageKey: string;
  scopeKey: string;
  courseId: number;
  course: Course;
  programme: Programme | null;
  modules: Array<Module & { lessons: Lesson[] }>;
  downloadedAt: string;
  sizeBytes: number;
}

export interface OfflineListeningRecord {
  storageKey: string;
  scopeKey: string;
  itemId: string;
  category: string;
  title: string;
  text: string;
  downloadedAt: string;
}

export type SyncQueueKind = 'activity_attempt' | 'lesson_complete';

export interface SyncQueueItem {
  id: string;
  scopeKey: string;
  learnerId: number | null;
  kind: SyncQueueKind;
  endpoint: string;
  payload: Record<string, unknown>;
  label: string;
  createdAt: string;
  retryCount: number;
  lastError?: string;
}

export interface LocalRecordingItem {
  id: string;
  scopeKey: string;
  title: string;
  targetText?: string;
  audioBlob: Blob;
  mimeType: string;
  durationSeconds: number;
  sizeBytes: number;
  createdAt: string;
  consentConfirmed: boolean;
  uploadedAt?: string;
}

export interface ScopeStorageSummary {
  lessonCount: number;
  courseCount: number;
  listeningCount: number;
  recordingCount: number;
  pendingSyncCount: number;
  totalBytes: number;
}

export function buildOfflineScopeKey(
  userId: number | null | undefined,
  learnerId: number | null | undefined
): string {
  const u = userId ?? 'guest';
  const l = learnerId ?? 'default';
  return `u:${u}:l:${l}`;
}

function hasIndexedDb(): boolean {
  return typeof window !== 'undefined' && typeof window.indexedDB !== 'undefined';
}

function openOfflineDb(): Promise<IDBDatabase> {
  if (!hasIndexedDb()) {
    return Promise.reject(new Error('IndexedDB is unavailable in this browser.'));
  }

  return new Promise((resolve, reject) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('downloaded_lessons')) {
        const s = db.createObjectStore('downloaded_lessons', { keyPath: 'storageKey' });
        s.createIndex('byScope', 'scopeKey', { unique: false });
      }
      if (!db.objectStoreNames.contains('downloaded_courses')) {
        const s = db.createObjectStore('downloaded_courses', { keyPath: 'storageKey' });
        s.createIndex('byScope', 'scopeKey', { unique: false });
      }
      if (!db.objectStoreNames.contains('downloaded_listening')) {
        const s = db.createObjectStore('downloaded_listening', { keyPath: 'storageKey' });
        s.createIndex('byScope', 'scopeKey', { unique: false });
      }
      if (!db.objectStoreNames.contains('sync_queue')) {
        const s = db.createObjectStore('sync_queue', { keyPath: 'id' });
        s.createIndex('byScope', 'scopeKey', { unique: false });
      }
      if (!db.objectStoreNames.contains('local_recordings')) {
        const s = db.createObjectStore('local_recordings', { keyPath: 'id' });
        s.createIndex('byScope', 'scopeKey', { unique: false });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error('Unable to open offline storage.'));
  });
}

function runTx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>
): Promise<T> {
  return openOfflineDb().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const tx = db.transaction(storeName, mode);
        const store = tx.objectStore(storeName);
        const req = fn(store);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error || new Error('Offline storage operation failed.'));
        tx.oncomplete = () => db.close();
        tx.onerror = () => db.close();
      })
  );
}

function getAllByScope<T>(storeName: string, scopeKey: string): Promise<T[]> {
  if (!hasIndexedDb()) return Promise.resolve([]);
  return openOfflineDb().then(
    (db) =>
      new Promise<T[]>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readonly');
        const store = tx.objectStore(storeName);
        const index = store.index('byScope');
        const req = index.getAll(IDBKeyRange.only(scopeKey));
        req.onsuccess = () => resolve((req.result as T[]) || []);
        req.onerror = () => reject(req.error || new Error('Unable to read offline storage.'));
        tx.oncomplete = () => db.close();
      })
  );
}

function deleteAllByScope(storeName: string, scopeKey: string): Promise<void> {
  if (!hasIndexedDb()) return Promise.resolve();
  return openOfflineDb().then(
    (db) =>
      new Promise<void>((resolve, reject) => {
        const tx = db.transaction(storeName, 'readwrite');
        const store = tx.objectStore(storeName);
        const index = store.index('byScope');
        const req = index.openCursor(IDBKeyRange.only(scopeKey));
        req.onsuccess = () => {
          const cursor = req.result;
          if (cursor) {
            cursor.delete();
            cursor.continue();
          }
        };
        tx.oncomplete = () => {
          db.close();
          resolve();
        };
        tx.onerror = () => {
          db.close();
          reject(tx.error || new Error('Unable to clear offline store.'));
        };
      })
  );
}

function estimateJsonSize(obj: unknown): number {
  try {
    return new Blob([JSON.stringify(obj)]).size;
  } catch {
    return 0;
  }
}

async function assertStorageBudget(additionalBytes: number): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      if (typeof est.quota === 'number' && typeof est.usage === 'number') {
        const remaining = est.quota - est.usage;
        if (remaining < additionalBytes + 1024 * 1024) {
          throw new Error(
            'Device browser storage is nearly full. Delete old offline lessons or recordings before saving more.'
          );
        }
      }
    } catch (err) {
      if (err instanceof Error && err.message.includes('nearly full')) throw err;
    }
  }
}

// --- Downloaded Lessons ---

export async function saveOfflineLesson(
  scopeKey: string,
  payload: {
    lesson: Lesson;
    module: Module | null;
    course: Course | null;
    activities: Activity[];
  }
): Promise<OfflineLessonRecord> {
  const sizeBytes = estimateJsonSize(payload);
  await assertStorageBudget(sizeBytes);
  const record: OfflineLessonRecord = {
    storageKey: `${scopeKey}::lesson::${payload.lesson.id}`,
    scopeKey,
    lessonId: payload.lesson.id,
    courseId: payload.course?.id ?? null,
    lesson: payload.lesson,
    module: payload.module,
    course: payload.course,
    activities: payload.activities,
    downloadedAt: new Date().toISOString(),
    sizeBytes,
  };
  await runTx('downloaded_lessons', 'readwrite', (s) => s.put(record));
  return record;
}

export async function getOfflineLesson(
  scopeKey: string,
  lessonId: number
): Promise<OfflineLessonRecord | null> {
  if (!hasIndexedDb()) return null;
  const record = await runTx<OfflineLessonRecord | undefined>('downloaded_lessons', 'readonly', (s) =>
    s.get(`${scopeKey}::lesson::${lessonId}`)
  );
  return record || null;
}

export async function listOfflineLessons(scopeKey: string): Promise<OfflineLessonRecord[]> {
  const rows = await getAllByScope<OfflineLessonRecord>('downloaded_lessons', scopeKey);
  return rows.sort((a, b) => b.downloadedAt.localeCompare(a.downloadedAt));
}

export async function removeOfflineLesson(scopeKey: string, lessonId: number): Promise<void> {
  if (!hasIndexedDb()) return;
  await runTx('downloaded_lessons', 'readwrite', (s) =>
    s.delete(`${scopeKey}::lesson::${lessonId}`)
  );
}

// --- Downloaded Courses ---

export async function saveOfflineCourse(
  scopeKey: string,
  payload: {
    course: Course;
    programme: Programme | null;
    modules: Array<Module & { lessons: Lesson[] }>;
  }
): Promise<OfflineCourseRecord> {
  const sizeBytes = estimateJsonSize(payload);
  await assertStorageBudget(sizeBytes);
  const record: OfflineCourseRecord = {
    storageKey: `${scopeKey}::course::${payload.course.id}`,
    scopeKey,
    courseId: payload.course.id,
    course: payload.course,
    programme: payload.programme,
    modules: payload.modules,
    downloadedAt: new Date().toISOString(),
    sizeBytes,
  };
  await runTx('downloaded_courses', 'readwrite', (s) => s.put(record));
  return record;
}

export async function getOfflineCourse(
  scopeKey: string,
  courseId: number
): Promise<OfflineCourseRecord | null> {
  if (!hasIndexedDb()) return null;
  const record = await runTx<OfflineCourseRecord | undefined>('downloaded_courses', 'readonly', (s) =>
    s.get(`${scopeKey}::course::${courseId}`)
  );
  return record || null;
}

export async function listOfflineCourses(scopeKey: string): Promise<OfflineCourseRecord[]> {
  return getAllByScope<OfflineCourseRecord>('downloaded_courses', scopeKey);
}

export async function removeOfflineCourse(scopeKey: string, courseId: number): Promise<void> {
  if (!hasIndexedDb()) return;
  await runTx('downloaded_courses', 'readwrite', (s) =>
    s.delete(`${scopeKey}::course::${courseId}`)
  );
}

// --- Downloadable Listening Exercises ---

export async function saveOfflineListeningItem(
  scopeKey: string,
  item: { itemId: string; category: string; title: string; text: string }
): Promise<OfflineListeningRecord> {
  const record: OfflineListeningRecord = {
    storageKey: `${scopeKey}::listen::${item.itemId}`,
    scopeKey,
    itemId: item.itemId,
    category: item.category,
    title: item.title,
    text: item.text,
    downloadedAt: new Date().toISOString(),
  };
  await runTx('downloaded_listening', 'readwrite', (s) => s.put(record));
  return record;
}

export async function listOfflineListeningItems(scopeKey: string): Promise<OfflineListeningRecord[]> {
  return getAllByScope<OfflineListeningRecord>('downloaded_listening', scopeKey);
}

export async function removeOfflineListeningItem(scopeKey: string, itemId: string): Promise<void> {
  if (!hasIndexedDb()) return;
  await runTx('downloaded_listening', 'readwrite', (s) =>
    s.delete(`${scopeKey}::listen::${itemId}`)
  );
}

// --- Pending Sync Queue ---

export async function enqueueSyncItem(item: SyncQueueItem): Promise<void> {
  await runTx('sync_queue', 'readwrite', (s) => s.put(item));
}

export async function listSyncQueue(scopeKey: string): Promise<SyncQueueItem[]> {
  const rows = await getAllByScope<SyncQueueItem>('sync_queue', scopeKey);
  return rows.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export async function updateSyncItem(item: SyncQueueItem): Promise<void> {
  await runTx('sync_queue', 'readwrite', (s) => s.put(item));
}

export async function removeSyncItem(id: string): Promise<void> {
  if (!hasIndexedDb()) return;
  await runTx('sync_queue', 'readwrite', (s) => s.delete(id));
}

export async function clearSyncQueueForScope(scopeKey: string): Promise<void> {
  await deleteAllByScope('sync_queue', scopeKey);
}

// --- Local Voice Recordings ---

export async function saveLocalRecording(
  scopeKey: string,
  input: {
    title: string;
    targetText?: string;
    audioBlob: Blob;
    mimeType: string;
    durationSeconds: number;
    consentConfirmed: boolean;
  }
): Promise<LocalRecordingItem> {
  const existing = await listLocalRecordings(scopeKey);
  const currentBytes = existing.reduce((sum, item) => sum + item.sizeBytes, 0);
  if (currentBytes + input.audioBlob.size > LOCAL_RECORDING_MAX_BYTES) {
    throw new Error(
      'Local offline recording storage limit (25 MB) reached. Remove older local recordings before saving another.'
    );
  }
  await assertStorageBudget(input.audioBlob.size);

  const id =
    typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `rec-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

  const record: LocalRecordingItem = {
    id,
    scopeKey,
    title: input.title,
    targetText: input.targetText,
    audioBlob: input.audioBlob,
    mimeType: input.mimeType,
    durationSeconds: input.durationSeconds,
    sizeBytes: input.audioBlob.size,
    createdAt: new Date().toISOString(),
    consentConfirmed: input.consentConfirmed,
  };
  await runTx('local_recordings', 'readwrite', (s) => s.put(record));
  return record;
}

export async function listLocalRecordings(scopeKey: string): Promise<LocalRecordingItem[]> {
  const rows = await getAllByScope<LocalRecordingItem>('local_recordings', scopeKey);
  return rows.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function markLocalRecordingUploaded(id: string): Promise<void> {
  if (!hasIndexedDb()) return;
  const existing = await runTx<LocalRecordingItem | undefined>('local_recordings', 'readonly', (s) =>
    s.get(id)
  );
  if (!existing) return;
  await runTx('local_recordings', 'readwrite', (s) =>
    s.put({ ...existing, uploadedAt: new Date().toISOString() })
  );
}

export async function removeLocalRecording(id: string): Promise<void> {
  if (!hasIndexedDb()) return;
  await runTx('local_recordings', 'readwrite', (s) => s.delete(id));
}

// --- Storage Summary & Cleanup ---

export async function getScopeStorageSummary(scopeKey: string): Promise<ScopeStorageSummary> {
  const [lessons, courses, listening, recordings, queue] = await Promise.all([
    listOfflineLessons(scopeKey),
    listOfflineCourses(scopeKey),
    listOfflineListeningItems(scopeKey),
    listLocalRecordings(scopeKey),
    listSyncQueue(scopeKey),
  ]);

  const totalBytes =
    lessons.reduce((sum, l) => sum + (l.sizeBytes || 0), 0) +
    courses.reduce((sum, c) => sum + (c.sizeBytes || 0), 0) +
    recordings.reduce((sum, r) => sum + (r.sizeBytes || 0), 0);

  return {
    lessonCount: lessons.length,
    courseCount: courses.length,
    listeningCount: listening.length,
    recordingCount: recordings.length,
    pendingSyncCount: queue.length,
    totalBytes,
  };
}

export async function clearScopeOfflineData(scopeKey: string): Promise<void> {
  await Promise.all([
    deleteAllByScope('downloaded_lessons', scopeKey),
    deleteAllByScope('downloaded_courses', scopeKey),
    deleteAllByScope('downloaded_listening', scopeKey),
    deleteAllByScope('sync_queue', scopeKey),
    deleteAllByScope('local_recordings', scopeKey),
  ]);
}

export async function clearAllOfflineData(): Promise<void> {
  if (!hasIndexedDb()) return;
  const db = await openOfflineDb();
  const stores = [
    'downloaded_lessons',
    'downloaded_courses',
    'downloaded_listening',
    'sync_queue',
    'local_recordings',
  ];
  await Promise.all(
    stores.map(
      (name) =>
        new Promise<void>((resolve, reject) => {
          const tx = db.transaction(name, 'readwrite');
          tx.objectStore(name).clear();
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error || new Error(`Failed clearing ${name}`));
        })
    )
  );
  db.close();
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
