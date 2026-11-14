import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { BarChart3, BookOpen, LayoutDashboard, Plus, Users } from 'lucide-react';
import { PortalLayout } from '../../app/layouts/PortalLayout';
import { apiFetch } from '../../services/api';
import { MotionCard, PageTransition } from '../../components/motion/SautiMotion';

const TEACHER_NAV = [
  { to: '/teacher/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/teacher/classrooms', label: 'Classrooms', icon: BookOpen },
  { to: '/teacher/learners', label: 'Learners', icon: Users },
  { to: '/teacher/reports', label: 'Reports', icon: BarChart3 },
];

export function TeacherPortalPage() {
  const { id } = useParams();
  const [data, setData] = useState<{ classrooms: any[]; availableCourses: any[] } | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [clsName, setClsName] = useState('');
  const [clsEnv, setClsEnv] = useState('teen_voices');
  const [learnerInput, setLearnerInput] = useState('');
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const loadTeacher = () => {
    apiFetch<any>('/api/teacher/dashboard').then(setData).catch(() => {});
  };

  useEffect(() => {
    loadTeacher();
  }, []);

  useEffect(() => {
    if (id) {
      apiFetch<any>(`/api/teacher/classrooms/${id}`).then(setDetail).catch(() => {});
    }
  }, [id]);

  const handleCreateClassroom = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatusMsg(null);
    await apiFetch('/api/teacher/classrooms', {
      method: 'POST',
      body: JSON.stringify({ name: clsName, environment: clsEnv, cefrLevel: 'A2' }),
    });
    setClsName('');
    setStatusMsg('Classroom created with a unique join code.');
    loadTeacher();
  };

  const handleAddLearner = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !learnerInput.trim()) return;
    const isEmail = learnerInput.includes('@');
    await apiFetch(`/api/teacher/classrooms/${id}/learners`, {
      method: 'POST',
      body: JSON.stringify(isEmail ? { email: learnerInput } : { displayName: learnerInput }),
    });
    setLearnerInput('');
    apiFetch<any>(`/api/teacher/classrooms/${id}`).then(setDetail);
  };

  return (
    <PortalLayout title="Teacher & School" subtitle="Classrooms & Cohorts" navItems={TEACHER_NAV}>
      <PageTransition className="space-y-8">
        {statusMsg && (
          <div className="rounded-xl bg-[#245C45]/10 border border-[#245C45]/30 p-4 text-sm">
            {statusMsg}
          </div>
        )}

        {id && detail ? (
          <div className="space-y-6">
            <Link to="/teacher/classrooms" className="text-xs font-semibold text-[#245C45] hover:underline">
              ← Back to classrooms
            </Link>
            <div className="rounded-3xl bg-white border border-[#245C45]/12 p-7 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs font-mono text-[#245C45]">
                  Join Code: {detail.classroom.joinCode} · CEFR {detail.classroom.cefrLevel}
                </p>
                <h1 className="font-display text-3xl font-bold">{detail.classroom.name}</h1>
              </div>
            </div>

            <form onSubmit={handleAddLearner} className="flex flex-col sm:flex-row gap-3 max-w-xl">
              <input
                type="text"
                value={learnerInput}
                onChange={(e) => setLearnerInput(e.target.value)}
                placeholder="Learner email or display name..."
                className="flex-1 rounded-xl border border-[#245C45]/20 px-4 py-2.5 text-sm bg-white"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold"
              >
                Add to class
              </button>
            </form>

            <div className="rounded-2xl bg-white border border-[#245C45]/12 p-6 space-y-3">
              <h2 className="font-display text-lg font-bold">Enrolled Learners</h2>
              {detail.learners?.length === 0 ? (
                <p className="text-sm text-[#4A5851]">No learners added yet.</p>
              ) : (
                detail.learners.map((m: any) => (
                  <div key={m.membershipId} className="flex items-center justify-between py-2.5 border-b border-[#245C45]/10 last:border-0 text-sm">
                    <span className="font-semibold">{m.learner?.displayName || 'Learner'}</span>
                    <span className="text-xs text-[#4A5851] tabular-nums">
                      {m.learner?.cefrLevel} · {m.completedLessonsCount} lessons completed
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <>
            <div>
              <h1 className="font-display text-3xl font-bold">Teacher &amp; School Dashboard</h1>
              <p className="text-sm text-[#4A5851]">
                Organise speaking cohorts, assign pathways, and follow class progress.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {(data?.classrooms || []).map((cls) => (
                <MotionCard key={cls.id} className="h-full">
                  <Link
                    to={`/teacher/classrooms/${cls.id}`}
                    className="h-full rounded-2xl sauti-surface p-6 hover:border-[#245C45] transition-colors space-y-2 block"
                  >
                    <p className="text-xs font-mono text-[#245C45]">Code: {cls.joinCode}</p>
                    <h2 className="font-display text-xl font-bold">{cls.name}</h2>
                    <p className="text-xs text-[#4A5851] tabular-nums">
                      {cls.learnerCount} learners · CEFR {cls.cefrLevel}
                    </p>
                  </Link>
                </MotionCard>
              ))}
            </div>

            <form
              onSubmit={handleCreateClassroom}
              className="rounded-3xl sauti-surface p-7 space-y-4 max-w-2xl"
            >
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#245C45]" /> Create Classroom
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={clsName}
                  onChange={(e) => setClsName(e.target.value)}
                  placeholder="e.g. Form 2 Speaking Club"
                  className="rounded-xl border border-[#245C45]/20 px-3.5 py-2.5 text-sm"
                />
                <select
                  value={clsEnv}
                  onChange={(e) => setClsEnv(e.target.value)}
                  className="rounded-xl border border-[#245C45]/20 px-3 py-2.5 text-sm"
                >
                  <option value="young_explorers">Young Explorers (6–10)</option>
                  <option value="teen_voices">Teen Voices (11–17)</option>
                  <option value="young_adults">Young Adults (18–25)</option>
                  <option value="professional_english">Professional (26–45)</option>
                </select>
                <button
                  type="submit"
                  className="rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold py-2.5 px-4"
                >
                  Create class
                </button>
              </div>
            </form>
          </>
        )}
      </PageTransition>
    </PortalLayout>
  );
}
