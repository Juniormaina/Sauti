import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signInWithPopup } from 'firebase/auth';
import { AlertCircle } from 'lucide-react';
import { PublicHeader } from '../../components/navigation/PublicHeader';
import { firebaseAuth, googleAuthProvider } from '../../lib/firebase';
import { apiFetch } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { PageTransition } from '../../components/motion/SautiMotion';

const schema = z.object({
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
});

type FormValues = z.infer<typeof schema>;

export function LoginPage() {
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
  });

  const routeAfterLogin = (role: string, onboardingCompleted?: boolean) => {
    if (role === 'PARENT') navigate('/parent/dashboard');
    else if (role === 'TEACHER') navigate('/teacher/dashboard');
    else if (role === 'ADMIN') navigate('/admin/dashboard');
    else if (!onboardingCompleted) navigate('/onboarding/profile');
    else navigate('/learn/dashboard');
  };

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    try {
      const res = await apiFetch<any>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      setSession({
        token: res.token,
        user: res.user,
        learnerProfile: res.learnerProfile,
        parentProfile: res.parentProfile,
        teacherProfile: res.teacherProfile,
      });
      routeAfterLogin(res.user.role, res.learnerProfile?.onboardingCompleted);
    } catch (err: any) {
      setServerError(err.message || 'Sign in failed.');
    }
  };

  const handleGoogleSignIn = async () => {
    setServerError(null);
    setGoogleLoading(true);
    try {
      const cred = await signInWithPopup(firebaseAuth, googleAuthProvider);
      const idToken = await cred.user.getIdToken();
      const res = await apiFetch<any>('/api/auth/firebase-sync', {
        method: 'POST',
        headers: { Authorization: `Bearer ${idToken}` },
      });
      setSession({
        token: null,
        user: res.user,
        learnerProfile: res.learnerProfile,
        parentProfile: res.parentProfile,
        teacherProfile: res.teacherProfile,
      });
      routeAfterLogin(res.user.role, res.learnerProfile?.onboardingCompleted);
    } catch (err: any) {
      setServerError(err.message || 'Google Sign-In could not complete.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8ED] bg-warm-grid text-[#17201C]">
      <PublicHeader />
      <PageTransition>
        <main className="max-w-md mx-auto px-4 py-14">
          <div className="rounded-3xl sauti-surface p-7 sm:p-9">
          <h1 className="font-display text-3xl font-bold mb-2">Welcome back</h1>
          <p className="text-sm text-[#4A5851] mb-6">
            Sign in to continue your lessons and Voice Studio sessions.
          </p>

          {serverError && (
            <div className="mb-5 rounded-xl bg-[#F28B75]/15 border border-[#F28B75] p-3.5 flex items-start gap-2.5 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#B43C25]" />
              <span>{serverError}</span>
            </div>
          )}

          <button
            type="button"
            disabled={googleLoading}
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-4 rounded-xl border border-[#245C45]/25 font-semibold text-sm hover:bg-[#FDF3E3] transition-colors mb-5"
          >
            {googleLoading ? 'Signing in with Google...' : 'Sign in with Google'}
          </button>

          <div className="relative flex items-center justify-center mb-5">
            <span className="border-t border-[#245C45]/12 w-full" />
            <span className="px-3 text-xs text-[#4A5851] bg-white whitespace-nowrap">
              or use your email
            </span>
            <span className="border-t border-[#245C45]/12 w-full" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#245C45] mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                {...register('email')}
                placeholder="you@example.com"
                className="w-full rounded-xl border border-[#245C45]/20 px-3.5 py-2.5 text-sm"
              />
              {errors.email && <p className="text-xs text-[#B43C25] mt-1">{errors.email.message}</p>}
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-[#245C45]">Password</label>
                <Link to="/forgot-password" className="text-xs text-[#245C45] hover:underline">
                  Forgot password?
                </Link>
              </div>
              <input
                type="password"
                {...register('password')}
                placeholder="Enter your password"
                className="w-full rounded-xl border border-[#245C45]/20 px-3.5 py-2.5 text-sm"
              />
              {errors.password && (
                <p className="text-xs text-[#B43C25] mt-1">{errors.password.message}</p>
              )}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-[#245C45] text-[#FFF8ED] font-semibold text-sm hover:bg-[#194231] transition-colors disabled:opacity-60"
            >
              {isSubmitting ? 'Signing in...' : 'Sign in'}
            </button>
          </form>

          <p className="text-center text-xs text-[#4A5851] mt-6">
            New to SAUTI?{' '}
            <Link to="/get-started" className="font-semibold text-[#245C45] hover:underline">
              Choose a learning journey
            </Link>
          </p>
        </div>
      </main>
      </PageTransition>
    </div>
  );
}
