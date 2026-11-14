import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, CheckCircle2, Clock, Download, Trash2 } from 'lucide-react';
import { apiFetch, isOfflineOrNetworkError } from '../../services/api';
import { Course, ModuleWithLessons, Programme } from '../../types/sauti';
import { useAuthStore } from '../../stores/authStore';
import {
  buildOfflineScopeKey,
  getOfflineCourse,
  listOfflineLessons,
  removeOfflineCourse,
  removeOfflineLesson,
  saveOfflineCourse,
  saveOfflineLesson,
} from '../../lib/offlineDb';
import { useOfflineStore } from '../../stores/offlineStore';

export function CourseDetailPage() {
  const { id } = useParams();
  const { user, learnerProfile, activeChildId } = useAuthStore();
  const isOnline = useOfflineStore((s) => s.isOnline);
  const scopeKey = buildOfflineScopeKey(user?.id, activeChildId ?? learnerProfile?.id ?? null);

  const [data, setData] = useState<{
    course: Course;
    programme: Programme | null;
    modules: ModuleWithLessons[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloadedLessonIds, setDownloadedLessonIds] = useState<Set<number>>(new Set());
  const [isCourseSaved, setIsCourseSaved] = useState(false);
  const [downloadingAll, setDownloadingAll] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  const refreshSavedState = async (courseIdNum: number) => {
    const [savedCourse, savedLessons] = await Promise.all([
      getOfflineCourse(scopeKey, courseIdNum),
      listOfflineLessons(scopeKey),
    ]);
    setIsCourseSaved(Boolean(savedCourse));
    setDownloadedLessonIds(new Set(savedLessons.map((l) => l.lessonId)));
  };

  useEffect(() => {
    const courseIdNum = Number(id);
    const qs = activeChildId ? `?learnerId=${activeChildId}` : '';

    if (courseIdNum) {
      void refreshSavedState(courseIdNum);
    }

    apiFetch<any>(`/api/learning/courses/${id}${qs}`)
      .then((res) => {
        setData(res);
      })
      .catch(async (err) => {
        if (isOfflineOrNetworkError(err) && courseIdNum) {
          const cached = await getOfflineCourse(scopeKey, courseIdNum);
          if (cached) {
            setData({
              course: cached.course,
              programme: cached.programme,
              modules: cached.modules,
            });
          }
        }
      })
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, activeChildId, scopeKey]);

  const handleDownloadCourse = async () => {
    if (!data?.course || downloadingAll) return;
    setDownloadingAll(true);
    setDownloadMsg(null);
    try {
      await saveOfflineCourse(scopeKey, {
        course: data.course,
        programme: data.programme,
        modules: data.modules,
      });

      const qs = activeChildId ? `?learnerId=${activeChildId}` : '';
      let savedCount = 0;
      for (const mod of data.modules) {
        for (const lesson of mod.lessons) {
          const lessonRes = await apiFetch<any>(`/api/learning/lessons/${lesson.id}${qs}`);
          await saveOfflineLesson(scopeKey, {
            lesson: lessonRes.lesson,
            module: lessonRes.module,
            course: lessonRes.course,
            activities: lessonRes.activities || [],
          });
          savedCount += 1;
        }
      }
      await refreshSavedState(data.course.id);
      setDownloadMsg(`Downloaded course and ${savedCount} lesson${savedCount === 1 ? '' : 's'} for offline use.`);
    } catch (err: any) {
      setDownloadMsg(err?.message || 'Unable to save course offline.');
    } finally {
      setDownloadingAll(false);
    }
  };

  const handleRemoveCourseOffline = async () => {
    if (!data?.course) return;
    await removeOfflineCourse(scopeKey, data.course.id);
    for (const mod of data.modules) {
      for (const lesson of mod.lessons) {
        await removeOfflineLesson(scopeKey, lesson.id);
      }
    }
    await refreshSavedState(data.course.id);
    setDownloadMsg('Removed offline copy of this course from this device.');
  };

  if (loading) {
    return <div className="h-64 rounded-3xl bg-[#245C45]/10 animate-pulse" />;
  }

  if (!data?.course) {
    return (
      <p className="text-sm text-[#4A5851]">
        {isOnline
          ? 'Course not found.'
          : 'This course has not been downloaded for offline access yet.'}
      </p>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <Link
            to="/learn/courses"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#245C45] mb-3 hover:underline"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to courses
          </Link>
          <p className="text-xs text-[#4A5851] mb-1">
            {data.programme?.title} · CEFR {data.course.cefrLevel} · {data.course.skillFocus}
          </p>
          <h1 className="font-display text-3xl font-bold mb-2">{data.course.title}</h1>
          <p className="text-base text-[#4A5851] max-w-3xl">{data.course.description}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {isOnline && (
            <button
              type="button"
              disabled={downloadingAll}
              onClick={handleDownloadCourse}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-xs font-semibold hover:bg-[#194231] disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {downloadingAll
                  ? 'Downloading...'
                  : isCourseSaved
                  ? 'Update offline copy'
                  : 'Download course offline'}
              </span>
            </button>
          )}
          {isCourseSaved && (
            <button
              type="button"
              onClick={handleRemoveCourseOffline}
              className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-[#245C45]/20 text-xs font-semibold text-[#4A5851] hover:text-[#B43C25]"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Remove offline</span>
            </button>
          )}
        </div>
      </div>

      {downloadMsg && (
        <div className="rounded-xl bg-[#FDF3E3] border border-[#245C45]/15 px-4 py-3 text-xs text-[#17201C]">
          {downloadMsg}
        </div>
      )}

      <div className="space-y-6">
        {data.modules.map((mod, idx) => (
          <section
            key={mod.id}
            className="rounded-3xl bg-white border border-[#245C45]/12 p-6 sm:p-8 space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <p className="text-xs font-mono text-[#245C45]">Module 0{idx + 1}</p>
                <h2 className="font-display text-xl font-bold">{mod.title}</h2>
                <p className="text-sm text-[#4A5851]">{mod.description}</p>
              </div>
              <Link
                to={`/learn/modules/${mod.id}`}
                className="text-xs font-semibold text-[#245C45] hover:underline whitespace-nowrap"
              >
                Module view →
              </Link>
            </div>

            <div className="divide-y divide-[#245C45]/10">
              {mod.lessons.map((lesson) => (
                <Link
                  key={lesson.id}
                  to={`/learn/lessons/${lesson.id}`}
                  className="py-4 flex items-center justify-between gap-4 hover:bg-[#FFF8ED]/60 px-3 -mx-3 rounded-xl transition-colors"
                >
                  <div className="flex items-start gap-3">
                    <BookOpen className="w-5 h-5 text-[#245C45] mt-0.5 shrink-0" />
                    <div>
                      <p className="font-display font-bold text-base">{lesson.title}</p>
                      <p className="text-xs text-[#4A5851]">{lesson.objective}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 shrink-0 text-xs font-semibold text-[#245C45]">
                    {downloadedLessonIds.has(lesson.id) && (
                      <span className="inline-flex items-center gap-1 text-[#245C45]">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Offline
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 tabular-nums text-[#4A5851]">
                      <Clock className="w-3.5 h-3.5" /> {lesson.durationMinutes}m
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

export function ModuleDetailPage() {
  const { id } = useParams();
  const { activeChildId } = useAuthStore();
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    const qs = activeChildId ? `?learnerId=${activeChildId}` : '';
    apiFetch<any>(`/api/learning/modules/${id}${qs}`).then(setData).catch(() => {});
  }, [id, activeChildId]);

  if (!data) return <div className="h-48 rounded-2xl bg-[#245C45]/10 animate-pulse" />;

  return (
    <div className="space-y-6">
      <Link
        to={`/learn/courses/${data.course?.id}`}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#245C45]"
      >
        <ArrowLeft className="w-3.5 h-3.5" /> Back to {data.course?.title}
      </Link>
      <h1 className="font-display text-3xl font-bold">{data.module?.title}</h1>
      <p className="text-sm text-[#4A5851]">{data.module?.description}</p>
      <div className="space-y-3">
        {(data.lessons || []).map((lesson: any) => (
          <Link
            key={lesson.id}
            to={`/learn/lessons/${lesson.id}`}
            className="block rounded-2xl bg-white border border-[#245C45]/12 p-5 hover:border-[#245C45]"
          >
            <p className="font-display font-bold text-lg">{lesson.title}</p>
            <p className="text-sm text-[#4A5851]">{lesson.objective}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
