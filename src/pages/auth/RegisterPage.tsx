import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { signInWithPopup } from 'firebase/auth';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { PublicHeader } from '../../components/navigation/PublicHeader';
import { firebaseAuth, googleAuthProvider } from '../../lib/firebase';
import { apiFetch } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { AccountType, LearningEnvironment } from '../../types/sauti';
import { ENVIRONMENTS } from '../../utils/environments';

const schema = z.object({
  displayName: z.string().min(2, 'Please enter at least 2 characters'),
  email: z.string().email('Enter a valid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  accountType: z.enum(['individual', 'parent', 'teacher', 'institution']),
  environment: z.enum([
    'little_voices',
    'young_explorers',
    'teen_voices',
    'young_adults',
    'professional_english',
    'lifelong_english',
  ]),
  parentConsentAccepted: z.boolean().optional(),
});

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const setSession = useAuthStore((s) => s.setSession);
  const [serverError, setServerError] = useState<string | null>(null);
  const [googleLoading, setGoogleLoading] = useState(false);

  const initialAccountType = (searchParams.get('accountType') as AccountType) || 'individual';
  const initialEnv = (searchParams.get('environment') as LearningEnvironment) || 'young_adults';

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      displayName: '',
      email: '',
      password: '',
      accountType: ['individual', 'parent', 'teacher', 'institution'].includes(initialAccountType)
        ? initialAccountType
        : 'individual',
      environment: ENVIRONMENTS.some((e) => e.id === initialEnv) ? initialEnv : 'young_adults',
      parentConsentAccepted: false,
    },
  });

  const watchedAccountType = watch('accountType');
  const watchedEnvironment = watch('environment');
  const isChildEnvironment =
    watchedEnvironment === 'little_voices' || watchedEnvironment === 'young_explorers';

  const routeAfterAuth = (role: string, onboardingCompleted?: boolean) => {
    if (role === 'PARENT') navigate('/parent/dashboard');
    else if (role === 'TEACHER') navigate('/teacher/dashboard');
    else if (role === 'ADMIN') navigate('/admin/dashboard');
    else if (!onboardingCompleted) navigate('/onboarding/profile');
    else navigate('/learn/dashboard');
  };

  const onSubmit = async (values: FormValues) => {
    setServerError(null);
    if (isChildEnvironment && values.accountType === 'individual') {
      setServerError(
        'Learners under 13 cannot self-register as individual accounts. Please select Parent / Guardian above to create a family-managed profile.'
      );
      return;
    }

    try {
      const res = await apiFetch<any>('/api/auth/register', {
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
      routeAfterAuth(res.user.role, res.learnerProfile?.onboardingCompleted);
    } catch (err: any) {
      setServerError(err.message || 'Unable to create account.');
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
        body: JSON.stringify({
          accountType: watchedAccountType,
          environment: watchedEnvironment,
        }),
      });
      setSession({
        token: null,
        user: res.user,
        learnerProfile: res.learnerProfile,
        parentProfile: res.parentProfile,
        teacherProfile: res.teacherProfile,
      });
      routeAfterAuth(res.user.role, res.learnerProfile?.onboardingCompleted);
    } catch (err: any) {
      setServerError(err.message || 'Google Sign-In did not complete.');
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#FFF8ED] text-[#17201C]">
      <PublicHeader />
      <main className="max-w-lg mx-auto px-4 py-12">
        <div className="rounded-3xl bg-white border border-[#245C45]/12 p-7 sm:p-9">
          <h1 className="font-display text-3xl font-bold mb-2">Create your SAUTI account</h1>
          <p className="text-sm text-[#4A5851] mb-6">
            Begin your voice-first English journey for yourself, your child, or your classroom.
          </p>

          {serverError && (
            <div className="mb-5 rounded-xl bg-[#F28B75]/15 border border-[#F28B75] p-3.5 flex items-start gap-2.5 text-sm text-[#17201C]">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-[#B43C25]" />
              <span>{serverError}</span>
            </div>
          )}

          <button
            type="button"
            disabled={googleLoading}
            onClick={handleGoogleSignIn}
            className="w-full py-3 px-4 rounded-xl border border-[#245C45]/25 font-semibold text-sm text-[#17201C] hover:bg-[#FDF3E3] transition-colors mb-5"
          >
            {googleLoading ? 'Connecting Google account...' : 'Continue with Google'}
          </button>

          <div className="relative flex items-center justify-center mb-5">
            <span className="border-t border-[#245C45]/12 w-full" />
            <span className="px-3 text-xs text-[#4A5851] bg-white whitespace-nowrap">
              or register with email
            </span>
            <span className="border-t border-[#245C45]/12 w-full" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#245C45] mb-1.5">
                Account Type
              </label>
              <select
                {...register('accountType')}
                className="w-full rounded-xl border border-[#245C45]/20 bg-[#FFF8ED]/40 px-3.5 py-2.5 text-sm"
              >
                <option value="individual">Individual Learner</option>
                <option value="parent">Parent / Guardian (for Children)</option>
                <option value="teacher">Teacher</option>
                <option value="institution">School / Institution</option>
              </select>
            </div>

            {watchedAccountType === 'individual' && (
              <div>
                <label className="block text-xs font-semibold text-[#245C45] mb-1.5">
                  Learning Environment
                </label>
                <select
                  {...register('environment')}
                  className="w-full rounded-xl border border-[#245C45]/20 bg-[#FFF8ED]/40 px-3.5 py-2.5 text-sm"
                >
                  {ENVIRONMENTS.map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.title} (Ages {env.ageRange})
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold text-[#245C45] mb-1.5">
                Full Name or Display Name
              </label>
              <input
                type="text"
                {...register('displayName')}
                placeholder="e.g. Amara Kamau"
                className="w-full rounded-xl border border-[#245C45]/20 px-3.5 py-2.5 text-sm"
              />
              {errors.displayName && (
                <p className="text-xs text-[#B43C25] mt-1">{errors.displayName.message}</p>
              )}
            </div>

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
              <label className="block text-xs font-semibold text-[#245C45] mb-1.5">
                Password (8+ characters)
              </label>
              <input
                type="password"
                {...register('password')}
                placeholder="Create a secure password"
                className="w-full rounded-xl border border-[#245C45]/20 px-3.5 py-2.5 text-sm"
              />
              {errors.password && (
                <p className="text-xs text-[#B43C25] mt-1">{errors.password.message}</p>
              )}
            </div>

            {(isChildEnvironment || watchedAccountType === 'parent') && (
              <label className="flex items-start gap-2.5 rounded-xl bg-[#FFF1E6] p-3.5 text-xs text-[#17201C] cursor-pointer">
                <input
                  type="checkbox"
                  {...register('parentConsentAccepted')}
                  className="mt-0.5 accent-[#245C45]"
                />
                <span>
                  <ShieldCheck className="w-3.5 h-3.5 inline mr-1 text-[#245C45]" />
                  I confirm I am a parent or legal guardian consenting to child-safe voice practice
                  with no public child profiles or unrestricted stranger messaging.
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 rounded-xl bg-[#245C45] text-[#FFF8ED] font-semibold text-sm hover:bg-[#194231] transition-colors disabled:opacity-60"
            >
              {isSubmitting ? 'Creating account...' : 'Create SAUTI account'}
            </button>
          </form>

          <p className="text-center text-xs text-[#4A5851] mt-6">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-[#245C45] hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
