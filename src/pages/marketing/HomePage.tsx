import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  ArrowRight,
  Award,
  BookOpen,
  Check,
  ChevronDown,
  GraduationCap,
  Headphones,
  MessageSquare,
  Mic,
  ShieldCheck,
  Sparkles,
  Users,
  Volume2,
} from 'lucide-react';
import { PublicHeader } from '../../components/navigation/PublicHeader';
import { ResilientImage } from '../../components/ui/ResilientImage';
import { ENVIRONMENTS, SAUTI_IMAGES } from '../../utils/environments';
import { useSpeechPlayback } from '../../hooks/useSpeechPlayback';

const PREVIEW_PHRASES = [
  {
    level: 'A1 · Little Voices & Starters',
    text: 'Good morning! Look at the yellow sun.',
    note: 'Warm everyday greeting with clear vowel sounds.',
  },
  {
    level: 'B1 · Teen & Young Adult Fluency',
    text: 'From my perspective, practising out loud builds lasting confidence.',
    note: 'Structured opinion framing for school and social conversations.',
  },
  {
    level: 'C1 · Professional & Lifelong',
    text: 'To align on our primary objective, let us review the timeline together.',
    note: 'Calm, authoritative phrasing for meetings and briefings.',
  },
];

const SAMPLE_TESTIMONIALS = [
  {
    name: 'Wanjiku M.',
    role: 'Parent of a 5-year-old · Nairobi',
    quote:
      'Sample story: My daughter looks forward to tapping the animal cards and repeating short morning greetings without feeling pressured to read early.',
  },
  {
    name: 'David O.',
    role: 'Operations Coordinator · Mombasa',
    quote:
      'Sample story: Having a calm Voice Studio where I can test meeting introductions before a client call helped me stop second-guessing my pacing.',
  },
  {
    name: 'Grace K.',
    role: 'Secondary English Teacher · Kisumu',
    quote:
      'Sample story: Being able to separate age experience from CEFR proficiency means a 14-year-old beginner never feels placed in a toddler interface.',
  },
];

const EXAMPLE_PLANS = [
  {
    name: 'Individual Starter',
    price: 'Free preview',
    period: 'Sample plan',
    summary: 'Core CEFR lessons, Listen & Learn audio, and daily Voice Studio recording.',
    features: ['Age-matched interface', 'A1–C2 starter courses', 'Browser audio & mic practice'],
    cta: 'Try Starter',
    accountType: 'individual',
  },
  {
    name: 'Family & Plus',
    price: 'Example · $9 / mo',
    period: 'Illustrative pricing',
    summary: 'Up to 4 learner profiles with parent privacy controls and full AI Voice Coach.',
    features: ['Parent oversight & consent tools', 'Pronunciation transcript feedback', 'Live AI conversation studio'],
    cta: 'Register as Parent',
    accountType: 'parent',
    highlighted: true,
  },
  {
    name: 'Schools & Institutions',
    price: 'Custom pilot',
    period: 'Illustrative pricing',
    summary: 'Classroom rosters, join codes, assigned CEFR modules, and cohort reporting.',
    features: ['Unlimited classroom groups', 'Teacher progress dashboards', 'Child-safe privacy defaults'],
    cta: 'Teacher & School Entry',
    accountType: 'teacher',
  },
];

const FAQS = [
  {
    q: 'Does SAUTI assume older learners are advanced and children are beginners?',
    a: 'No. Age and English proficiency are kept separate. Every age environment—from Little Voices (3–5) to Lifelong English (46+)—supports beginner (A1–A2), intermediate (B1–B2), and advanced (C1–C2) pathways.',
  },
  {
    q: 'How does SAUTI protect children using voice features?',
    a: 'Child accounts require parent or guardian registration and consent. Free-form AI conversations are restricted for young learners by default, raw audio is not stored permanently, and there is no public messaging between children.',
  },
  {
    q: 'What happens if AI voice credentials are not active?',
    a: 'SAUTI transparently switches speech playback to your browser’s built-in voice engine and clearly labels live AI conversations as Demo Mode—never pretending a live AI session is active when it is not.',
  },
  {
    q: 'How does Pronunciation Coach give feedback?',
    a: 'You hear a reference phrase, record your own voice with real microphone capture, and compare the resulting transcript word-by-word against the target text without fabricated acoustic precision scores.',
  },
];

