import { ReactNode, useEffect } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { firebaseAuth } from './lib/firebase';
import { apiFetch } from './services/api';
import { useAuthStore } from './stores/authStore';
import { UserRole } from './types/sauti';

import { HomePage } from './pages/marketing/HomePage';
import { GetStartedPage } from './pages/marketing/GetStartedPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { LoginPage } from './pages/auth/LoginPage';
import { ForgotPasswordPage } from './pages/auth/ForgotPasswordPage';
import { OnboardingFlow } from './pages/onboarding/OnboardingFlow';

import { LearnerLayoutSwitch } from './app/layouts/LearnerLayoutSwitch';
import { LearnerDashboardPage } from './pages/learner/LearnerDashboardPage';
import { CoursesLibraryPage } from './pages/learner/CoursesLibraryPage';
import { CourseDetailPage, ModuleDetailPage } from './pages/learner/CourseDetailPage';
import { LessonDetailPage } from './pages/learner/LessonDetailPage';
import { SkillHubPage } from './pages/learner/SkillHubPage';
import {
  LearnerAchievementsPage,
  LearnerHistoryPage,
  LearnerProfileSettingsPage,
  LearnerProgressPage,
} from './pages/learner/LearnerInsightsPages';
import { VoiceStudioPage } from './pages/voice/VoiceStudioPage';

import { ParentDashboardPage } from './pages/parent/ParentPages';
import { TeacherPortalPage } from './pages/teacher/TeacherPages';
import { AdminPortalPage } from './pages/admin/AdminPages';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, isInitialized } = useAuthStore();
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-[#FFF8ED] flex items-center justify-center text-sm text-[#4A5851]">
        Loading SAUTI workspace...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user, isInitialized } = useAuthStore();
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-[#FFF8ED] flex items-center justify-center text-sm text-[#4A5851]">
        Verifying access...
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/learn/dashboard" replace />;
  return <>{children}</>;
}

function LearnerRoute({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <LearnerLayoutSwitch>{children}</LearnerLayoutSwitch>
    </RequireAuth>
  );
}

