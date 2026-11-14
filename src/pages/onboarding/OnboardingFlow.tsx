import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Check } from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { apiFetch } from '../../services/api';
import { AgeRange, CefrLevel, LearningEnvironment } from '../../types/sauti';
import { CEFR_DESCRIPTIONS, ENVIRONMENTS } from '../../utils/environments';
import { AnimatedProgressBar, SAUTI_EASE } from '../../components/motion/SautiMotion';

const PLACEMENT_QUESTIONS = [
  {
    id: 'q1',
    prompt: '1. You meet a colleague or new neighbour for the first time. Which sounds most natural?',
    options: [
      { id: 'a', label: 'Good morning! My name is...', weight: 1 },
      { id: 'b', label: 'Pleased to meet you—what brings you to the neighbourhood?', weight: 2 },
      { id: 'c', label: 'Lovely to connect; I have been looking forward to comparing notes with you.', weight: 3 },
    ],
  },
  {
    id: 'q2',
    prompt: '2. Choose the clearest sentence:',
    options: [
      { id: 'a', label: 'She walk to school every morning.', weight: 1 },
      { id: 'b', label: 'She walks to school every morning before the traffic starts.', weight: 2 },
      { id: 'c', label: 'Had she left earlier, she would have caught the express train.', weight: 3 },
    ],
  },
  {
    id: 'q3',
    prompt: '3. When you listen to fast English conversations, how comfortable do you feel?',
    options: [
      { id: 'a', label: 'I know single everyday words and short greetings.', weight: 1 },
      { id: 'b', label: 'I follow main ideas if people speak clearly.', weight: 2 },
      { id: 'c', label: 'I follow debates, nuance, and fast discussions comfortably.', weight: 3 },
    ],
  },
];

function computeRecommendedCefr(answers: Record<string, string>): { level: CefrLevel; score: number } {
  let total = 0;
  for (const q of PLACEMENT_QUESTIONS) {
    const picked = q.options.find((o) => o.id === answers[q.id]);
    total += picked?.weight || 1;
  }
  if (total <= 4) return { level: 'A1', score: total };
  if (total === 5) return { level: 'A2', score: total };
  if (total === 6) return { level: 'B1', score: total };
  if (total === 7) return { level: 'B2', score: total };
  if (total === 8) return { level: 'C1', score: total };
  return { level: 'C2', score: total };
}

const GOAL_OPTIONS = [
  'Speak confidently in everyday life',
  'Improve pronunciation and clarity',
  'Prepare for school or university discussions',
  'Lead workplace meetings & interviews',
  'Practise calm travel conversations',
];

const ACTIVITY_OPTIONS = [
  'Voice Studio conversations',
  'Pronunciation Coach',
  'Story comprehension',
  'Sentence building & grammar',
  'Listening & repeat',
];

