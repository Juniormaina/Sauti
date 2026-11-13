import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ArrowRight, BookOpen, Clock } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { Course, ModuleWithLessons, Programme } from '../../types/sauti';

import { useAuthStore } from '../../stores/authStore';

export function CourseDetailPage() {
  const { id } = useParams();
  const { activeChildId } = useAuthStore();
  const [data, setData] = useState<{
    course: Course;
    programme: Programme | null;
    modules: ModuleWithLessons[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qs = activeChildId ? `?learnerId=${activeChildId}` : '';
    apiFetch<any>(`/api/learning/courses/${id}${qs}`)
      .then(setData)
      .finally(() => setLoading(false));
  }, [id, activeChildId]);

  if (loading) {
    return <div className="h-64 rounded-3xl bg-[#245C45]/10 animate-pulse" />;
  }

  if (!data?.course) {
    return <p className="text-sm text-[#4A5851]">Course not found.</p>;
  }

  return (
    <div className="space-y-8">
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
    apiFetch<any>(`/api/learning/modules/${id}${qs}`).then(setData);
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