export function HomePage() {
  const [selectedPreviewIdx, setSelectedPreviewIdx] = useState(0);
  const [previewAnswer, setPreviewAnswer] = useState<string | null>(null);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const { speak, isSpeaking, isLoading, engineUsed } = useSpeechPlayback();

  const currentPhrase = PREVIEW_PHRASES[selectedPreviewIdx];

  return (
    <div className="min-h-screen bg-[#FFF8ED] text-[#17201C]">
      <PublicHeader />

      {/* 1. Hero Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-16 lg:pt-16 lg:pb-24">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-stretch">
          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="lg:col-span-6 flex flex-col justify-center"
          >
            <p className="text-sm font-semibold text-[#245C45] mb-3">
              Voice-first English learning · CEFR A1 to C2
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[56px] font-bold leading-[1.08] tracking-tight text-[#17201C] headline-balance mb-5">
              Don&apos;t just learn English. Find your voice.
            </h1>
            <p className="text-lg sm:text-xl text-[#4A5851] leading-relaxed max-w-xl mb-3">
              Speak with confidence. Learn at your own pace.
            </p>
            <p className="text-base text-[#4A5851] leading-relaxed max-w-xl mb-8">
              SAUTI adapts to every stage of life—combining interactive lessons, real microphone
              practice, and patient AI-assisted conversations from early childhood to executive
              leadership.
            </p>

            <div className="flex flex-wrap items-center gap-4">
              <Link
                to="/get-started"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-[#245C45] text-[#FFF8ED] font-semibold hover:bg-[#194231] transition-colors whitespace-nowrap"
              >
                <span>Start learning</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <a
                href="#how-it-works"
                className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl border border-[#245C45]/25 text-[#245C45] font-semibold hover:bg-[#245C45]/5 transition-colors whitespace-nowrap"
              >
                <span>Explore SAUTI</span>
              </a>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="lg:col-span-6 flex"
          >
            <div className="w-full rounded-3xl overflow-hidden border border-[#245C45]/12 bg-[#FDF3E3]">
              <ResilientImage
                src={SAUTI_IMAGES.heroVoices}
                alt="Diverse learners of all ages speaking and listening together in SAUTI's sunlit studio"
                className="w-full h-full object-cover min-h-[300px] lg:min-h-[420px]"
              />
            </div>
          </motion.div>
        </div>

        {/* Full-width 4-column summary strip below hero split */}
        <div className="mt-12 grid grid-cols-2 lg:grid-cols-4 gap-4 border-t border-[#245C45]/12 pt-8">
          <div>
            <p className="font-display text-2xl font-bold text-[#245C45] tabular-nums">6</p>
            <p className="text-sm text-[#4A5851] mt-1">Age-tailored visual interfaces</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-[#245C45] tabular-nums">A1 – C2</p>
            <p className="text-sm text-[#4A5851] mt-1">Independent CEFR proficiency paths</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-[#245C45] tabular-nums">4 Modes</p>
            <p className="text-sm text-[#4A5851] mt-1">Listen, Speak, Coach &amp; Live AI</p>
          </div>
          <div>
            <p className="font-display text-2xl font-bold text-[#245C45] tabular-nums">15 Types</p>
            <p className="text-sm text-[#4A5851] mt-1">Interactive multi-sensory activities</p>
          </div>
        </div>
      </section>

      {/* 2. Introduction & How SAUTI Works */}
      <section id="how-it-works" className="bg-[#FDF3E3] border-y border-[#245C45]/10 py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-2xl mb-12">
            <p className="text-sm font-semibold text-[#245C45] mb-2">How SAUTI works</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#17201C] headline-balance mb-4">
              Speaking and listening sit at the centre of every lesson.
            </h2>
            <p className="text-base text-[#4A5851] leading-relaxed">
              Instead of reducing language learning to silent multiple-choice taps, SAUTI pairs
              natural listening, real microphone capture, and thoughtful feedback.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-[#FFF8ED] rounded-2xl p-7 border border-[#245C45]/12">
              <p className="font-mono text-xs text-[#245C45] mb-3">01 · Placement &amp; Space</p>
              <h3 className="font-display text-xl font-bold mb-2">Choose your age space and level</h3>
              <p className="text-sm text-[#4A5851] leading-relaxed">
                Pick an environment designed for your stage of life, then complete a short placement
                check across CEFR A1 to C2—never assuming every adult is advanced or every child is
                new.
              </p>
            </div>
            <div className="bg-[#FFF8ED] rounded-2xl p-7 border border-[#245C45]/12">
              <p className="font-mono text-xs text-[#245C45] mb-3">02 · Interactive Lessons</p>
              <h3 className="font-display text-xl font-bold mb-2">Practise beyond quizzes</h3>
              <p className="text-sm text-[#4A5851] leading-relaxed">
                Move through structured modules featuring picture recognition, sentence building,
                story comprehension, spelling, grammar correction, and spoken role-play.
              </p>
            </div>
            <div className="bg-[#FFF8ED] rounded-2xl p-7 border border-[#245C45]/12">
              <p className="font-mono text-xs text-[#245C45] mb-3">03 · Voice Studio</p>
              <h3 className="font-display text-xl font-bold mb-2">Hear, record, and converse</h3>
              <p className="text-sm text-[#4A5851] leading-relaxed">
                Replay your own recordings alongside reference speech, compare spoken transcripts
                word-by-word, and practise calm conversations at your own rhythm.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Age-Specific Learning Experiences */}
      <section id="journeys" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-[#245C45] mb-2">Six tailored environments</p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#17201C] headline-balance">
              One learning engine, crafted differently for every generation.
            </h2>
          </div>
          <Link
            to="/get-started"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#245C45] hover:underline whitespace-nowrap"
          >
            <span>Compare all journeys</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ENVIRONMENTS.map((env) => (
            <Link
              key={env.id}
              to={`/register?environment=${env.id}`}
              className="group rounded-2xl border border-[#245C45]/12 bg-white overflow-hidden hover:border-[#245C45]/40 transition-colors flex flex-col"
            >
              <div className="aspect-[4/3] overflow-hidden bg-[#FDF3E3]">
                <ResilientImage
                  src={env.image}
                  alt={env.title}
                  className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-300"
                />
              </div>
              <div className="p-6 flex-1 flex flex-col">
                <p className="text-xs text-[#4A5851] mb-1.5">
                  Ages {env.ageRange} · A1 to C2 pathways
                </p>
                <h3 className="font-display text-xl font-bold text-[#17201C] mb-2">{env.title}</h3>
                <p className="text-sm text-[#4A5851] leading-relaxed mb-4 flex-1">
                  {env.description}
                </p>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#245C45]">
                  <span>Enter {env.title}</span>
                  <ArrowRight className="w-4 h-4" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* 4. Interactive Lesson Preview + Voice Studio Demonstration */}
      <section id="voice-studio" className="bg-[#245C45] text-[#FFF8ED] py-16 lg:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6">
              <p className="text-sm font-semibold text-[#F6C96B] mb-2">Voice Studio Preview</p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold headline-balance mb-4">
                Try Listen &amp; Learn right here.
              </h2>
              <p className="text-[#FFF8ED]/85 leading-relaxed mb-6">
                Inside SAUTI&apos;s Voice Studio, learners switch smoothly between reference audio,
                real microphone capture, honest word-level transcript coaching, and guided spoken
                conversations.
              </p>

              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  {PREVIEW_PHRASES.map((item, idx) => (
                    <button
                      key={item.level}
                      type="button"
                      onClick={() => {
                        setSelectedPreviewIdx(idx);
                        setPreviewAnswer(null);
                      }}
                      className={`px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                        selectedPreviewIdx === idx
                          ? 'bg-[#F6C96B] text-[#17201C]'
                          : 'bg-white/10 text-[#FFF8ED] hover:bg-white/20'
                      }`}
                    >
                      {item.level}
                    </button>
                  ))}
                </div>

                <div className="rounded-2xl bg-[#194231] p-6 border border-white/12">
                  <p className="text-xs text-[#A9D9E8] mb-2">{currentPhrase.note}</p>
                  <p className="font-display text-xl sm:text-2xl font-semibold mb-5">
                    &ldquo;{currentPhrase.text}&rdquo;
                  </p>
                  <div className="flex flex-wrap items-center gap-3">
                    <button
                      type="button"
                      disabled={isLoading}
                      onClick={() => speak(currentPhrase.text)}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F28B75] text-[#17201C] font-semibold hover:bg-[#f59c89] transition-colors"
                    >
                      <Volume2 className="w-4 h-4" />
                      <span>
                        {isLoading ? 'Loading audio...' : isSpeaking ? 'Playing...' : 'Listen aloud'}
                      </span>
                    </button>
                    <Link
                      to="/get-started"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 text-[#FFF8ED] font-semibold hover:bg-white/20 transition-colors"
                    >
                      <Mic className="w-4 h-4" />
                      <span>Open full Voice Studio</span>
                    </Link>
                  </div>
                  {engineUsed !== 'idle' && (
                    <p className="text-xs text-[#FFF8ED]/70 mt-3">
                      Audio source:{' '}
                      {engineUsed === 'gemini'
                        ? 'Gemini Speech Synthesis'
                        : 'Browser SpeechSynthesis fallback'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-2xl bg-white/8 p-6 border border-white/12">
                <Headphones className="w-6 h-6 text-[#A9D9E8] mb-3" />
                <h3 className="font-display text-lg font-bold mb-1.5">Listen &amp; Learn</h3>
                <p className="text-sm text-[#FFF8ED]/80 leading-relaxed">
                  Adjust playback speed, switch speakers, and follow highlighted dialogue scripts.
                </p>
              </div>
              <div className="rounded-2xl bg-white/8 p-6 border border-white/12">
                <Mic className="w-6 h-6 text-[#F28B75] mb-3" />
                <h3 className="font-display text-lg font-bold mb-1.5">Speak &amp; Practise</h3>
                <p className="text-sm text-[#FFF8ED]/80 leading-relaxed">
                  Real microphone recording with live audio-level bars, replay, and transcription.
                </p>
              </div>
              <div className="rounded-2xl bg-white/8 p-6 border border-white/12">
                <Sparkles className="w-6 h-6 text-[#F6C96B] mb-3" />
                <h3 className="font-display text-lg font-bold mb-1.5">Pronunciation Coach</h3>
                <p className="text-sm text-[#FFF8ED]/80 leading-relaxed">
                  Honest word-by-word comparison with clear guidance—zero invented precision scores.
                </p>
              </div>
              <div className="rounded-2xl bg-white/8 p-6 border border-white/12">
                <MessageSquare className="w-6 h-6 text-[#A9D9E8] mb-3" />
                <h3 className="font-display text-lg font-bold mb-1.5">Live AI Conversations</h3>
                <p className="text-sm text-[#FFF8ED]/80 leading-relaxed">
                  Real-time spoken dialogue tailored to travel, interviews, school, and daily life.
                </p>
              </div>
            </div>
          </div>

          {/* Interactive Lesson Quick-Check */}
          <div className="mt-12 rounded-2xl bg-[#FFF8ED] text-[#17201C] p-6 sm:p-8 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
            <div>
              <p className="text-xs font-semibold text-[#245C45] mb-1">
                Interactive Lesson Preview · Polite Workplace &amp; Daily Requests
              </p>
              <h3 className="font-display text-xl font-bold mb-1">
                Which response sounds clearest when rescheduling a call?
              </h3>
              <p className="text-sm text-[#4A5851]">
                Tap an option to test instant SAUTI lesson feedback.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 w-full lg:w-auto">
              {[
                'Could we move our call to Thursday at 10 a.m. if that suits you?',
                'Maybe call me sometime later.',
              ].map((opt) => {
                const isBest = opt.startsWith('Could we');
                const selected = previewAnswer === opt;
                return (
                  <button
                    key={opt}
                    type="button"
                    onClick={() => setPreviewAnswer(opt)}
                    className={`px-4 py-3 rounded-xl text-left text-sm font-medium border transition-colors ${
                      selected
                        ? isBest
                          ? 'bg-[#245C45] text-[#FFF8ED] border-[#245C45]'
                          : 'bg-[#F28B75]/20 text-[#17201C] border-[#F28B75]'
                        : 'bg-white border-[#245C45]/15 hover:border-[#245C45]'
                    }`}
                  >
                    {opt}
                  </button>
                );
              })}
            </div>
          </div>
          {previewAnswer && (
            <p className="mt-3 text-sm text-[#F6C96B]">
              {previewAnswer.startsWith('Could we')
                ? 'Correct: Offering a concrete time and checking availability is polite and clear.'
                : 'Try the first option: proposing a specific day and time makes scheduling easy.'}
            </p>
          )}
        </div>
      </section>

      {/* 5. Progress, Parent & School Section */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <div className="rounded-3xl bg-[#FDF3E3] border border-[#245C45]/12 p-8 flex flex-col justify-between">
            <div>
              <Award className="w-7 h-7 text-[#245C45] mb-4" />
              <h2 className="font-display text-2xl sm:text-3xl font-bold mb-3">
                Progress built on real completed practice.
              </h2>
              <p className="text-[#4A5851] leading-relaxed mb-6">
                Streaks, daily goals, and milestones grow only when learners finish activities and
                voice sessions. Young learners earn cheerful star badges while older learners track
                CEFR readiness and speaking minutes.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/get-started?role=parent"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold hover:bg-[#194231]"
              >
                <ShieldCheck className="w-4 h-4" />
                <span>Parent &amp; Guardian Portal</span>
              </Link>
            </div>
          </div>

          <div className="rounded-3xl bg-white border border-[#245C45]/12 p-8 flex flex-col justify-between">
            <div>
              <GraduationCap className="w-7 h-7 text-[#245C45] mb-4" />
              <h2 className="font-display text-2xl sm:text-3xl font-bold mb-3">
                Built for teachers, classrooms &amp; schools.
              </h2>
              <p className="text-[#4A5851] leading-relaxed mb-6">
                Create classrooms with unique join codes, assign age-appropriate CEFR courses, and
                review class completion reports without exposing children to open social feeds.
              </p>
            </div>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/register?accountType=teacher"
                className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-[#245C45] text-[#245C45] text-sm font-semibold hover:bg-[#245C45]/5"
              >
                <Users className="w-4 h-4" />
                <span>Register as Teacher or School</span>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* 6. Sample Testimonials */}
      <section className="bg-[#FDF3E3] border-y border-[#245C45]/10 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <p className="text-xs font-semibold text-[#245C45] mb-1">
              Illustrative sample stories (placeholder testimonials)
            </p>
            <h2 className="font-display text-3xl font-bold">Designed around real learning moments</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {SAMPLE_TESTIMONIALS.map((t) => (
              <div key={t.name} className="rounded-2xl bg-[#FFF8ED] border border-[#245C45]/12 p-6">
                <p className="text-sm text-[#17201C] leading-relaxed mb-4">&ldquo;{t.quote}&rdquo;</p>
                <p className="font-display font-bold text-sm text-[#245C45]">{t.name}</p>
                <p className="text-xs text-[#4A5851]">{t.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 7. Pricing Preview (Example Plans) */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-20">
        <div className="max-w-2xl mb-10">
          <p className="text-xs font-semibold text-[#245C45] mb-1">
            Example plans · Illustrative pricing preview
          </p>
          <h2 className="font-display text-3xl font-bold mb-2">
            Transparent pathways for individuals, families &amp; schools
          </h2>
          <p className="text-sm text-[#4A5851]">
            Final institutional and regional pricing can be configured per deployment.
          </p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {EXAMPLE_PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`rounded-2xl p-7 border flex flex-col justify-between ${
                plan.highlighted
                  ? 'bg-[#245C45] text-[#FFF8ED] border-[#245C45]'
                  : 'bg-white text-[#17201C] border-[#245C45]/12'
              }`}
            >
              <div>
                <p className={`text-xs mb-2 ${plan.highlighted ? 'text-[#F6C96B]' : 'text-[#4A5851]'}`}>
                  {plan.period}
                </p>
                <h3 className="font-display text-xl font-bold mb-1">{plan.name}</h3>
                <p className="font-display text-2xl font-bold mb-3 tabular-nums">{plan.price}</p>
                <p className={`text-sm mb-6 ${plan.highlighted ? 'text-[#FFF8ED]/85' : 'text-[#4A5851]'}`}>
                  {plan.summary}
                </p>
                <ul className="space-y-2.5 mb-8">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <Link
                to={`/register?accountType=${plan.accountType}`}
                className={`block text-center py-3 rounded-xl font-semibold text-sm transition-colors ${
                  plan.highlighted
                    ? 'bg-[#F6C96B] text-[#17201C] hover:bg-[#f8d487]'
                    : 'bg-[#245C45] text-[#FFF8ED] hover:bg-[#194231]'
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* 8. FAQ */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <h2 className="font-display text-3xl font-bold mb-8">Frequently asked questions</h2>
        <div className="divide-y divide-[#245C45]/12 border-y border-[#245C45]/12">
          {FAQS.map((item, idx) => {
            const isOpen = openFaq === idx;
            return (
              <div key={item.q} className="py-5">
                <button
                  type="button"
                  onClick={() => setOpenFaq(isOpen ? null : idx)}
                  className="w-full flex items-center justify-between gap-4 text-left font-display text-lg font-semibold text-[#17201C]"
                >
                  <span>{item.q}</span>
                  <ChevronDown
                    className={`w-5 h-5 shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`}
                  />
                </button>
                {isOpen && <p className="mt-3 text-sm text-[#4A5851] leading-relaxed">{item.a}</p>}
              </div>
            );
          })}
        </div>
      </section>

      {/* 9. Footer */}
      <footer className="bg-[#17201C] text-[#FFF8ED] py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2">
            <p className="font-display text-2xl font-bold mb-2">SAUTI</p>
            <p className="text-sm text-[#FFF8ED]/75 max-w-sm leading-relaxed">
              Don&apos;t just learn English. Find your voice. Built for learners of every age,
              families, and schools.
            </p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#F6C96B] mb-3">Platform</p>
            <ul className="space-y-2 text-sm text-[#FFF8ED]/80">
              <li><Link to="/get-started" className="hover:text-white">Get started</Link></li>
              <li><Link to="/login" className="hover:text-white">Sign in</Link></li>
              <li><Link to="/register?accountType=parent" className="hover:text-white">Parent accounts</Link></li>
              <li><Link to="/register?accountType=teacher" className="hover:text-white">Schools &amp; Teachers</Link></li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#F6C96B] mb-3">Contact &amp; Community</p>
            <ul className="space-y-2 text-sm text-[#FFF8ED]/80">
              <li><a href="mailto:hello@sauti.learning" className="hover:text-white">hello@sauti.learning</a></li>
              <li><Link to="/get-started" className="hover:text-white">Child Safety &amp; Privacy</Link></li>
              <li className="text-xs text-[#FFF8ED]/60 pt-2">
                <BookOpen className="w-3.5 h-3.5 inline mr-1" />
                Nairobi &amp; Global English Community
              </li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}
