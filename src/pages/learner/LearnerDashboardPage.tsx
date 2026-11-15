import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRight,
  Award,
  BookOpen,
  Download,
  Flame,
  Headphones,
  Mic,
  Sparkles,
  Target,
  WifiOff,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { apiFetch, isOfflineOrNetworkError } from '../../services/api';
import { getEnvironmentMeta, SAUTI_IMAGES } from '../../utils/environments';
import { ResilientImage } from '../../components/ui/ResilientImage';
import { AchievementItem, Course, Lesson, VoicePracticeSession } from '../../types/sauti';
import { buildOfflineScopeKey, listOfflineLessons, OfflineLessonRecord } from '../../lib/offlineDb';
import { useOfflineStore } from '../../stores/offlineStore';
import {
  AnimatedProgressBar,
  MotionCard,
  PageTransition,
  RevealItem,
  RevealStagger,
} from '../../components/motion/SautiMotion';

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
  const { user, learnerProfile, activeChildId } = useAuthStore();
  const isOnline = useOfflineStore((s) => s.isOnline);
  const scopeKey = buildOfflineScopeKey(user?.id, activeChildId ?? learnerProfile?.id ?? null);

  const [data, setData] = useState<DashboardData | null>(null);
  const [offlineLessons, setOfflineLessons] = useState<OfflineLessonRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const envMeta = getEnvironmentMeta(data?.learner?.environment || learnerProfile?.environment);
  const isKids = envMeta.layoutGroup === 'kids';
  const isTeen = envMeta.layoutGroup === 'teen';

  useEffect(() => {
    setLoading(true);
    listOfflineLessons(scopeKey)
      .then(setOfflineLessons)
      .catch(() => setOfflineLessons([]));

    const qs = activeChildId ? `?learnerId=${activeChildId}` : '';
    apiFetch<DashboardData>(`/api/learning/dashboard${qs}`)
      .then((res) => {
        setData(res);
        setError(null);
      })
      .catch((err) => {
        if (isOfflineOrNetworkError(err)) {
          setError(null);
        } else {
          setError(err.message || 'Unable to load dashboard');
        }
      })
      .finally(() => setLoading(false));
  }, [activeChildId, scopeKey, isOnline]);

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-44 rounded-3xl bg-[#245C45]/10" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="h-32 rounded-2xl bg-[#245C45]/10" />
          <div className="h-32 rounded-2xl bg-[#245C45]/10" />
          <div className="h-32 rounded-2xl bg-[#245C45]/10" />
          <div className="h-32 rounded-2xl bg-[#245C45]/10" />
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
  const completionPct = data ? Math.round((completedCount / totalCount) * 100) : 0;
  const nextLesson =
    data?.recommendedLessons?.find((l) => !l.completed) || data?.recommendedLessons?.[0];
  const upNext = (data?.recommendedLessons ?? []).filter((l) => !l.completed).slice(0, 4);

  return (
    <PageTransition className="space-y-8">
      {/* Hero Welcome Banner tailored per age layout group */}
      <section
        className={`rounded-3xl p-6 sm:p-8 border grid grid-cols-1 lg:grid-cols-12 gap-6 items-center ${
          isKids
            ? 'bg-[#FFF1E6] border-[#F28B75]/45 shadow-sm'
            : isTeen
            ? 'sauti-surface-forest bg-editorial-dots-dark border-[#245C45]'
            : 'sauti-surface'
        }`}
      >
        <div className="lg:col-span-8 space-y-3">
          <p
            className={`text-xs font-mono font-semibold ${
              isTeen ? 'text-[#F6C96B]' : 'text-[#245C45]'
            }`}
          >
            {envMeta.title} · Level {learner?.cefrLevel || 'A1'} · Daily goal{' '}
            {learner?.dailyGoalMinutes || 15} min
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold headline-balance">
            {isKids
              ? `Hello ${learner?.displayName || 'Explorer'}! Ready to hear and speak today?`
              : `Welcome back, ${learner?.displayName || 'Learner'}.`}
          </h1>
          <p
            className={`text-sm sm:text-base max-w-2xl leading-relaxed ${
              isTeen ? 'text-[#FFF8ED]/85' : 'text-[#4A5851]'
            }`}
          >
            {data?.goal?.title || 'Speak with confidence and build steady daily English rhythm.'}
          </p>

          <div className="flex flex-wrap gap-3 pt-2">
            {nextLesson && (
              <Link
                to={`/learn/lessons/${nextLesson.id}`}
                className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm active:scale-[0.98] transition-all shadow-sm ${
                  isTeen
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
              className={`inline-flex items-center gap-2 px-5 py-3 rounded-xl font-semibold text-sm border active:scale-[0.98] transition-all ${
                isTeen
                  ? 'border-white/25 text-[#FFF8ED] hover:bg-white/10'
                  : 'border-[#245C45]/25 text-[#245C45] bg-white/80 hover:bg-white'
              }`}
            >
              <Mic className="w-4 h-4" />
              <span>{isKids ? 'Open Voice Play' : 'Open Voice Studio'}</span>
            </Link>
          </div>
        </div>

        <div className="lg:col-span-4">
          <div className="rounded-2xl overflow-hidden aspect-[4/3] border border-black/10 bg-[#FDF3E3]">
            <ResilientImage
              src={isKids ? SAUTI_IMAGES.littleVoices : envMeta.image}
              alt={envMeta.title}
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </section>

      {/* Offline Downloaded Lessons Section (always visible when offline or when lessons are downloaded) */}
      {(offlineLessons.length > 0 || !isOnline) && (
        <section className="rounded-3xl sauti-surface-warm p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              {isOnline ? (
                <Download className="w-4 h-4 text-[#245C45]" />
              ) : (
                <WifiOff className="w-4 h-4 text-[#B43C25]" />
              )}
              <h2 className="font-display text-xl font-bold">
                Downloaded for Offline Practice ({offlineLessons.length})
              </h2>
            </div>
            <Link
              to="/learn/courses"
              className="text-xs font-semibold text-[#245C45] hover:underline"
            >
              Manage offline courses →
            </Link>
          </div>

          {offlineLessons.length === 0 ? (
            <p className="text-sm text-[#4A5851]">
              You are currently offline and have not downloaded any lessons on this device yet. Open
              a course while connected to save lessons for offline practice, or practise Voice
              Studio listening &amp; local recordings.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {offlineLessons.map((rec) => (
                <MotionCard key={rec.lessonId}>
                  <Link
                    to={`/learn/lessons/${rec.lessonId}`}
                    className="h-full rounded-2xl bg-white border border-[#245C45]/12 p-4 hover:border-[#245C45] transition-colors flex flex-col justify-between"
                  >
                    <div>
                      <p className="text-[11px] font-mono font-semibold text-[#245C45] mb-1">
                        Offline ready · {rec.lesson.cefrLevel} · {rec.activities.length} activities
                      </p>
                      <p className="font-display font-bold text-base mb-1">{rec.lesson.title}</p>
                      <p className="text-xs text-[#4A5851] line-clamp-2">{rec.lesson.objective}</p>
                    </div>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#245C45]">
                      Open lesson <ArrowRight className="w-3.5 h-3.5" />
                    </span>
                  </Link>
                </MotionCard>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Learning workspace: what to do next, and where you stand */}
      <section
        aria-label="Learning workspace"
        className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start"
      >
        <div className="lg:col-span-8 rounded-3xl sauti-surface p-6 sm:p-7">
          <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
            <div>
              <p className="text-xs font-mono font-semibold text-[#245C45] mb-1">Up next</p>
              <h2 className="font-display text-2xl font-bold">
                {isKids ? 'Your next adventures' : 'Your next lessons'}
              </h2>
            </div>
            <Link
              to="/learn/courses"
              className="text-sm font-semibold text-[#245C45] hover:underline"
            >
              All courses
            </Link>
          </div>

          {upNext.length === 0 ? (
            <p className="text-sm text-[#4A5851] leading-relaxed">
              {data
                ? 'You are all caught up on recommended lessons. Browse the library to start a new module.'
                : 'Lesson recommendations load when you are back online. Downloaded lessons stay available above.'}
            </p>
          ) : (
            <ol className="divide-y divide-[#245C45]/12">
              {upNext.map((lesson, i) => (
                <li key={lesson.id}>
                  <Link
                    to={`/learn/lessons/${lesson.id}`}
                    className="group grid grid-cols-[2.25rem_1fr_auto] items-center gap-4 py-4 transition-colors hover:bg-[#245C45]/[0.04] -mx-3 px-3 rounded-xl"
                  >
                    <span
                      className={`font-mono text-xs font-semibold ${
                        i === 0 ? 'text-[#F28B75]' : 'text-[#245C45]'
                      }`}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span>
                      <span className="block font-display text-lg font-bold group-hover:text-[#245C45] transition-colors">
                        {lesson.title}
                      </span>
                      <span className="block text-sm text-[#4A5851] line-clamp-1">
                        {lesson.objective}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 font-mono text-xs text-[#4A5851]">
                      {lesson.cefrLevel} · {lesson.durationMinutes} min
                      <ArrowRight className="w-4 h-4 text-[#245C45] transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="lg:col-span-4 space-y-4">
          <div className="rounded-3xl sauti-surface p-6">
            <div className="flex items-end justify-between mb-3">
              <div>
                <p className="text-xs font-mono font-semibold text-[#245C45] mb-1">
                  Pathway progress
                </p>
                <p className="font-display text-4xl font-bold tabular-nums">
                  {data ? `${completionPct}%` : 'Offline'}
                </p>
              </div>
              <Target className="w-5 h-5 text-[#245C45] mb-1" aria-hidden="true" />
            </div>
            <AnimatedProgressBar
              value={completionPct}
              ariaLabel="Pathway completion percentage"
              trackClassName="bg-[#FDF3E3]"
              barClassName={isKids ? 'bg-[#F28B75]' : 'bg-[#245C45]'}
            />
            <p className="text-xs text-[#4A5851] mt-2">
              {data ? `${completedCount} of ${data.totalLessonsCount} lessons complete` : 'Progress syncs when you reconnect'}
            </p>

            <dl className="mt-5 grid grid-cols-3 divide-x divide-[#245C45]/12 border-t border-[#245C45]/12 pt-4 text-center">
              <div className="px-1">
                <dt className="flex items-center justify-center gap-1 text-[11px] text-[#4A5851]">
                  <Flame className="w-3.5 h-3.5 text-[#F28B75]" aria-hidden="true" /> Streak
                </dt>
                <dd className="font-display text-xl font-bold tabular-nums">
                  {learner?.streakDays ?? 0}
                  <span className="text-xs font-medium text-[#4A5851]"> d</span>
                </dd>
              </div>
              <div className="px-1">
                <dt className="flex items-center justify-center gap-1 text-[11px] text-[#4A5851]">
                  <Sparkles className="w-3.5 h-3.5 text-[#F6C96B]" aria-hidden="true" />{' '}
                  {isKids ? 'Stars' : 'XP'}
                </dt>
                <dd className="font-display text-xl font-bold tabular-nums">{learner?.xp ?? 0}</dd>
              </div>
              <div className="px-1">
                <dt className="text-[11px] text-[#4A5851]">Level</dt>
                <dd className="font-display text-xl font-bold">{learner?.cefrLevel || 'A1'}</dd>
              </div>
            </dl>
          </div>

          <div className="rounded-3xl sauti-surface-warm p-5">
            <p className="text-xs font-mono font-semibold text-[#245C45] mb-3">Practice now</p>
            <div className="flex flex-col gap-2.5">
              <Link
                to="/learn/speaking"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#245C45] hover:underline"
              >
                <Mic className="w-4 h-4" aria-hidden="true" /> Speaking Practice
              </Link>
              <Link
                to="/learn/listening"
                className="inline-flex items-center gap-2 text-sm font-semibold text-[#245C45] hover:underline"
              >
                <Headphones className="w-4 h-4" aria-hidden="true" /> Listening Practice
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Recommended Courses & Achievements */}
      {data && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <section className="lg:col-span-8 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl font-bold">
                {isKids ? 'Your Story Courses' : 'Recommended Courses'}
              </h2>
              <Link
                to="/learn/courses"
                className="text-sm font-semibold text-[#245C45] hover:underline"
              >
                Browse all courses
              </Link>
            </div>

            {data.recommendedCourses?.length === 0 ? (
              <div className="rounded-2xl sauti-surface-warm p-6 text-sm text-[#4A5851]">
                No courses assigned for this pathway yet. Browse the full library to start any CEFR
                module.
              </div>
            ) : (
              <RevealStagger className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(data.recommendedCourses || []).map((course) => (
                  <RevealItem key={course.id}>
                    <MotionCard className="h-full">
                      <Link
                        to={`/learn/courses/${course.id}`}
                        className="h-full rounded-2xl sauti-surface p-6 hover:border-[#245C45] transition-colors flex flex-col justify-between"
                      >
                        <div>
                          <p className="text-xs font-mono text-[#4A5851] mb-1.5">
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
                    </MotionCard>
                  </RevealItem>
                ))}
              </RevealStagger>
            )}
          </section>

          <section className="lg:col-span-4 space-y-4">
            <h2 className="font-display text-2xl font-bold">Achievements</h2>
            <div className="rounded-2xl sauti-surface p-5 space-y-3">
              {(data.achievements || []).slice(0, 4).map((ach) => (
                <div
                  key={ach.id}
                  className={`flex items-start gap-3 p-3 rounded-xl transition-colors ${
                    ach.earned
                      ? 'bg-[#245C45]/10 border border-[#245C45]/20'
                      : 'bg-[#FFF8ED]/70 opacity-75'
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
      )}
    </PageTransition>
  );
}
