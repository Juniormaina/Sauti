import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  BarChart3,
  CheckCircle2,
  LayoutDashboard,
  Plus,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { PortalLayout } from '../../app/layouts/PortalLayout';
import { apiFetch } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';

const PARENT_NAV = [
  { to: '/parent/dashboard', label: 'Overview', icon: LayoutDashboard },
  { to: '/parent/children', label: 'Children', icon: Users },
  { to: '/parent/reports', label: 'Reports', icon: BarChart3 },
  { to: '/parent/settings', label: 'Privacy & Controls', icon: Settings },
];

export function ParentDashboardPage({
  section = 'overview',
}: {
  section?: 'overview' | 'children' | 'reports' | 'settings';
}) {
  const navigate = useNavigate();
  const { id } = useParams();
  const { setActiveChildId, setLearnerProfile } = useAuthStore();

  const [data, setData] = useState<{ parent: any; children: any[]; consentEvents?: any[] } | null>(null);
  const [childDetail, setChildDetail] = useState<any | null>(null);
  const [name, setName] = useState('');
  const [env, setEnv] = useState<'little_voices' | 'young_explorers' | 'teen_voices'>('little_voices');
  const [ageRange, setAgeRange] = useState<'3-5' | '6-10' | '11-17'>('3-5');
  const [consent, setConsent] = useState(false);
  const [portalConsentChecked, setPortalConsentChecked] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  const loadDashboard = () => {
    apiFetch<any>('/api/parent/dashboard')
      .then((res) => {
        setData(res);
        setErrMsg(null);
      })
      .catch((err) => setErrMsg(err.message || 'Unable to load parent dashboard.'));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  useEffect(() => {
    if (id) {
      apiFetch<any>(`/api/parent/children/${id}`)
        .then(setChildDetail)
        .catch((err) => setErrMsg(err.message || 'Unable to load child profile.'));
    }
  }, [id]);

  const hasActiveConsent = Boolean(data?.parent?.hasActiveConsent);

  const handleAcceptConsent = async () => {
    setMsg(null);
    setErrMsg(null);
    try {
      const res = await apiFetch<any>('/api/parent/consent', {
        method: 'POST',
        body: JSON.stringify({ confirmed: true }),
      });
      setData((prev) => (prev ? { ...prev, parent: res.parent } : prev));
      setConsent(true);
      setPortalConsentChecked(false);
      setMsg('Guardian consent recorded. You can now add child profiles and manage privacy settings.');
      loadDashboard();
    } catch (err: any) {
      setErrMsg(err.message || 'Unable to record guardian consent.');
    }
  };

  const handleRevokeConsent = async () => {
    setMsg(null);
    setErrMsg(null);
    try {
      const res = await apiFetch<any>('/api/parent/consent/revoke', {
        method: 'POST',
        body: JSON.stringify({}),
      });
      setData((prev) => (prev ? { ...prev, parent: res.parent } : prev));
      setConsent(false);
      setMsg('Guardian consent revoked. Supervised Live AI voice sessions have been paused.');
      loadDashboard();
    } catch (err: any) {
      setErrMsg(err.message || 'Unable to revoke guardian consent.');
    }
  };

  const handleCreateChild = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErrMsg(null);
    try {
      await apiFetch('/api/parent/children', {
        method: 'POST',
        body: JSON.stringify({
          displayName: name,
          environment: env,
          ageRange,
          cefrLevel: 'A1',
          dailyGoalMinutes: 15,
          consentConfirmed: consent,
        }),
      });
      setName('');
      setConsent(false);
      setMsg('Child profile created safely.');
      loadDashboard();
    } catch (err: any) {
      setErrMsg(err.message || 'Unable to create child profile.');
    }
  };

  const handleUpdatePrivacy = async (allowLive: boolean, retentionDays: number) => {
    setMsg(null);
    setErrMsg(null);
    try {
      const res = await apiFetch<any>('/api/parent/settings', {
        method: 'PATCH',
        body: JSON.stringify({ allowAiLiveForChildren: allowLive, recordingRetentionDays: retentionDays }),
      });
      setData((prev) => (prev ? { ...prev, parent: res.parent } : prev));
      setMsg('Privacy and child-safety settings updated.');
    } catch (err: any) {
      setErrMsg(err.message || 'Unable to update privacy settings.');
    }
  };

  const launchChildWorkspace = (child: any) => {
    setActiveChildId(child.id);
    setLearnerProfile(child);
    navigate('/learn/dashboard');
  };

  return (
    <PortalLayout title="Parent Portal" subtitle="Family Safety & Progress" navItems={PARENT_NAV}>
      <div className="space-y-8">
        {msg && (
          <div className="rounded-xl bg-[#245C45]/10 border border-[#245C45]/30 p-4 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#245C45]" />
            <span>{msg}</span>
          </div>
        )}

        {errMsg && (
          <div className="rounded-xl bg-[#F28B75]/15 border border-[#F28B75] p-4 text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-[#B43C25]" />
            <span>{errMsg}</span>
          </div>
        )}

        {data && !hasActiveConsent && !id && (
          <div className="rounded-3xl bg-[#FFF1E6] border border-[#F28B75]/50 p-6 space-y-4">
            <div className="flex items-start gap-3">
              <ShieldAlert className="w-5 h-5 text-[#B43C25] shrink-0 mt-0.5" />
              <div>
                <h2 className="font-display text-lg font-bold text-[#17201C]">
                  Explicit Guardian Consent Required
                </h2>
                <p className="text-sm text-[#4A5851] mt-1">
                  Before creating child profiles or enabling supervised voice practice, please review
                  and confirm guardian consent for private, ad-free learning with no public child
                  profiles or stranger messaging.
                </p>
              </div>
            </div>
            <label className="flex items-start gap-2.5 text-xs text-[#17201C] cursor-pointer">
              <input
                type="checkbox"
                checked={portalConsentChecked}
                onChange={(e) => setPortalConsentChecked(e.target.checked)}
                className="mt-0.5 accent-[#245C45]"
              />
              <span>
                I am the parent or legal guardian and explicitly consent to child-safe English
                learning and audio processing under these family privacy controls.
              </span>
            </label>
            <button
              type="button"
              disabled={!portalConsentChecked}
              onClick={handleAcceptConsent}
              className="px-5 py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold disabled:opacity-50"
            >
              Confirm guardian consent
            </button>
          </div>
        )}

        {id && childDetail ? (
          <div className="space-y-6">
            <Link to="/parent/children" className="text-xs font-semibold text-[#245C45] hover:underline">
              ← Back to all children
            </Link>
            <div className="rounded-3xl bg-white border border-[#245C45]/12 p-6 sm:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <p className="text-xs text-[#4A5851]">
                  {childDetail.child.environment.replace('_', ' ')} · CEFR {childDetail.child.cefrLevel}
                </p>
                <h1 className="font-display text-3xl font-bold">{childDetail.child.displayName}</h1>
              </div>
              <button
                type="button"
                onClick={() => launchChildWorkspace(childDetail.child)}
                className="px-5 py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold"
              >
                Open child learning space
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="rounded-2xl bg-white border border-[#245C45]/12 p-6 space-y-3">
                <h2 className="font-display text-lg font-bold">Completed Lessons</h2>
                {childDetail.completedLessons?.length === 0 ? (
                  <p className="text-sm text-[#4A5851]">No lessons completed yet.</p>
                ) : (
                  childDetail.completedLessons.map((l: any) => (
                    <div key={l.id} className="text-sm flex justify-between py-2 border-b border-[#245C45]/8">
                      <span>{l.lessonTitle}</span>
                      <span className="font-mono text-xs text-[#245C45]">{l.status}</span>
                    </div>
                  ))
                )}
              </div>

              <div className="rounded-2xl bg-white border border-[#245C45]/12 p-6 space-y-3">
                <h2 className="font-display text-lg font-bold">Recent Voice Practice</h2>
                {childDetail.voiceSessions?.length === 0 ? (
                  <p className="text-sm text-[#4A5851]">No voice sessions recorded yet.</p>
                ) : (
                  childDetail.voiceSessions.map((v: any) => (
                    <div key={v.id} className="text-xs py-2 border-b border-[#245C45]/8">
                      <p className="font-semibold text-[#245C45]">{v.mode} · {v.durationSeconds}s</p>
                      <p className="text-[#4A5851]">{v.feedback}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : section === 'settings' ? (
          <div className="max-w-xl rounded-3xl bg-white border border-[#245C45]/12 p-7 space-y-5">
            <h1 className="font-display text-2xl font-bold">Child Privacy &amp; Safety Controls</h1>
            <p className="text-sm text-[#4A5851]">
              Children never have public profiles or open messaging. Configure AI Live voice
              access, transcript retention, and guardian consent below.
            </p>
            <label className="flex items-start gap-3 p-4 rounded-2xl bg-[#FFF1E6] cursor-pointer text-sm">
              <input
                type="checkbox"
                disabled={!hasActiveConsent}
                checked={Boolean(data?.parent?.allowAiLiveForChildren)}
                onChange={(e) =>
                  handleUpdatePrivacy(e.target.checked, data?.parent?.recordingRetentionDays ?? 7)
                }
                className="mt-1 accent-[#245C45]"
              />
              <span>
                <strong>Allow supervised Live AI voice conversations</strong>
                <br />
                <span className="text-xs text-[#4A5851]">
                  When unchecked, young learners use guided Listen &amp; Learn and Speak &amp;
                  Practise only.
                </span>
              </span>
            </label>

            <div>
              <label className="block text-xs font-semibold text-[#245C45] mb-1.5">
                Voice Transcript Retention
              </label>
              <select
                value={data?.parent?.recordingRetentionDays ?? 7}
                onChange={(e) =>
                  handleUpdatePrivacy(
                    Boolean(data?.parent?.allowAiLiveForChildren),
                    Number(e.target.value)
                  )
                }
                className="w-full rounded-xl border border-[#245C45]/20 px-3.5 py-2.5 text-sm"
              >
                <option value={0}>Do not store child transcripts (0 days)</option>
                <option value={7}>Keep for 7 days</option>
                <option value={30}>Keep for 30 days</option>
                <option value={90}>Keep for 90 days</option>
              </select>
            </div>

            {hasActiveConsent && (
              <div className="pt-3 border-t border-[#245C45]/10 flex items-center justify-between gap-4">
                <div className="text-xs text-[#4A5851]">
                  Consent active ({data?.parent?.consentVersion || 'current'})
                </div>
                <button
                  type="button"
                  onClick={handleRevokeConsent}
                  className="px-4 py-2 rounded-xl border border-[#B43C25]/40 text-[#B43C25] text-xs font-semibold hover:bg-[#F28B75]/10"
                >
                  Revoke guardian consent
                </button>
              </div>
            )}
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-3xl font-bold">Family Learning Overview</h1>
                <p className="text-sm text-[#4A5851]">
                  Calm visibility into your children&apos;s English progress without surveillance.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {(data?.children || []).map((child) => (
                <div
                  key={child.id}
                  className="rounded-2xl bg-white border border-[#245C45]/12 p-6 flex flex-col justify-between space-y-4"
                >
                  <div>
                    <p className="text-xs text-[#4A5851] mb-1">
                      Ages {child.ageRange} · Level {child.cefrLevel}
                    </p>
                    <h2 className="font-display text-xl font-bold">{child.displayName}</h2>
                    <p className="text-sm text-[#4A5851] mt-2 tabular-nums">
                      {child.completedLessonsCount} lessons · {child.xp} stars · {child.streakDays}d streak
                    </p>
                  </div>
                  <div className="flex items-center gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => launchChildWorkspace(child)}
                      className="flex-1 py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-xs font-semibold"
                    >
                      Launch learning
                    </button>
                    <Link
                      to={`/parent/children/${child.id}`}
                      className="px-3.5 py-2.5 rounded-xl border border-[#245C45]/20 text-xs font-semibold text-[#245C45]"
                    >
                      Report
                    </Link>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Child Profile Form */}
            <form
              onSubmit={handleCreateChild}
              className="rounded-3xl bg-white border border-[#245C45]/12 p-7 space-y-4 max-w-2xl"
            >
              <h2 className="font-display text-xl font-bold flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#245C45]" /> Register a Child Profile
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Child's first name"
                  className="rounded-xl border border-[#245C45]/20 px-3.5 py-2.5 text-sm"
                />
                <select
                  value={env}
                  onChange={(e) => {
                    const v = e.target.value as any;
                    setEnv(v);
                    setAgeRange(v === 'little_voices' ? '3-5' : v === 'young_explorers' ? '6-10' : '11-17');
                  }}
                  className="rounded-xl border border-[#245C45]/20 px-3 py-2.5 text-sm"
                >
                  <option value="little_voices">Little Voices (3–5)</option>
                  <option value="young_explorers">Young Explorers (6–10)</option>
                  <option value="teen_voices">Teen Voices (11–17)</option>
                </select>
                <button
                  type="submit"
                  disabled={!hasActiveConsent || !consent}
                  className="rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold py-2.5 px-4 disabled:opacity-50"
                >
                  Add child
                </button>
              </div>
              <label className="flex items-center gap-2 text-xs text-[#4A5851] cursor-pointer">
                <input
                  type="checkbox"
                  checked={consent}
                  onChange={(e) => setConsent(e.target.checked)}
                  className="accent-[#245C45]"
                />
                <ShieldCheck className="w-4 h-4 text-[#245C45]" />
                <span>Guardian consent confirmed for private, ad-free child voice practice.</span>
              </label>
            </form>
          </>
        )}
      </div>
    </PortalLayout>
  );
}