export function OnboardingFlow() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, learnerProfile, setSession } = useAuthStore();
  const reduced = useReducedMotion();

  const step = location.pathname.includes('assessment')
    ? 'assessment'
    : location.pathname.includes('goals')
    ? 'goals'
    : 'profile';

  const [displayName, setDisplayName] = useState(
    learnerProfile?.displayName || user?.displayName || ''
  );
  const [environment, setEnvironment] = useState<LearningEnvironment>(
    learnerProfile?.environment || 'young_adults'
  );
  const [ageRange, setAgeRange] = useState<AgeRange>(learnerProfile?.ageRange || '18-25');
  const [answers, setAnswers] = useState<Record<string, string>>({ q1: 'b', q2: 'b', q3: 'b' });
  const [cefrLevel, setCefrLevel] = useState<CefrLevel>(learnerProfile?.cefrLevel || 'A2');
  const [goals, setGoals] = useState<string[]>(['Speak confidently in everyday life']);
  const [preferredActivities, setPreferredActivities] = useState<string[]>([
    'Voice Studio conversations',
    'Pronunciation Coach',
  ]);
  const [dailyGoalMinutes, setDailyGoalMinutes] = useState<number>(15);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleEnvSelect = (envId: LearningEnvironment) => {
    setEnvironment(envId);
    const matched = ENVIRONMENTS.find((e) => e.id === envId);
    if (matched) setAgeRange(matched.ageRange);
  };

  const handleAssessmentNext = () => {
    const rec = computeRecommendedCefr(answers);
    setCefrLevel(rec.level);
    navigate('/onboarding/goals');
  };

  const toggleItem = (list: string[], setter: (v: string[]) => void, item: string) => {
    setter(list.includes(item) ? list.filter((i) => i !== item) : [...list, item]);
  };

  const handleFinish = async () => {
    setSaving(true);
    setError(null);
    const { score } = computeRecommendedCefr(answers);
    try {
      const res = await apiFetch<any>('/api/auth/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          displayName: displayName.trim() || 'SAUTI Learner',
          ageRange,
          environment,
          cefrLevel,
          goals,
          preferredActivities,
          dailyGoalMinutes,
          assessmentAnswers: answers,
          assessmentScore: score,
        }),
      });
      setSession({
        user: res.user,
        learnerProfile: res.learnerProfile,
        parentProfile: res.parentProfile,
        teacherProfile: res.teacherProfile,
      });
      navigate('/learn/dashboard');
    } catch (err: any) {
      setError(err.message || 'Unable to save onboarding profile.');
    } finally {
      setSaving(false);
    }
  };

  const stepPct = step === 'profile' ? 33 : step === 'assessment' ? 67 : 100;

  return (
    <div className="min-h-screen bg-[#FFF8ED] bg-warm-grid text-[#17201C] py-10 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center justify-between mb-4">
          <span className="font-display text-2xl font-bold text-[#245C45]">SAUTI</span>
          <div className="flex items-center gap-2 text-xs font-mono font-semibold text-[#4A5851]">
            <span className={step === 'profile' ? 'text-[#245C45]' : ''}>01. Profile</span>
            <span>·</span>
            <span className={step === 'assessment' ? 'text-[#245C45]' : ''}>02. Placement</span>
            <span>·</span>
            <span className={step === 'goals' ? 'text-[#245C45]' : ''}>03. Goals</span>
          </div>
        </div>
        <div className="mb-8">
          <AnimatedProgressBar value={stepPct} ariaLabel="Onboarding step progress" />
        </div>

        <div className="rounded-3xl sauti-surface p-7 sm:p-10">
          {error && (
            <div className="mb-5 rounded-xl bg-[#F28B75]/15 border border-[#F28B75] p-3.5 text-sm">
              {error}
            </div>
          )}

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={reduced ? false : { opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={reduced ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: SAUTI_EASE }}
            >
          {step === 'profile' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-3xl font-bold mb-2">
                  Tell us about the learner
                </h1>
                <p className="text-sm text-[#4A5851]">
                  Age chooses your interface style; next we&apos;ll calibrate your CEFR level.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#245C45] mb-1.5">
                  Display Name
                </label>
                <input
                  type="text"
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="How should SAUTI greet you?"
                  className="w-full rounded-xl border border-[#245C45]/20 px-4 py-3 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#245C45] mb-2">
                  Select Learning Environment
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {ENVIRONMENTS.map((env) => {
                    const active = environment === env.id;
                    return (
                      <button
                        key={env.id}
                        type="button"
                        onClick={() => handleEnvSelect(env.id)}
                        className={`text-left p-4 rounded-2xl border transition-colors ${
                          active
                            ? 'bg-[#245C45] text-[#FFF8ED] border-[#245C45]'
                            : 'bg-[#FFF8ED]/50 border-[#245C45]/15 hover:border-[#245C45]'
                        }`}
                      >
                        <p className="text-xs opacity-80">Ages {env.ageRange}</p>
                        <p className="font-display font-bold text-base">{env.title}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={() => navigate('/onboarding/assessment')}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold hover:bg-[#194231]"
                >
                  <span>Continue to placement</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 'assessment' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-3xl font-bold mb-2">Quick placement check</h1>
                <p className="text-sm text-[#4A5851]">
                  Any age can start at any level from A1 to C2. Answer honestly so we pick the right
                  starting point.
                </p>
              </div>

              <div className="space-y-6">
                {PLACEMENT_QUESTIONS.map((q) => (
                  <div key={q.id} className="space-y-2.5">
                    <p className="text-sm font-semibold text-[#17201C]">{q.prompt}</p>
                    <div className="space-y-2">
                      {q.options.map((opt) => {
                        const selected = answers[q.id] === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                            className={`w-full text-left px-4 py-3 rounded-xl border text-sm transition-colors ${
                              selected
                                ? 'bg-[#245C45] text-[#FFF8ED] border-[#245C45]'
                                : 'bg-white border-[#245C45]/15 hover:border-[#245C45]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/onboarding/profile')}
                  className="text-sm font-semibold text-[#4A5851] hover:text-[#17201C]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={handleAssessmentNext}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold hover:bg-[#194231]"
                >
                  <span>See recommended level</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 'goals' && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-3xl font-bold mb-2">
                  Your starting level &amp; learning goals
                </h1>
                <p className="text-sm text-[#4A5851]">
                  Based on your responses, we suggest{' '}
                  <strong className="text-[#245C45]">{CEFR_DESCRIPTIONS[cefrLevel].label}</strong>.
                  You can adjust this anytime.
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#245C45] mb-2">
                  Confirm CEFR Starting Level
                </label>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                  {(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as CefrLevel[]).map((lvl) => (
                    <button
                      key={lvl}
                      type="button"
                      onClick={() => setCefrLevel(lvl)}
                      className={`py-2.5 rounded-xl font-display font-bold text-sm border ${
                        cefrLevel === lvl
                          ? 'bg-[#245C45] text-[#FFF8ED] border-[#245C45]'
                          : 'bg-white border-[#245C45]/15 text-[#17201C]'
                      }`}
                    >
                      {lvl}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-[#4A5851] mt-2">{CEFR_DESCRIPTIONS[cefrLevel].summary}</p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#245C45] mb-2">
                  Learning Goals
                </label>
                <div className="flex flex-wrap gap-2">
                  {GOAL_OPTIONS.map((g) => {
                    const active = goals.includes(g);
                    return (
                      <button
                        key={g}
                        type="button"
                        onClick={() => toggleItem(goals, setGoals, g)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors ${
                          active
                            ? 'bg-[#245C45] text-[#FFF8ED] border-[#245C45]'
                            : 'bg-[#FFF8ED]/50 border-[#245C45]/15'
                        }`}
                      >
                        {active && <Check className="w-3 h-3 inline mr-1" />}
                        {g}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#245C45] mb-2">
                  Preferred Activities
                </label>
                <div className="flex flex-wrap gap-2">
                  {ACTIVITY_OPTIONS.map((act) => {
                    const active = preferredActivities.includes(act);
                    return (
                      <button
                        key={act}
                        type="button"
                        onClick={() => toggleItem(preferredActivities, setPreferredActivities, act)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-medium border transition-colors ${
                          active
                            ? 'bg-[#F6C96B] text-[#17201C] border-[#F6C96B]'
                            : 'bg-white border-[#245C45]/15'
                        }`}
                      >
                        {act}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#245C45] mb-2">
                  Daily Practice Rhythm
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {[10, 15, 25, 40].map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setDailyGoalMinutes(mins)}
                      className={`py-2.5 rounded-xl text-sm font-semibold border tabular-nums ${
                        dailyGoalMinutes === mins
                          ? 'bg-[#245C45] text-[#FFF8ED] border-[#245C45]'
                          : 'bg-white border-[#245C45]/15'
                      }`}
                    >
                      {mins} min
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between pt-4">
                <button
                  type="button"
                  onClick={() => navigate('/onboarding/assessment')}
                  className="text-sm font-semibold text-[#4A5851]"
                >
                  Back
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={handleFinish}
                  className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold hover:bg-[#194231] disabled:opacity-60"
                >
                  <span>{saving ? 'Saving profile...' : 'Enter my SAUTI workspace'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
