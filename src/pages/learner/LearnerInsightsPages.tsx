import { useEffect, useState } from 'react';
import { Award, CheckCircle2, Flame, HardDrive, RefreshCw, Trash2, Zap } from 'lucide-react';
import { apiFetch } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { ENVIRONMENTS } from '../../utils/environments';
import { CefrLevel, LearningEnvironment } from '../../types/sauti';
import {
  buildOfflineScopeKey,
  formatBytes,
  getScopeStorageSummary,
  ScopeStorageSummary,
} from '../../lib/offlineDb';
import { useOfflineStore } from '../../stores/offlineStore';

export function LearnerAchievementsPage() {
  const { activeChildId } = useAuthStore();
  const [achievements, setAchievements] = useState<any[]>([]);
  const [xp, setXp] = useState(0);

  useEffect(() => {
    const qs = activeChildId ? `?learnerId=${activeChildId}` : '';
    apiFetch<any>(`/api/learning/dashboard${qs}`).then((res) => {
      setAchievements(res.achievements || []);
      setXp(res.learner?.xp || 0);
    });
  }, [activeChildId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl font-bold">Achievements &amp; Milestones</h1>
        <p className="text-sm text-[#4A5851] tabular-nums">
          Total earned XP: {xp} · Unlocked strictly through real completed practice.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {achievements.map((ach) => (
          <div
            key={ach.id}
            className={`rounded-2xl p-6 border ${
              ach.earned
                ? 'bg-white border-[#245C45]'
                : 'bg-[#FFF8ED]/60 border-[#245C45]/12 opacity-65'
            }`}
          >
            <Award className={`w-7 h-7 mb-3 ${ach.earned ? 'text-[#245C45]' : 'text-[#4A5851]'}`} />
            <h2 className="font-display font-bold text-lg">{ach.title}</h2>
            <p className="text-xs text-[#4A5851] mt-1 mb-3">{ach.description}</p>
            <span className="text-xs font-mono font-semibold text-[#245C45]">
              {ach.earned ? 'Earned' : `Reward: +${ach.xpReward} XP`}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LearnerProgressPage() {
  const { activeChildId } = useAuthStore();
  const [dashboard, setDashboard] = useState<any>(null);

  useEffect(() => {
    const qs = activeChildId ? `?learnerId=${activeChildId}` : '';
    apiFetch<any>(`/api/learning/dashboard${qs}`).then(setDashboard);
  }, [activeChildId]);

  if (!dashboard) return <div className="h-48 rounded-2xl bg-[#245C45]/10 animate-pulse" />;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Learning Progress</h1>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white border border-[#245C45]/12 p-6">
          <p className="text-xs text-[#4A5851]">Lessons Completed</p>
          <p className="font-display text-3xl font-bold tabular-nums mt-1">
            {dashboard.completedLessonsCount} / {dashboard.totalLessonsCount}
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-[#245C45]/12 p-6">
          <p className="text-xs text-[#4A5851]">Current Streak</p>
          <p className="font-display text-3xl font-bold tabular-nums mt-1 flex items-center gap-2">
            <Flame className="w-6 h-6 text-[#F28B75]" />
            {dashboard.learner?.streakDays || 0} days
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-[#245C45]/12 p-6">
          <p className="text-xs text-[#4A5851]">CEFR Level</p>
          <p className="font-display text-3xl font-bold mt-1">{dashboard.learner?.cefrLevel}</p>
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-[#245C45]/12 p-6 space-y-3">
        <h2 className="font-display text-xl font-bold">Pathway Checklist</h2>
        {(dashboard.recommendedLessons || []).map((l: any) => (
          <div key={l.id} className="flex items-center justify-between py-2 border-b border-[#245C45]/8 last:border-0">
            <span className="text-sm font-medium">{l.title}</span>
            <span className={`text-xs font-semibold ${l.completed ? 'text-[#245C45]' : 'text-[#4A5851]'}`}>
              {l.completed ? 'Completed' : 'Pending'}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function LearnerHistoryPage() {
  const { activeChildId } = useAuthStore();
  const [history, setHistory] = useState<any>(null);

  useEffect(() => {
    const qs = activeChildId ? `?learnerId=${activeChildId}` : '';
    apiFetch<any>(`/api/learning/history${qs}`).then(setHistory);
  }, [activeChildId]);

  if (!history) return <div className="h-48 rounded-2xl bg-[#245C45]/10 animate-pulse" />;

  return (
    <div className="space-y-6">
      <h1 className="font-display text-3xl font-bold">Practice &amp; Activity History</h1>
      <div className="rounded-2xl bg-white border border-[#245C45]/12 p-6 space-y-3">
        <h2 className="font-display text-lg font-bold">Recent Activity Attempts</h2>
        {history.attempts?.length === 0 ? (
          <p className="text-sm text-[#4A5851]">No lesson activity attempts yet.</p>
        ) : (
          history.attempts.map((a: any) => (
            <div key={a.id} className="py-2.5 border-b border-[#245C45]/10 last:border-0 flex items-center justify-between text-sm">
              <span>{a.feedback}</span>
              <span className="font-mono text-xs tabular-nums text-[#245C45]">+{a.score} XP</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function LearnerProfileSettingsPage() {
  const { user, learnerProfile, activeChildId, setLearnerProfile } = useAuthStore();
  const {
    isOnline,
    lowBandwidthMode,
    pendingSyncCount,
    isSyncing,
    setLowBandwidthMode,
    syncPendingQueue,
    clearPendingQueue,
    clearActiveScopeData,
  } = useOfflineStore();
  const scopeKey = buildOfflineScopeKey(user?.id, activeChildId ?? learnerProfile?.id ?? null);

  const [displayName, setDisplayName] = useState(learnerProfile?.displayName || '');
  const [environment, setEnvironment] = useState<LearningEnvironment>(
    learnerProfile?.environment || 'young_adults'
  );
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>(learnerProfile?.cefrLevel || 'A1');
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState(learnerProfile?.dailyGoalMinutes || 15);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const [storageSummary, setStorageSummary] = useState<ScopeStorageSummary | null>(null);

  const loadStorageSummary = () => {
    getScopeStorageSummary(scopeKey)
      .then(setStorageSummary)
      .catch(() => setStorageSummary(null));
  };

  useEffect(() => {
    loadStorageSummary();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scopeKey, pendingSyncCount]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavedMsg(null);
    setErrMsg(null);
    try {
      const res = await apiFetch<{ learnerProfile: any }>('/api/learning/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          learnerId: activeChildId || undefined,
          displayName,
          environment,
          cefrLevel,
          dailyGoalMinutes,
        }),
      });
      setLearnerProfile(res.learnerProfile);
      setSavedMsg('Preferences saved and applied across your workspace.');
    } catch (err: any) {
      setErrMsg(err.message || 'Unable to update learner settings.');
    }
  };

  const handleClearOffline = async () => {
    await clearActiveScopeData();
    loadStorageSummary();
    setSavedMsg('Cleared all locally stored lessons, recordings, and sync items for this learner.');
  };

  return (
    <div className="max-w-2xl space-y-6">
      <h1 className="font-display text-3xl font-bold">Profile &amp; Learning Settings</h1>
      {savedMsg && (
        <div className="rounded-xl bg-[#245C45]/10 border border-[#245C45]/30 p-4 text-sm flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#245C45]" />
          <span>{savedMsg}</span>
        </div>
      )}
      {errMsg && (
        <div className="rounded-xl bg-[#F28B75]/15 border border-[#F28B75] p-4 text-sm text-[#B43C25]">
          {errMsg}
        </div>
      )}
      <form onSubmit={handleSave} className="rounded-3xl bg-white border border-[#245C45]/12 p-7 space-y-5">
        <div>
          <label className="block text-xs font-semibold text-[#245C45] mb-1.5">Account Email</label>
          <p className="text-sm text-[#4A5851]">{user?.email}</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#245C45] mb-1.5">Display Name</label>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="w-full rounded-xl border border-[#245C45]/20 px-3.5 py-2.5 text-sm"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#245C45] mb-1.5">
            Learning Environment (switches UI theme)
          </label>
          <select
            value={environment}
            onChange={(e) => setEnvironment(e.target.value as LearningEnvironment)}
            className="w-full rounded-xl border border-[#245C45]/20 px-3.5 py-2.5 text-sm"
          >
            {ENVIRONMENTS.map((env) => (
              <option key={env.id} value={env.id}>
                {env.title} (Ages {env.ageRange})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#245C45] mb-1.5">CEFR Level</label>
          <select
            value={cefrLevel}
            onChange={(e) => setCefrLevel(e.target.value as CefrLevel)}
            className="w-full rounded-xl border border-[#245C45]/20 px-3.5 py-2.5 text-sm"
          >
            {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl) => (
              <option key={lvl} value={lvl}>
                {lvl}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#245C45] mb-1.5">
            Daily Goal (Minutes)
          </label>
          <input
            type="number"
            min={5}
            max={120}
            value={dailyGoalMinutes}
            onChange={(e) => setDailyGoalMinutes(Number(e.target.value))}
            className="w-full rounded-xl border border-[#245C45]/20 px-3.5 py-2.5 text-sm tabular-nums"
          />
        </div>

        <button
          type="submit"
          className="px-6 py-3 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold hover:bg-[#194231]"
        >
          Save preferences
        </button>
      </form>

      {/* Offline, Data-Saving & Device Privacy Controls */}
      <section className="rounded-3xl bg-white border border-[#245C45]/12 p-7 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-xl font-bold flex items-center gap-2">
              <HardDrive className="w-5 h-5 text-[#245C45]" />
              <span>Offline Access, Data-Saving &amp; Local Privacy</span>
            </h2>
            <p className="text-xs text-[#4A5851] mt-1">
              Offline downloads and local recordings are isolated strictly to this learner profile on
              this browser.
            </p>
          </div>
        </div>

        <label className="flex items-start justify-between gap-4 rounded-2xl bg-[#FDF3E3] p-4 cursor-pointer">
          <div className="space-y-1">
            <span className="font-display font-bold text-sm flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-[#245C45]" />
              <span>Data-Saving Mode</span>
            </span>
            <p className="text-xs text-[#4A5851]">
              Skips decorative image downloads and uses your device&apos;s built-in SpeechSynthesis
              voice instead of downloading server audio files.
            </p>
          </div>
          <input
            type="checkbox"
            checked={lowBandwidthMode}
            onChange={(e) => setLowBandwidthMode(e.target.checked)}
            className="mt-1 h-4 w-4 accent-[#245C45]"
          />
        </label>

        {storageSummary && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div className="rounded-xl bg-[#FFF8ED] border border-[#245C45]/10 p-3">
              <p className="text-[#4A5851]">Offline lessons</p>
              <p className="font-display font-bold text-lg tabular-nums">{storageSummary.lessonCount}</p>
            </div>
            <div className="rounded-xl bg-[#FFF8ED] border border-[#245C45]/10 p-3">
              <p className="text-[#4A5851]">Saved recordings</p>
              <p className="font-display font-bold text-lg tabular-nums">{storageSummary.recordingCount}</p>
            </div>
            <div className="rounded-xl bg-[#FFF8ED] border border-[#245C45]/10 p-3">
              <p className="text-[#4A5851]">Local storage used</p>
              <p className="font-display font-bold text-lg tabular-nums">
                {formatBytes(storageSummary.totalBytes)}
              </p>
            </div>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-3 pt-1">
          {pendingSyncCount > 0 && (
            <>
              <button
                type="button"
                disabled={!isOnline || isSyncing}
                onClick={() => void syncPendingQueue()}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#245C45] text-[#FFF8ED] text-xs font-semibold disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                <span>Sync {pendingSyncCount} queued update(s)</span>
              </button>
              <button
                type="button"
                onClick={() => void clearPendingQueue()}
                className="px-4 py-2.5 rounded-xl border border-[#245C45]/20 text-xs font-semibold text-[#4A5851]"
              >
                Clear sync queue
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => void handleClearOffline()}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl border border-[#F28B75] text-xs font-semibold text-[#B43C25] hover:bg-[#F28B75]/10"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Clear locally stored learner data</span>
          </button>
        </div>
      </section>
    </div>
  );
}