export default function App() {
  const { setSession, setInitialized } = useAuthStore();

  useEffect(() => {
    const unsub = onAuthStateChanged(firebaseAuth, async (fbUser) => {
      if (fbUser) {
        try {
          const idToken = await fbUser.getIdToken();
          const res = await apiFetch<any>('/api/auth/firebase-sync', {
            method: 'POST',
            headers: { Authorization: `Bearer ${idToken}` },
          });
          setSession({
            user: res.user,
            learnerProfile: res.learnerProfile,
            parentProfile: res.parentProfile,
            teacherProfile: res.teacherProfile,
          });
        } catch {
          // ignore silent sync error
        }
      }
      setInitialized(true);
    });
    return () => unsub();
  }, [setInitialized, setSession]);

  return (
    <BrowserRouter>
      <Routes>
        {/* Public Marketing Website */}
        <Route path="/" element={<HomePage />} />
        <Route path="/get-started" element={<GetStartedPage />} />

        {/* Authentication & Onboarding */}
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/onboarding" element={<RequireAuth><OnboardingFlow /></RequireAuth>} />
        <Route path="/onboarding/profile" element={<RequireAuth><OnboardingFlow /></RequireAuth>} />
        <Route path="/onboarding/assessment" element={<RequireAuth><OnboardingFlow /></RequireAuth>} />
        <Route path="/onboarding/goals" element={<RequireAuth><OnboardingFlow /></RequireAuth>} />

        {/* Learner Routes (age-tailored via LearnerLayoutSwitch) */}
        <Route path="/learn/dashboard" element={<LearnerRoute><LearnerDashboardPage /></LearnerRoute>} />
        <Route path="/learn/courses" element={<LearnerRoute><CoursesLibraryPage /></LearnerRoute>} />
        <Route path="/learn/courses/:id" element={<LearnerRoute><CourseDetailPage /></LearnerRoute>} />
        <Route path="/learn/modules/:id" element={<LearnerRoute><ModuleDetailPage /></LearnerRoute>} />
        <Route path="/learn/lessons/:id" element={<LearnerRoute><LessonDetailPage /></LearnerRoute>} />
        <Route path="/learn/speaking" element={<LearnerRoute><VoiceStudioPage /></LearnerRoute>} />
        <Route path="/learn/listening" element={<LearnerRoute><SkillHubPage skill="Listening" /></LearnerRoute>} />
        <Route path="/learn/reading" element={<LearnerRoute><SkillHubPage skill="Reading" /></LearnerRoute>} />
        <Route path="/learn/writing" element={<LearnerRoute><SkillHubPage skill="Writing" /></LearnerRoute>} />
        <Route path="/learn/vocabulary" element={<LearnerRoute><SkillHubPage skill="Vocabulary" /></LearnerRoute>} />
        <Route path="/learn/grammar" element={<LearnerRoute><SkillHubPage skill="Grammar" /></LearnerRoute>} />
        <Route path="/learn/challenges" element={<LearnerRoute><SkillHubPage skill="Challenges" /></LearnerRoute>} />
        <Route path="/learn/achievements" element={<LearnerRoute><LearnerAchievementsPage /></LearnerRoute>} />
        <Route path="/learn/progress" element={<LearnerRoute><LearnerProgressPage /></LearnerRoute>} />
        <Route path="/learn/history" element={<LearnerRoute><LearnerHistoryPage /></LearnerRoute>} />
        <Route path="/learn/profile" element={<LearnerRoute><LearnerProfileSettingsPage /></LearnerRoute>} />
        <Route path="/learn/settings" element={<LearnerRoute><LearnerProfileSettingsPage /></LearnerRoute>} />

        {/* Parent Portal */}
        <Route path="/parent/dashboard" element={<RequireRole roles={['PARENT', 'ADMIN']}><ParentDashboardPage section="overview" /></RequireRole>} />
        <Route path="/parent/children" element={<RequireRole roles={['PARENT', 'ADMIN']}><ParentDashboardPage section="children" /></RequireRole>} />
        <Route path="/parent/children/:id" element={<RequireRole roles={['PARENT', 'ADMIN']}><ParentDashboardPage section="children" /></RequireRole>} />
        <Route path="/parent/reports" element={<RequireRole roles={['PARENT', 'ADMIN']}><ParentDashboardPage section="reports" /></RequireRole>} />
        <Route path="/parent/settings" element={<RequireRole roles={['PARENT', 'ADMIN']}><ParentDashboardPage section="settings" /></RequireRole>} />

        {/* Teacher & School Portal */}
        <Route path="/teacher/dashboard" element={<RequireRole roles={['TEACHER', 'ADMIN']}><TeacherPortalPage /></RequireRole>} />
        <Route path="/teacher/classrooms" element={<RequireRole roles={['TEACHER', 'ADMIN']}><TeacherPortalPage /></RequireRole>} />
        <Route path="/teacher/classrooms/:id" element={<RequireRole roles={['TEACHER', 'ADMIN']}><TeacherPortalPage /></RequireRole>} />
        <Route path="/teacher/learners" element={<RequireRole roles={['TEACHER', 'ADMIN']}><TeacherPortalPage /></RequireRole>} />
        <Route path="/teacher/reports" element={<RequireRole roles={['TEACHER', 'ADMIN']}><TeacherPortalPage /></RequireRole>} />

        {/* Protected Admin Area */}
        <Route path="/admin/dashboard" element={<RequireRole roles={['ADMIN']}><AdminPortalPage section="dashboard" /></RequireRole>} />
        <Route path="/admin/users" element={<RequireRole roles={['ADMIN']}><AdminPortalPage section="users" /></RequireRole>} />
        <Route path="/admin/courses" element={<RequireRole roles={['ADMIN']}><AdminPortalPage section="courses" /></RequireRole>} />
        <Route path="/admin/modules" element={<RequireRole roles={['ADMIN']}><AdminPortalPage section="modules" /></RequireRole>} />
        <Route path="/admin/lessons" element={<RequireRole roles={['ADMIN']}><AdminPortalPage section="lessons" /></RequireRole>} />
        <Route path="/admin/activities" element={<RequireRole roles={['ADMIN']}><AdminPortalPage section="activities" /></RequireRole>} />
        <Route path="/admin/settings" element={<RequireRole roles={['ADMIN']}><AdminPortalPage section="settings" /></RequireRole>} />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
