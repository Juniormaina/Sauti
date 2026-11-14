import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  Download,
  Globe2,
  Trash2,
  Volume2,
} from 'lucide-react';
import { apiFetch, isOfflineOrNetworkError } from '../../services/api';
import { Activity, Course, Lesson, Module } from '../../types/sauti';
import { useSpeechPlayback } from '../../hooks/useSpeechPlayback';
import { ActivityRunner } from '../../components/learning/ActivityRunner';
import { useAuthStore } from '../../stores/authStore';
import {
  buildOfflineScopeKey,
  getOfflineLesson,
  removeOfflineLesson,
  saveOfflineLesson,
} from '../../lib/offlineDb';
import { createClientAttemptId, useOfflineStore } from '../../stores/offlineStore';
import { CelebrationBurst, PageTransition } from '../../components/motion/SautiMotion';

export function LessonDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, learnerProfile, activeChildId } = useAuthStore();
  const { isOnline, queueProgressUpdate, verifiedByEndpoint } = useOfflineStore();
  const scopeKey = buildOfflineScopeKey(user?.id, activeChildId ?? learnerProfile?.id ?? null);
  const { speak, isSpeaking } = useSpeechPlayback();

  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [moduleData, setModuleData] = useState<Module | null>(null);
  const [course, setCourse] = useState<Course | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [locallyAttemptedActivityIds, setLocallyAttemptedActivityIds] = useState<number[]>([]);
  const [verifiedActivityIds, setVerifiedActivityIds] = useState<number[]>([]);
  const [lessonCompleted, setLessonCompleted] = useState<{
    verificationStatus: 'verified' | 'queued_offline';
    xpEarned?: number;
    alreadyCompleted?: boolean;
    newlyEarnedAchievements?: string[];
  } | null>(null);
  const [completing, setCompleting] = useState(false);
  const [completeError, setCompleteError] = useState<string | null>(null);
  const [isSavedOffline, setIsSavedOffline] = useState(false);
  const [loadedFromCache, setLoadedFromCache] = useState(false);
  const [offlineNotFound, setOfflineNotFound] = useState(false);

  const isKids =
    learnerProfile?.environment === 'little_voices' ||
    learnerProfile?.environment === 'young_explorers';

  const attemptedActivityCount = new Set([
    ...locallyAttemptedActivityIds,
    ...verifiedActivityIds,
  ]).size;
  const queuedOnlyCount = locallyAttemptedActivityIds.filter(
    (actId) => !verifiedActivityIds.includes(actId)
  ).length;

  useEffect(() => {
    setLocallyAttemptedActivityIds([]);
    setVerifiedActivityIds([]);
    setLessonCompleted(null);
    setCompleteError(null);
  }, [id, scopeKey]);

  useEffect(() => {
    if (!lesson || lessonCompleted?.verificationStatus !== 'queued_offline') return;
    const syncedComplete =
      verifiedByEndpoint[`${scopeKey}::/api/learning/lessons/${lesson.id}/complete`];
    if (syncedComplete && syncedComplete.completed) {
      setLessonCompleted({
        verificationStatus: 'verified',
        xpEarned: syncedComplete.xpEarned,
        alreadyCompleted: syncedComplete.alreadyCompleted,
        newlyEarnedAchievements: syncedComplete.newlyEarnedAchievements,
      });
    }
  }, [verifiedByEndpoint, lesson, lessonCompleted, scopeKey]);

  useEffect(() => {
    const lessonIdNum = Number(id);
    const qs = activeChildId ? `?learnerId=${activeChildId}` : '';

    if (lessonIdNum) {
      getOfflineLesson(scopeKey, lessonIdNum)
        .then((cached) => setIsSavedOffline(Boolean(cached)))
        .catch(() => {});
    }

    apiFetch<any>(`/api/learning/lessons/${id}${qs}`)
      .then((res) => {
        setLesson(res.lesson);
        setModuleData(res.module || null);
        setCourse(res.course);
        setActivities(res.activities || []);
        setLoadedFromCache(false);
        setOfflineNotFound(false);
      })
      .catch(async (err) => {
        if (isOfflineOrNetworkError(err) && lessonIdNum) {
          const cached = await getOfflineLesson(scopeKey, lessonIdNum);
          if (cached) {
            setLesson(cached.lesson);
            setModuleData(cached.module);
            setCourse(cached.course);
            setActivities(cached.activities || []);
            setIsSavedOffline(true);
            setLoadedFromCache(true);
            setOfflineNotFound(false);
          } else {
            setOfflineNotFound(true);
          }
        }
      });
  }, [id, activeChildId, scopeKey]);

  const handleToggleDownload = async () => {
    if (!lesson) return;
    if (isSavedOffline) {
      await removeOfflineLesson(scopeKey, lesson.id);
      setIsSavedOffline(false);
      return;
    }
    await saveOfflineLesson(scopeKey, {
      lesson,
      module: moduleData,
      course,
      activities,
    });
    setIsSavedOffline(true);
  };

  const handleCompleteLesson = async () => {
    if (!lesson) return;
    setCompleting(true);
    setCompleteError(null);
    const targetLearnerId = activeChildId ?? learnerProfile?.id ?? null;

    if (!isOnline) {
      if (activities.length > 0 && attemptedActivityCount < activities.length) {
        setCompleteError(
          'Attempt every activity in this lesson first before queueing lesson completion.'
        );
        setCompleting(false);
        return;
      }
      await queueProgressUpdate({
        id: createClientAttemptId(),
        scopeKey,
        learnerId: targetLearnerId,
        kind: 'lesson_complete',
        endpoint: `/api/learning/lessons/${lesson.id}/complete`,
        payload: {
          learnerId: activeChildId || undefined,
          minutesSpent: lesson.durationMinutes,
        },
        label: `Complete lesson: ${lesson.title}`,
      });
      setLessonCompleted({ verificationStatus: 'queued_offline' });
      setCompleting(false);
      return;
    }

    try {
      const res = await apiFetch<any>(`/api/learning/lessons/${lesson.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          learnerId: activeChildId || undefined,
          minutesSpent: lesson.durationMinutes,
        }),
      });
      setLessonCompleted({
        verificationStatus: 'verified',
        xpEarned: res.xpEarned,
        alreadyCompleted: res.alreadyCompleted,
        newlyEarnedAchievements: res.newlyEarnedAchievements,
      });
    } catch (err: any) {
      if (isOfflineOrNetworkError(err)) {
        await queueProgressUpdate({
          id: createClientAttemptId(),
          scopeKey,
          learnerId: targetLearnerId,
          kind: 'lesson_complete',
          endpoint: `/api/learning/lessons/${lesson.id}/complete`,
          payload: {
            learnerId: activeChildId || undefined,
            minutesSpent: lesson.durationMinutes,
          },
          label: `Complete lesson: ${lesson.title}`,
        });
        setLessonCompleted({ verificationStatus: 'queued_offline' });
      } else {
        setCompleteError(err.message || 'Complete all activities before finishing this lesson.');
      }
    } finally {
      setCompleting(false);
    }
  };

  if (offlineNotFound) {
    return (
      <div className="rounded-3xl bg-white border border-[#245C45]/12 p-8 space-y-3">
        <h1 className="font-display text-2xl font-bold">Lesson unavailable offline</h1>
        <p className="text-sm text-[#4A5851]">
          This lesson was not downloaded before your device went offline. Return to your dashboard to
          open downloaded lessons or reconnect to fetch it.
        </p>
        <Link
          to="/learn/dashboard"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold"
        >
          Back to dashboard
        </Link>
      </div>
    );
  }

  if (!lesson) {
    return <div className="h-72 rounded-3xl bg-[#245C45]/10 animate-pulse" />;
  }

  return (
    <PageTransition className="space-y-8">
      {/* Lesson Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
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
            {loadedFromCache ? ' · Loaded from offline storage' : ''}
          </p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold mb-2">{lesson.title}</h1>
          <p className="text-base text-[#245C45] font-medium">Objective: {lesson.objective}</p>
        </div>

        <button
          type="button"
          onClick={() => void handleToggleDownload()}
          className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border transition-colors shrink-0 ${
            isSavedOffline
              ? 'bg-[#FDF3E3] border-[#245C45]/30 text-[#245C45]'
              : 'bg-white border-[#245C45]/20 text-[#245C45] hover:bg-[#FDF3E3]'
          }`}
        >
          {isSavedOffline ? (
            <>
              <Trash2 className="w-3.5 h-3.5" />
              <span>Saved offline (Remove)</span>
            </>
          ) : (
            <>
              <Download className="w-3.5 h-3.5" />
              <span>Download lesson offline</span>
            </>
          )}
        </button>
      </div>

      {/* Introduction & Audio Story */}
      <section className="rounded-3xl sauti-surface p-6 sm:p-8 space-y-5">
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
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="font-display text-2xl font-bold">Interactive Practice</h2>
          <span className="text-xs font-mono text-[#4A5851] tabular-nums">
            {verifiedActivityIds.length} verified
            {queuedOnlyCount > 0 ? ` · ${queuedOnlyCount} queued offline` : ''} / {activities.length}
          </span>
        </div>

        {activities.map((act) => (
          <ActivityRunner
            key={`${act.id}-${scopeKey}`}
            activity={act}
            learnerId={activeChildId || undefined}
            isKids={isKids}
            onAttempted={(outcome) => {
              if (outcome.verificationStatus === 'verified') {
                setVerifiedActivityIds((prev) => (prev.includes(act.id) ? prev : [...prev, act.id]));
                setLocallyAttemptedActivityIds((prev) => prev.filter((id) => id !== act.id));
              } else if (outcome.verificationStatus === 'queued_offline') {
                setLocallyAttemptedActivityIds((prev) =>
                  prev.includes(act.id) ? prev : [...prev, act.id]
                );
              }
            }}
          />
        ))}
      </section>

      {/* Lesson Completion */}
      <section className="rounded-3xl bg-[#245C45] text-[#FFF8ED] p-6 sm:p-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        {lessonCompleted ? (
          <div className="space-y-2">
            <div className="flex items-center gap-2 font-display text-2xl font-bold">
              {lessonCompleted.verificationStatus === 'queued_offline' ? (
                <Clock className="w-6 h-6 text-[#F6C96B]" />
              ) : (
                <CheckCircle2 className="w-6 h-6 text-[#F6C96B]" />
              )}
              <span>
                {lessonCompleted.verificationStatus === 'queued_offline'
                  ? 'Attempted locally · Waiting to sync (Unverified)'
                  : lessonCompleted.alreadyCompleted
                  ? 'Verified by SAUTI · Lesson practice updated'
                  : `Verified by SAUTI · Lesson completed (+${lessonCompleted.xpEarned ?? 0} XP)`}
              </span>
            </div>
            {lessonCompleted.verificationStatus === 'queued_offline' && (
              <p className="text-sm text-[#FFF8ED]/85">
                Your completion is saved locally without unverified XP or streak credit. Once online,
                SAUTI will verify your activities and award earned XP automatically.
              </p>
            )}
            {lessonCompleted.verificationStatus === 'verified' && (
              <CelebrationBurst active label="Verified completion" />
            )}
            {(lessonCompleted.newlyEarnedAchievements?.length ?? 0) > 0 && (
              <p className="text-sm text-[#F6C96B] flex items-center gap-2">
                <Award className="w-4 h-4" />
                Unlocked milestone: {lessonCompleted.newlyEarnedAchievements!.join(', ')}
              </p>
            )}
          </div>
        ) : (
          <div>
            <h3 className="font-display text-xl font-bold">Ready to finish this lesson?</h3>
            <p className="text-sm text-[#FFF8ED]/80">
              {isOnline
                ? 'Completing verifies all activities and updates your streak, progress bars, and milestone rewards.'
                : 'Offline mode: completing queues your lesson attempt locally to verify when reconnected.'}
            </p>
            {completeError && <p className="text-xs text-[#F6C96B] mt-2">{completeError}</p>}
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
            onClick={() => void handleCompleteLesson()}
            className="px-6 py-3 rounded-xl bg-[#F6C96B] text-[#17201C] font-semibold text-sm hover:bg-[#f8d487]"
          >
            {completing ? 'Saving progress...' : isOnline ? 'Complete lesson' : 'Queue completion offline'}
          </button>
        )}
      </section>
    </PageTransition>
  );
}
