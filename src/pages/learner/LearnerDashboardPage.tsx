import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Flame,
  Headphones,
  Mic,
  Sparkles,
  Target,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { apiFetch } from '../../services/api';
import { getEnvironmentMeta, SAUTI_IMAGES } from '../../utils/environments';
import { ResilientImage } from '../../components/ui/ResilientImage';
import { AchievementItem, Course, Lesson, VoicePracticeSession } from '../../types/sauti';

interface DashboardData {
  learner: any;
  goal: any;
  recommendedCourses: Course[];
  recommendedLessons: Lesson[];
  completedLessonsCount: number;
  totalLessonsCount: number;
  achievements: AchievementItem[];
  recentVoiceSessions: VoicePracticeSession[];
}

export function LearnerDashboardPage() {
  const { learnerProfile, activeChildId } = useAuthStore();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const envMeta = getEnvironmentMeta(data?.learner?.environment || learnerProfile?.environment);
  const isKids = envMeta.layoutGroup === 'kids';

  useEffect(() => {
    setLoading(true);
    const qs = activeChildId ? `?learnerId=${activeChildId}` : '';
    apiFetch<DashboardData>(`/api/learning/dashboard${qs}`)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => setError(err.message || 'Unable to load dashboard'))
      .finally(() => setLoading(false));
  }, [activeChildId]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-36 rounded-3xl bg-[#245C45]/10" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="h-44 rounded-2xl bg-[#245C45]/10" />
          <div className="h-44 rounded-2xl bg-[#245C45]/10" />
          <div className="h-44 rounded-2xl bg-[#245C45]/10" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl bg-[#F28B75]/15 border border-[#F28B75] p-6 text-sm">
        {error}
      </div>
    );
  }

  const learner = data?.learner || learnerProfile;
  const completedCount = data?.completedLessonsCount ?? 0;
  const totalCount = Math.max(1, data?.totalLessonsCount ?? 1);
  const completionPct = Math.round((completedCount / totalCount) * 100);
  const nextLesson =
    data?.recommendedLessons?.find((l) => !l.completed) || data?.recommendedLessons?.[0];

  return (
    <div className="space-y-8">
      {/* Hero Welcome Banner */}
      <motion.section
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-3xl p-6 sm:p-8 border grid grid-cols-1 lg:grid-cols-12 gap-6 items-center ${
          isKids
            ? 'bg-[#FFF1E6] border-[#F28B75]/40'
            : envMeta.layoutGroup === 'teen'
            ? 'bg-[#245C45] text-[#FFF8ED] border-[#245C45]'
            : 'bg-white border-[#245C45]/12'
        }`}
      >
        <div className="lg:col-span-8 space-y-3">
          <p className={`text-xs font-semibold ${envMeta.layoutGroup === 'teen' ? 'text-[#F6C96B]' : 'text-[#245C45]'}`}>
            {envMeta.title} · Level {learner?.cefrLevel || 'A1'} · Daily goal {learner?.dailyGoalMinutes || 15} min
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold headline-balance">
            {isKids
              ? `Hello ${learner?.displayName || 'Explorer'}! Ready to hear and speak today?`
              : `Welcome back, ${learner?.displayName || 'Learner'}.`}
          </h1>
          <p className={`text-sm sm:text-base max-w-2xl ${envMeta.layoutGroup === 'teen' ? 'text-[#FFF8ED]/85' : 'text-[#4A5851]'}`}>
            {data?.goal?.title || 'Speak with confidence and build steady daily English rhythm.'}
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            {nextLesson && (
              <Link
                to={`/learn/lessons/${nextLesson.id}`}
                className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm transition-colors ${
                  envMeta.layoutGroup === 'teen'
                    ? 'bg-[#F6C96B] text-[#17201C] hover:bg-[#f8d487]'
                    : 'bg-[#245C45] text-[#FFF8ED] hover:bg-[#194231]'
                }`}
              >
                <span>Continue: {nextLesson.title}</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
            )}
            <Link
              to="/learn/speaking"
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm border transition-colors ${
                envMeta.layoutGroup === 'teen'
                  ? 'border-white/25 text-[#FFF8ED] hover:bg-white/10'
                  : 'border-[#245C45]/25 text-[#245C45] hover:bg-[#245C45]/5'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>Open Voice Studio</span>
            </Link>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="rounded-2xl overflow-hidden aspect-[4/3] border border-black/10">
            <ResilientImage
              src={isKids ? SAUTI_IMAGES.littleVoices : envMeta.image}
              alt={envMeta.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </motion.section>

      {/* Progress & Shortcuts Grid */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl bg-white border border-[#245C45]/12 p-5">
          <div className="flex items-center justify-between text-xs text-[#4A5851] mb-2">
            <span>Learning Streak</span>
            <Flame className="w-4 h-4 text-[#F28B75]" />
          </div>
          <p className="font-display text-3xl font-bold tabular-nums">{learner?.streakDays ?? 0} days</p>
          <p className="text-xs text-[#4A5851] mt-1">Earn streaks by completing lessons</p>
        </div>

        <div className="rounded-2xl bg-white border border-[#245C45]/12 p-5">
          <div className="flex items-center justify-between text-xs text-[#4A5851] mb-2">
            <span>{isKids ? 'Star Points' : 'Learning XP'}</span>
            <Sparkles className="w-4 h-4 text-[#F6C96B]" />
          </div>
          <p className="font-display text-3xl font-bold tabular-nums">{learner?.xp ?? 0}</p>
          <p className="text-xs text-[#4A5851] mt-1">Current CEFR tier: {learner?.cefrLevel || 'A1'}</p>
        </div>

        <div className="rounded-2xl bg-white border border-[#245C45]/12 p-5">
          <div className="flex items-center justify-between text-xs text-[#4A5851] mb-2">
            <span>Pathway Progress</span>
            <Target className="w-4 h-4 text-[#245C45]" />
          </div>
          <p className="font-display text-3xl font-bold tabular-nums">{completionPct}%</p>
          <div className="w-full h-2 rounded-full bg-[#FDF3E3] mt-2 overflow-hidden">
            <div className="h-full bg-[#245C45]" style={{ width: `${completionPct}%` }} />
          </div>
        </div>

        <div className="rounded-2xl bg-white border border-[#245C45]/12 p-5 flex flex-col justify-between">
          <p className="text-xs text-[#4A5851]">Practice Shortcuts</p>
          <div className="flex flex-col gap-2 mt-2">
            <Link
              to="/learn/speaking"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#245C45] hover:underline"
            >
              <Mic className="w-4 h-4" /> Speaking Practice
            </Link>
            <Link
              to="/learn/listening"
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#245C45] hover:underline"
            >
              <Headphones className="w-4 h-4" /> Listening Practice
            </Link>
          </div>
        </div>
      </section>

      {/* Recommended Courses & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-8 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold">
              {isKids ? 'Your Story Courses' : 'Recommended Courses'}
            </h2>
            <Link to="/learn/courses" className="text-sm font-semibold text-[#245C45] hover:underline">
              Browse all courses
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(data?.recommendedCourses || []).map((course) => (
              <Link
                key={course.id}
                to={`/learn/courses/${course.id}`}
                className="rounded-2xl bg-white border border-[#245C45]/12 p-6 hover:border-[#245C45] transition-colors flex flex-col justify-between"
              >
                <div>
                  <p className="text-xs text-[#4A5851] mb-1.5">
                    {course.cefrLevel} · {course.skillFocus} · {course.estimatedMinutes} min
                  </p>
                  <h3 className="font-display text-lg font-bold mb-2">{course.title}</h3>
                  <p className="text-sm text-[#4A5851] leading-relaxed mb-4">
                    {course.description}
                  </p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#245C45]">
                  <BookOpen className="w-4 h-4" /> Open course
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="lg:col-span-4 space-y-4">
          <h2 className="font-display text-2xl font-bold">Achievements</h2>
          <div className="rounded-2xl bg-white border border-[#245C45]/12 p-5 space-y-3">
            {(data?.achievements || []).slice(0, 4).map((ach) => (
              <div
                key={ach.id}
                className={`flex items-start gap-3 p-3 rounded-xl ${
                  ach.earned ? 'bg-[#245C45]/10' : 'bg-[#FFF8ED]/60 opacity-70'
                }`}
              >
                <Award
                  className={`w-5 h-5 shrink-0 mt-0.5 ${
                    ach.earned ? 'text-[#245C45]' : 'text-[#4A5851]'
                  }`}
                />
                <div>
                  <p className="font-display font-bold text-sm">{ach.title}</p>
                  <p className="text-xs text-[#4A5851]">{ach.description}</p>
                </div>
              </div>
            ))}
            <Link
              to="/learn/achievements"
              className="block text-center text-xs font-semibold text-[#245C45] pt-1 hover:underline"
            >
              View all milestones
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
