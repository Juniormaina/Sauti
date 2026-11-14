import { create } from 'zustand';
import { LearnerProfile, ParentProfile, SautiUser, TeacherProfile } from '../types/sauti';

const OFFLINE_PROFILE_KEY = 'sauti_offline_profile_v1';

export interface OfflineProfileSnapshot {
  uid: string;
  user: SautiUser;
  learnerProfile: LearnerProfile | null;
  parentProfile: ParentProfile | null;
  teacherProfile: TeacherProfile | null;
  savedAt: string;
}

export function persistOfflineProfileSnapshot(snapshot: OfflineProfileSnapshot) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(OFFLINE_PROFILE_KEY, JSON.stringify(snapshot));
  } catch {
    // ignore storage failures
  }
}

export function readOfflineProfileSnapshot(uid: string): OfflineProfileSnapshot | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(OFFLINE_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineProfileSnapshot;
    if (parsed?.uid !== uid || !parsed?.user) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearOfflineProfileSnapshot() {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(OFFLINE_PROFILE_KEY);
  } catch {
    // ignore
  }
}

interface AuthState {
  token: string | null;
  user: SautiUser | null;
  learnerProfile: LearnerProfile | null;
  parentProfile: ParentProfile | null;
  teacherProfile: TeacherProfile | null;
  activeChildId: number | null;
  isInitialized: boolean;
  isOfflineSession: boolean;
  setSession: (payload: {
    token?: string | null;
    user: SautiUser | null;
    learnerProfile?: LearnerProfile | null;
    parentProfile?: ParentProfile | null;
    teacherProfile?: TeacherProfile | null;
    isOfflineSession?: boolean;
  }) => void;
  setLearnerProfile: (profile: LearnerProfile | null) => void;
  setActiveChildId: (id: number | null) => void;
  setInitialized: (val: boolean) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  user: null,
  learnerProfile: null,
  parentProfile: null,
  teacherProfile: null,
  activeChildId: null,
  isInitialized: false,
  isOfflineSession: false,
  setSession: (payload) =>
    set((state) => ({
      token: payload.token !== undefined ? payload.token : state.token,
      user: payload.user,
      learnerProfile:
        payload.learnerProfile !== undefined ? payload.learnerProfile : state.learnerProfile,
      parentProfile:
        payload.parentProfile !== undefined ? payload.parentProfile : state.parentProfile,
      teacherProfile:
        payload.teacherProfile !== undefined ? payload.teacherProfile : state.teacherProfile,
      isOfflineSession: payload.isOfflineSession ?? false,
    })),
  setLearnerProfile: (learnerProfile) => set({ learnerProfile }),
  setActiveChildId: (activeChildId) => set({ activeChildId }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  logout: () => {
    clearOfflineProfileSnapshot();
    set({
      token: null,
      user: null,
      learnerProfile: null,
      parentProfile: null,
      teacherProfile: null,
      activeChildId: null,
      isOfflineSession: false,
    });
  },
}));
