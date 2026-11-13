import { create } from 'zustand';
import { LearnerProfile, ParentProfile, SautiUser, TeacherProfile } from '../types/sauti';

interface AuthState {
  token: string | null;
  user: SautiUser | null;
  learnerProfile: LearnerProfile | null;
  parentProfile: ParentProfile | null;
  teacherProfile: TeacherProfile | null;
  activeChildId: number | null;
  isInitialized: boolean;
  setSession: (payload: {
    token?: string | null;
    user: SautiUser | null;
    learnerProfile?: LearnerProfile | null;
    parentProfile?: ParentProfile | null;
    teacherProfile?: TeacherProfile | null;
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
    })),
  setLearnerProfile: (learnerProfile) => set({ learnerProfile }),
  setActiveChildId: (activeChildId) => set({ activeChildId }),
  setInitialized: (isInitialized) => set({ isInitialized }),
  logout: () =>
    set({
      token: null,
      user: null,
      learnerProfile: null,
      parentProfile: null,
      teacherProfile: null,
      activeChildId: null,
    }),
}));
