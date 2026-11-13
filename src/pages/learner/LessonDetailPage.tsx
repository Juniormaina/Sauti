import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Award, CheckCircle2, Globe2, Volume2 } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { Activity, Course, Lesson } from '../../types/sauti';
import { useSpeechPlayback } from '../../hooks/useSpeechPlayback';
import { ActivityRunner } from '../../components/learning/ActivityRunner';
import { useAuthStore } from '../../stores/authStore';

export function LessonDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { learnerProfile, activeChildId } = useAuthStore();
  const { speak, isSpeaking } = useSpeechPlayback();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [completedActivityIds, setCompletedActivityIds] = useState<number[]>([]);
  const [lessonCompleted, setLessonCompleted] = useState<{
    xpEarned: number;
    newlyEarnedAchievements: string[];
  } | null>(null);
  const [completing, setCompleting] = useState(false);

  const isKids =
    learnerProfile?.environment === 'little_voices' ||
    learnerProfile?.environment === 'young_explorers';

  useEffect(() => {
    apiFetch<any>(`/api/learning/lessons/${id}`).then((res) => {
      setLesson(res.lesson);
      setCourse(res.course);
      setActivities(res.activities || []);
    });
  }, [id]);

  const handleCompleteLesson = async () => {
    if (!lesson) return;
    setCompleting(true);
    try {
      const res = await apiFetch<any>(`/api/learning/lessons/${lesson.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          learnerId: activeChildId || undefined,
          minutesSpent: lesson.durationMinutes,
          score: 100,
        }),
      });
      setLessonCompleted(res);
    } finally {
      setCompleting(false);
    }
  };

  if (!lesson) {
    return <div className="h-72 rounded-3xl bg-[#245C45]/10 animate-pulse" />;
  }

  return (
    <div className="space-y-8">
      {/* Lesson Header */}
      <div>
        {course && (
          <Link
            to={`/learn/courses/${course.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#245C45] mb-3 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to {course.title}
          </Link>
        )}
        <p className="text-xs text-[#4A5851] mb-1">
          CEFR {lesson.cefrLevel} · {lesson.skillType} · {lesson.durationMinutes} min
        </p>
        <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">{lesson.title}</h1>
        <p className="text-base text-[#245C45] font-medium">Objective: {lesson.objective}</p>
      </div>

      {/* Introduction & Audio Story */}
      <section className="rounded-3xl bg-white border border-[#245C45]/12 p-6 sm:p-8 space-y-5">
        <p className="text-base text-[#17201C] leading-relaxed">{lesson.introduction}</p>

        {lesson.contentJson?.audioScript && (
          <button
            type="button"
            onClick={() => speak(lesson.contentJson.audioScript)}
            className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold hover:bg-[#194231]"
          >
            <Volume2 className="w-4 h-4" />
            <span>{isSpeaking ? 'Playing lesson audio...' : 'Listen to lesson audio'}</span>
          </button>
        )}

        {/* Key Phrases */}
        {lesson.contentJson?.keyPhrases?.length > 0 && (
          <div className="space-y-3 pt-2">
            <h2 className="font-display text-lg font-bold">Key Expressions</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {lesson.contentJson.keyPhrases.map((kp) => (
                <div key={kp.phrase} className="rounded-2xl bg-[#FDF3E3] p-4 space-y-1.5">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-display font-bold text-base text-[#245C45]">{kp.phrase}</p>
                    <button
                      type="button"
                      onClick={() => speak(kp.phrase)}
                      aria-label={`Listen to ${kp.phrase}`}
                      className="p-1.5 rounded-lg bg-white text-[#245C45] hover:bg-[#245C45]/10"
                    >
                      <Volume2 className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-xs text-[#4A5851]">{kp.meaning}</p>
                  <p className="text-xs italic text-[#17201C]">Example: &ldquo;{kp.example}&rdquo;</p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Dialogue */}
        {lesson.contentJson?.dialogue && lesson.contentJson.dialogue.length > 0 && (
          <div className="space-y-2 pt-2">
            <h2 className="font-display text-lg font-bold">Dialogue Practice</h2>
            <div className="rounded-2xl bg-[#FFF8ED] border border-[#245C45]/12 p-4 space-y-2">
              {lesson.contentJson.dialogue.map((d, i) => (
                <div key={i} className="flex items-start justify-between gap-3 text-sm">
                  <p>
                    <strong className="text-[#245C45]">{d.speaker}:</strong> {d.line}
                  </p>
                  <button
                    type="button"
                    onClick={() => speak(d.line)}
                    aria-label={`Play line by ${d.speaker}`}
                    className="p-1 rounded-md text-[#245C45] hover:bg-[#245C45]/10 shrink-0"
                  >
                    <Volume2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {lesson.contentJson?.culturalNote && (
          <p className="text-xs text-[#4A5851] flex items-start gap-2 pt-2">
            <Globe2 className="w-4 h-4 shrink-0 text-[#245C45]" />
            <span>{lesson.contentJson.culturalNote}</span>
          </p>
        )}
      </section>

      {/* Interactive Activities */}
      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl font-bold">Interactive Practice</h2>
          <span className="text-xs font-mono text-[#4A5851] tabular-nums">
            {completedActivityIds.length} / {activities.length} attempted
          </span>
        </div>

        {activities.map((act) => (
          <ActivityRunner
            key={act.id}
            activity={act}
            learnerId={activeChildId || undefined}
            isKids={isKids}
            onAttempted={() =>
              setCompletedActivityIds((prev) => (prev.includes(act.id) ? prev : [...prev, act.id]))
            }
          />
        ))}
      </section>

      {/* Lesson Completion */}
      <section className="rounded-3xl bg-[#245C45] text-[#FFF8ED] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {lessonCompleted ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-display text-2xl font-bold">
              <CheckCircle2 className="w-6 h-6 text-[#F6C96B]" />
              <span>Lesson completed (+{lessonCompleted.xpEarned} XP)</span>
            </div>
            {lessonCompleted.newlyEarnedAchievements?.length > 0 && (
              <p className="text-sm text-[#F6C96B] flex items-center gap-2">
                <Award className="w-4 h-4" />
                Unlocked milestone: {lessonCompleted.newlyEarnedAchievements.join(', ')}
              </p>
            )}
          </div>
        ) : (
          <div>
            <h3 className="font-display text-xl font-bold">Ready to finish this lesson?</h3>
            <p className="text-sm text-[#FFF8ED]/80">
              Completing updates your streak, progress bars, and milestone rewards.
            </p>
          </div>
        )}

        {lessonCompleted ? (
          <button
            type="button"
            onClick={() => navigate('/learn/dashboard')}
            className="px-6 py-3 rounded-xl bg-[#F6C96B] text-[#17201C] font-semibold text-sm"
          >
            Return to dashboard
          </button>
        ) : (
          <button
            type="button"
            disabled={completing}
            onClick={handleCompleteLesson}
            className="px-6 py-3 rounded-xl bg-[#F6C96B] text-[#17201C] font-semibold text-sm hover:bg-[#f8d487]"
          >
            {completing ? 'Saving progress...' : 'Complete lesson'}
          </button>
        )}
      </section>
    </div>
  );
}
