import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, CheckCircle2, Clock } from 'lucide-react';
import { apiFetch, isOfflineOrNetworkError } from '../../services/api';
import { Course } from '../../types/sauti';
import { ENVIRONMENTS } from '../../utils/environments';
import { useAuthStore } from '../../stores/authStore';
import { buildOfflineScopeKey, listOfflineCourses } from '../../lib/offlineDb';
import { useOfflineStore } from '../../stores/offlineStore';

export function CoursesLibraryPage() {
  const { user, learnerProfile, activeChildId } = useAuthStore();
  const isOnline = useOfflineStore((s) => s.isOnline);
  const scopeKey = buildOfflineScopeKey(user?.id, activeChildId ?? learnerProfile?.id ?? null);

  const [courses, setCourses] = useState<Course[]>([]);
  const [offlineCourseIds, setOfflineCourseIds] = useState<Set<number>>(new Set());
  const [showingOfflineOnly, setShowingOfflineOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [envFilter, setEnvFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [skillFilter, setSkillFilter] = useState('all');
  const [maxDuration, setMaxDuration] = useState('all');

  useEffect(() => {
    setLoading(true);
    listOfflineCourses(scopeKey)
      .then((rows) => {
        setOfflineCourseIds(new Set(rows.map((r) => r.courseId)));
      })
      .catch(() => {});

    const params = new URLSearchParams();
    if (activeChildId) params.set('learnerId', String(activeChildId));
    if (envFilter !== 'all') params.set('environment', envFilter);
    if (levelFilter !== 'all') params.set('cefrLevel', levelFilter);
    if (skillFilter !== 'all') params.set('skillFocus', skillFilter);
    if (maxDuration !== 'all') params.set('maxMinutes', maxDuration);

    apiFetch<{ courses: Course[] }>(`/api/learning/courses?${params.toString()}`)
      .then((res) => {
        setCourses(res.courses || []);
        setShowingOfflineOnly(false);
      })
      .catch(async (err) => {
        if (isOfflineOrNetworkError(err)) {
          const cached = await listOfflineCourses(scopeKey);
          let fallbackCourses = cached.map((c) => ({
            ...c.course,
            programme: c.programme || undefined,
          }));
          if (levelFilter !== 'all') {
            fallbackCourses = fallbackCourses.filter((c) => c.cefrLevel === levelFilter);
          }
          if (skillFilter !== 'all') {
            fallbackCourses = fallbackCourses.filter(
              (c) => c.skillFocus.toLowerCase() === skillFilter.toLowerCase()
            );
          }
          setCourses(fallbackCourses);
          setShowingOfflineOnly(true);
        }
      })
      .finally(() => setLoading(false));
  }, [activeChildId, envFilter, levelFilter, skillFilter, maxDuration, scopeKey, isOnline]);

  return (
    <div className="space-y-8">
      <div>
        <p className="text-xs font-semibold text-[#245C45] mb-1">
          Learning Library {showingOfflineOnly ? '· Offline Downloaded Courses' : ''}
        </p>
        <h1 className="font-display text-3xl font-bold">Explore Courses &amp; Pathways</h1>
        <p className="text-sm text-[#4A5851] mt-1">
          Filter across age environments, CEFR levels (A1–C2), skills, and session length.
        </p>
      </div>

      {/* Filter Bar */}
      <div className="rounded-2xl bg-white border border-[#245C45]/12 p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <select
          aria-label="Filter by age environment"
          value={envFilter}
          onChange={(e) => setEnvFilter(e.target.value)}
          className="rounded-xl border border-[#245C45]/20 px-3 py-2.5 text-sm bg-[#FFF8ED]/40"
        >
          <option value="all">All Age Environments</option>
          {ENVIRONMENTS.map((env) => (
            <option key={env.id} value={env.id}>
              {env.title} ({env.ageRange})
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by CEFR level"
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="rounded-xl border border-[#245C45]/20 px-3 py-2.5 text-sm bg-[#FFF8ED]/40"
        >
          <option value="all">All CEFR Levels</option>
          {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl) => (
            <option key={lvl} value={lvl}>
              {lvl}
            </option>
          ))}
        </select>

        <select
          aria-label="Filter by skill focus"
          value={skillFilter}
          onChange={(e) => setSkillFilter(e.target.value)}
          className="rounded-xl border border-[#245C45]/20 px-3 py-2.5 text-sm bg-[#FFF8ED]/40"
        >
          <option value="all">All Skills</option>
          <option value="Speaking">Speaking</option>
          <option value="Listening">Listening</option>
          <option value="Reading">Reading</option>
        </select>

        <select
          aria-label="Filter by duration"
          value={maxDuration}
          onChange={(e) => setMaxDuration(e.target.value)}
          className="rounded-xl border border-[#245C45]/20 px-3 py-2.5 text-sm bg-[#FFF8ED]/40"
        >
          <option value="all">Any Duration</option>
          <option value="25">Up to 25 minutes</option>
          <option value="35">Up to 35 minutes</option>
        </select>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1, 2, 3].map((n) => (
            <div key={n} className="h-52 rounded-2xl bg-[#245C45]/10 animate-pulse" />
          ))}
        </div>
      ) : courses.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[#245C45]/12 p-10 text-center">
          <p className="font-display font-bold text-lg mb-2">
            {showingOfflineOnly
              ? 'No downloaded courses stored for offline viewing'
              : 'No courses match those filters'}
          </p>
          <button
            type="button"
            onClick={() => {
              setEnvFilter('all');
              setLevelFilter('all');
              setSkillFilter('all');
              setMaxDuration('all');
            }}
            className="text-sm font-semibold text-[#245C45] hover:underline"
          >
            Reset all filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {courses.map((course) => (
            <Link
              key={course.id}
              to={`/learn/courses/${course.id}`}
              className="rounded-2xl bg-white border border-[#245C45]/12 p-6 hover:border-[#245C45] transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <p className="text-xs text-[#4A5851]">
                    {course.programme?.title} · {course.cefrLevel} · {course.topic}
                  </p>
                  {offlineCourseIds.has(course.id) && (
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#245C45] shrink-0">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Offline
                    </span>
                  )}
                </div>
                <h2 className="font-display text-xl font-bold mb-2">{course.title}</h2>
                <p className="text-sm text-[#4A5851] leading-relaxed mb-4">{course.description}</p>
              </div>
              <div className="flex items-center justify-between pt-3 border-t border-[#245C45]/10 text-xs font-semibold text-[#245C45]">
                <span className="inline-flex items-center gap-1 tabular-nums">
                  <Clock className="w-3.5 h-3.5" /> {course.estimatedMinutes} min
                </span>
                <span className="inline-flex items-center gap-1">
                  Open course <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
