import { useEffect, useState } from 'react';
import { BookOpen, Layers, LayoutDashboard, ListChecks, Settings, Users } from 'lucide-react';
import { PortalLayout } from '../../app/layouts/PortalLayout';
import { apiFetch } from '../../services/api';
import { PageTransition } from '../../components/motion/SautiMotion';

const ADMIN_NAV = [
  { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/users', label: 'Users', icon: Users },
  { to: '/admin/courses', label: 'Courses', icon: BookOpen },
  { to: '/admin/modules', label: 'Modules', icon: Layers },
  { to: '/admin/lessons', label: 'Lessons', icon: ListChecks },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

export function AdminPortalPage({ section = 'dashboard' }: { section?: string }) {
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [curriculum, setCurriculum] = useState<any>(null);
  const [newTitle, setNewTitle] = useState('');
  const [newProgId, setNewProgId] = useState<number>(1);

  const loadAdmin = () => {
    apiFetch('/api/admin/stats').then(setStats).catch(() => {});
    apiFetch<{ users: any[] }>('/api/admin/users').then((r) => setUsers(r.users || [])).catch(() => {});
    apiFetch('/api/admin/curriculum').then(setCurriculum).catch(() => {});
  };

  useEffect(() => {
    loadAdmin();
  }, []);

  const handleCreateCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTitle.trim()) return;
    await apiFetch('/api/admin/courses', {
      method: 'POST',
      body: JSON.stringify({ programmeId: newProgId, title: newTitle }),
    });
    setNewTitle('');
    loadAdmin();
  };

  return (
    <PortalLayout title="SAUTI Admin" subtitle="Curriculum & Governance" navItems={ADMIN_NAV}>
      <PageTransition className="space-y-8">
        <div>
          <h1 className="font-display text-3xl font-bold capitalize">Admin · {section}</h1>
          <p className="text-sm text-[#4A5851]">
            Protected administration workspace for SAUTI programmes, courses, and users.
          </p>
        </div>

        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
            {[
              { label: 'Users', value: stats.users },
              { label: 'Courses', value: stats.courses },
              { label: 'Lessons', value: stats.lessons },
              { label: 'Completions', value: stats.completions },
              { label: 'Voice Sessions', value: stats.voiceSessions },
            ].map((s) => (
              <div key={s.label} className="rounded-2xl sauti-surface p-4">
                <p className="text-xs text-[#4A5851]">{s.label}</p>
                <p className="font-display text-2xl font-bold tabular-nums mt-1">{s.value}</p>
              </div>
            ))}
          </div>
        )}

        {section === 'users' ? (
          <div className="rounded-2xl bg-white border border-[#245C45]/12 p-6 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-[#245C45]/12 text-xs text-[#4A5851]">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Email</th>
                  <th className="py-2 pr-4">Role</th>
                  <th className="py-2">Account Type</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-[#245C45]/8 last:border-0">
                    <td className="py-2.5 pr-4 font-semibold">{u.displayName}</td>
                    <td className="py-2.5 pr-4">{u.email}</td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{u.role}</td>
                    <td className="py-2.5">{u.accountType}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-6">
            <form
              onSubmit={handleCreateCourse}
              className="rounded-2xl bg-white border border-[#245C45]/12 p-6 flex flex-col sm:flex-row gap-3"
            >
              <select
                value={newProgId}
                onChange={(e) => setNewProgId(Number(e.target.value))}
                className="rounded-xl border border-[#245C45]/20 px-3 py-2.5 text-sm"
              >
                {(curriculum?.programmes || []).map((p: any) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="New course title..."
                className="flex-1 rounded-xl border border-[#245C45]/20 px-3.5 py-2.5 text-sm"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold"
              >
                Add course
              </button>
            </form>

            <div className="rounded-2xl bg-white border border-[#245C45]/12 p-6 space-y-2">
              <h2 className="font-display text-lg font-bold">Active Courses</h2>
              {(curriculum?.courses || []).map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-2 border-b border-[#245C45]/8 text-sm">
                  <span className="font-medium">{c.title}</span>
                  <span className="text-xs font-mono text-[#4A5851]">{c.cefrLevel}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </PageTransition>
    </PortalLayout>
  );
}
