import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
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
import {
  FloatingAccent,
  MotionCard,
  RevealItem,
  RevealSection,
  RevealStagger,
  SAUTI_EASE,
  SautiWaveGraphic,
  ZuriCompanionCard,
} from '../../components/motion/SautiMotion';

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

const PILOT_PARTICIPANTS = [
  {
    badge: 'Learners · All Ages (A1–C2)',
    title: 'Practise and share feedback',
    summary:
      'Explore age-matched spaces, complete interactive activities, and tell us what helps you speak with greater confidence.',
    points: [
      'Free access to starter courses and Voice Studio',
      'No subscription or payment details required',
      'Your feedback helps refine speaking activities and accessibility',
    ],
    cta: 'Register as a Learner',
    to: '/register?accountType=individual',
  },
  {
    badge: 'Parents & Guardians',
    title: 'Evaluate children’s learning',
    summary:
      'Help us test how families guide young learners safely across Little Voices, Young Explorers, and Teen Voices.',
    points: [
      'Free family participation throughout the validation pilot',
      'Built-in guardian consent and privacy controls',
      'Share feedback on clarity, child safety, and pace',
    ],
    cta: 'Register as a Parent',
    to: '/register?accountType=parent',
    highlighted: true,
  },
  {
    badge: 'Teachers & Schools',
    title: 'Provide classroom feedback',
    summary:
      'Test classroom rosters, join codes, and CEFR pathways with your students and share what works in real teaching settings.',
    points: [
      'No cost for teachers or participating pilot schools',
      'No payment details or billing setup required',
      'Help shape classroom tools, speaking prompts, and low-bandwidth access',
    ],
    cta: 'Register as a Teacher or School',
    to: '/register?accountType=teacher',
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
  const reduced = useReducedMotion();

  const currentPhrase = PREVIEW_PHRASES[selectedPreviewIdx];

  const handlePronounceSauti = () => {
    void speak(
      'Jambo! I am SAUTI, your voice-first English companion. In Swahili, SAUTI means voice.',
      { style: 'Warm, welcoming companion tone' }
    );
  };

  return (
    <div className="min-h-screen bg-[#FFF8ED] text-[#17201C] overflow-x-clip">
      <PublicHeader />

      {/* 1. Signature Layered Editorial Hero */}
      <section className="relative bg-warm-grid border-b border-[#245C45]/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-16 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            <motion.div
              initial={reduced ? false : { opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: SAUTI_EASE }}
              className="lg:col-span-6 flex flex-col justify-center"
            >
              <p className="text-xs sm:text-sm font-mono font-semibold text-[#245C45] mb-4">
                Voice-first English learning · CEFR A1 to C2
              </p>

              <h1 className="font-display text-4xl sm:text-5xl lg:text-[58px] font-bold leading-[1.06] tracking-[-0.025em] text-[#17201C] headline-balance mb-6">
                Don&apos;t just learn English.{' '}
                <span className="relative inline-block text-[#245C45]">
                  Find your voice.
                  <motion.span
                    aria-hidden="true"
                    initial={reduced ? false : { scaleX: 0 }}
                    animate={{ scaleX: 1 }}
                    transition={{ duration: 0.65, delay: 0.25, ease: SAUTI_EASE }}
                    style={{ transformOrigin: 'left center' }}
                    className="absolute left-0 -bottom-1 w-full h-[5px] rounded-full bg-[#F28B75]/75"
                  />
                </span>
              </h1>

              <p className="text-lg sm:text-xl text-[#17201C]/85 font-medium leading-relaxed max-w-xl mb-3">
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
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#245C45] text-[#FFF8ED] font-semibold hover:bg-[#194231] active:scale-[0.98] transition-all whitespace-nowrap shadow-sm"
                >
                  <span>Start learning</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
                <a
                  href="#voice-studio"
                  className="inline-flex items-center gap-2 px-6 py-3.5 rounded-xl bg-white/80 border border-[#245C45]/25 text-[#245C45] font-semibold hover:bg-white hover:border-[#245C45] transition-colors whitespace-nowrap"
                >
                  <Volume2 className="w-4 h-4" />
                  <span>Hear Voice Studio</span>
                </a>
              </div>
            </motion.div>

            {/* Right: Layered Editorial Visual + Floating Zuri Companion */}
            <motion.div
              initial={reduced ? false : { opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.52, delay: 0.08, ease: SAUTI_EASE }}
              className="lg:col-span-6 relative pb-12 sm:pb-8 lg:pb-0"
            >
              <div className="relative rounded-3xl overflow-hidden border border-[#245C45]/15 bg-[#FDF3E3] shadow-[0_24px_48px_-28px_rgba(36,92,69,0.35)]">
                <ResilientImage
                  src={SAUTI_IMAGES.heroVoices}
                  alt="Diverse learners of all ages speaking and listening together in SAUTI's sunlit studio"
                  className="w-full h-full object-cover min-h-[290px] sm:min-h-[360px] lg:min-h-[430px]"
                />
                {/* Subtle bottom scrim to anchor overlapping card cleanly */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#17201C]/25 to-transparent"
                />
              </div>

              {/* Layered Zuri Companion Preview Card */}
              <FloatingAccent
                amplitude={5}
                duration={6}
                className="relative sm:absolute sm:-bottom-6 sm:left-4 sm:right-8 lg:-left-6 lg:right-12 -mt-8 mx-2 sm:mx-0"
              >
                <ZuriCompanionCard
                  compact
                  onPronounce={handlePronounceSauti}
                  isSpeaking={isSpeaking}
                  isLoading={isLoading}
                />
              </FloatingAccent>
            </motion.div>
          </div>

          {/* Full-width 4-column studio summary strip */}
          <RevealStagger className="mt-12 sm:mt-16 grid grid-cols-2 lg:grid-cols-4 gap-6 border-t border-[#245C45]/14 pt-8">
            <RevealItem>
              <p className="font-display text-2xl sm:text-3xl font-bold text-[#245C45] tabular-nums">
                6 Spaces
              </p>
              <p className="text-sm text-[#4A5851] mt-1">Age-tailored visual interfaces</p>
            </RevealItem>
            <RevealItem>
              <p className="font-display text-2xl sm:text-3xl font-bold text-[#245C45] tabular-nums">
                A1 – C2
              </p>
              <p className="text-sm text-[#4A5851] mt-1">Independent CEFR proficiency paths</p>
            </RevealItem>
            <RevealItem>
              <p className="font-display text-2xl sm:text-3xl font-bold text-[#245C45] tabular-nums">
                4 Modes
              </p>
              <p className="text-sm text-[#4A5851] mt-1">Listen, Speak, Coach &amp; Live AI</p>
            </RevealItem>
            <RevealItem>
              <p className="font-display text-2xl sm:text-3xl font-bold text-[#245C45] tabular-nums">
                Offline-first
              </p>
              <p className="text-sm text-[#4A5851] mt-1">Local audio &amp; synced lesson queue</p>
            </RevealItem>
          </RevealStagger>
        </div>
      </section>

      {/* 2. Introduction & How SAUTI Works — Alternating Editorial Columns */}
      <section
        id="how-it-works"
        className="bg-[#FDF3E3] bg-editorial-dots border-b border-[#245C45]/10 py-16 lg:py-24"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <RevealSection className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end mb-14">
            <div className="lg:col-span-7">
              <p className="text-xs font-mono font-semibold text-[#245C45] mb-2">
                01 · How SAUTI works
              </p>
              <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#17201C] headline-balance">
                Speaking and listening sit at the centre of every lesson.
              </h2>
            </div>
            <p className="lg:col-span-5 text-base text-[#4A5851] leading-relaxed">
              Instead of reducing language learning to silent multiple-choice taps, SAUTI pairs
              natural listening, real microphone capture, and thoughtful feedback.
            </p>
          </RevealSection>

          <RevealStagger className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <RevealItem>
              <MotionCard className="h-full sauti-surface rounded-3xl p-7 border-t-4 border-t-[#F28B75]">
                <p className="font-mono text-xs text-[#245C45] mb-4">01 · Placement &amp; Space</p>
                <h3 className="font-display text-xl font-bold mb-2.5">
                  Choose your age space and level
                </h3>
                <p className="text-sm text-[#4A5851] leading-relaxed">
                  Pick an environment designed for your stage of life, then complete a short
                  placement check across CEFR A1 to C2—never assuming every adult is advanced or
                  every child is new.
                </p>
              </MotionCard>
            </RevealItem>
            <RevealItem>
              <MotionCard className="h-full sauti-surface rounded-3xl p-7 border-t-4 border-t-[#F6C96B]">
                <p className="font-mono text-xs text-[#245C45] mb-4">02 · Interactive Lessons</p>
                <h3 className="font-display text-xl font-bold mb-2.5">Practise beyond quizzes</h3>
                <p className="text-sm text-[#4A5851] leading-relaxed">
                  Move through structured modules featuring picture recognition, sentence building,
                  story comprehension, spelling, grammar correction, and spoken role-play.
                </p>
              </MotionCard>
            </RevealItem>
            <RevealItem>
              <MotionCard className="h-full sauti-surface rounded-3xl p-7 border-t-4 border-t-[#245C45]">
                <p className="font-mono text-xs text-[#245C45] mb-4">03 · Voice Studio</p>
                <h3 className="font-display text-xl font-bold mb-2.5">Hear, record, and converse</h3>
                <p className="text-sm text-[#4A5851] leading-relaxed">
                  Replay your own recordings alongside reference speech, compare spoken transcripts
                  word-by-word, and practise calm conversations at your own rhythm.
                </p>
              </MotionCard>
            </RevealItem>
          </RevealStagger>
        </div>
      </section>

      {/* 3. Age-Specific Learning Experiences */}
      <section id="journeys" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <RevealSection className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
          <div className="max-w-2xl">
            <p className="text-xs font-mono font-semibold text-[#245C45] mb-2">
              Six tailored environments
            </p>
            <h2 className="font-display text-3xl sm:text-4xl font-bold text-[#17201C] headline-balance">
              One learning engine, crafted differently for every generation.
            </h2>
          </div>
          <Link
            to="/get-started"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#245C45] hover:underline underline-offset-4 whitespace-nowrap"
          >
            <span>Compare all journeys</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </RevealSection>

        <RevealStagger className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ENVIRONMENTS.map((env) => (
            <RevealItem key={env.id}>
              <MotionCard className="h-full">
                <Link
                  to={`/register?environment=${env.id}`}
                  className="group h-full rounded-3xl border border-[#245C45]/12 bg-white overflow-hidden hover:border-[#245C45]/40 transition-colors flex flex-col shadow-[0_1px_2px_rgba(23,32,28,0.03)]"
                >
                  <div
                    className="aspect-[4/3] overflow-hidden relative"
                    style={{ backgroundColor: env.surfaceHex }}
                  >
                    <ResilientImage
                      src={env.image}
                      alt={env.title}
                      className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500"
                    />
                  </div>
                  <div className="p-6 flex-1 flex flex-col" style={{ backgroundColor: env.surfaceHex }}>
                    <p className="text-xs font-mono text-[#4A5851] mb-1.5">
                      Ages {env.ageRange} · A1 to C2 pathways
                    </p>
                    <h3 className="font-display text-xl font-bold text-[#17201C] mb-2">
                      {env.title}
                    </h3>
                    <p className="text-sm text-[#4A5851] leading-relaxed mb-5 flex-1">
                      {env.description}
                    </p>
                    <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#245C45] group-hover:translate-x-0.5 transition-transform">
                      <span>Enter {env.title}</span>
                      <ArrowRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
              </MotionCard>
            </RevealItem>
          ))}
        </RevealStagger>
      </section>

      {/* 4. Interactive Lesson Preview + Voice Studio Demonstration */}
      <section
        id="voice-studio"
        className="bg-[#245C45] bg-editorial-dots-dark text-[#FFF8ED] py-16 lg:py-24"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            <RevealSection className="lg:col-span-6 space-y-6">
              <div>
                <p className="text-xs font-mono font-semibold text-[#F6C96B] mb-2">
                  Voice Studio Preview
                </p>
                <h2 className="font-display text-3xl sm:text-4xl font-bold headline-balance mb-4">
                  Try Listen &amp; Learn with Zuri right here.
                </h2>
                <p className="text-[#FFF8ED]/85 leading-relaxed">
                  Inside SAUTI&apos;s Voice Studio, learners switch smoothly between reference audio,
                  real microphone capture, honest word-level transcript coaching, and guided spoken
                  conversations.
                </p>
              </div>

              {/* Zuri Voice Companion Strip */}
              <ZuriCompanionCard
                dark
                compact
                onPronounce={handlePronounceSauti}
                isSpeaking={isSpeaking}
                isLoading={isLoading}
              />

              <div className="space-y-4 pt-1">
                <div className="flex flex-wrap gap-2">
                  {PREVIEW_PHRASES.map((item, idx) => {
                    const active = selectedPreviewIdx === idx;
                    return (
                      <button
                        key={item.level}
                        type="button"
                        onClick={() => {
                          setSelectedPreviewIdx(idx);
                          setPreviewAnswer(null);
                        }}
                        className={`relative px-3.5 py-2 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                          active
                            ? 'text-[#17201C]'
                            : 'bg-white/10 text-[#FFF8ED] hover:bg-white/20'
                        }`}
                      >
                        {active && (
                          <motion.span
                            layoutId="home-phrase-tab"
                            transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                            className="absolute inset-0 rounded-xl bg-[#F6C96B]"
                          />
                        )}
                        <span className="relative z-10">{item.level}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="rounded-2xl bg-[#194231] p-6 border border-white/15 min-h-[190px] flex flex-col justify-between">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentPhrase.level}
                      initial={reduced ? false : { opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={reduced ? undefined : { opacity: 0, y: -6 }}
                      transition={{ duration: 0.2, ease: SAUTI_EASE }}
                    >
                      <p className="text-xs text-[#A9D9E8] mb-2">{currentPhrase.note}</p>
                      <p className="font-display text-xl sm:text-2xl font-semibold mb-5">
                        &ldquo;{currentPhrase.text}&rdquo;
                      </p>
                    </motion.div>
                  </AnimatePresence>

                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <button
                        type="button"
                        disabled={isLoading}
                        onClick={() => speak(currentPhrase.text)}
                        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#F28B75] text-[#17201C] font-semibold hover:bg-[#f59c89] active:scale-[0.98] transition-all"
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
                      <SautiWaveGraphic active={isSpeaking} dark className="ml-1" />
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
            </RevealSection>

            <RevealStagger className="lg:col-span-6 grid grid-cols-1 sm:grid-cols-2 gap-4 lg:pt-8">
              <RevealItem>
                <div className="h-full rounded-2xl bg-[#194231]/85 p-6 border border-white/12 hover:border-[#A9D9E8]/50 transition-colors">
                  <Headphones className="w-6 h-6 text-[#A9D9E8] mb-3" />
                  <h3 className="font-display text-lg font-bold mb-1.5">Listen &amp; Learn</h3>
                  <p className="text-sm text-[#FFF8ED]/80 leading-relaxed">
                    Adjust playback speed, switch speakers, and save audio exercises for offline
                    listening.
                  </p>
                </div>
              </RevealItem>
              <RevealItem>
                <div className="h-full rounded-2xl bg-[#194231]/85 p-6 border border-white/12 hover:border-[#F28B75]/50 transition-colors">
                  <Mic className="w-6 h-6 text-[#F28B75] mb-3" />
                  <h3 className="font-display text-lg font-bold mb-1.5">Speak &amp; Practise</h3>
                  <p className="text-sm text-[#FFF8ED]/80 leading-relaxed">
                    Real microphone recording with live audio-level bars, local saving, and optional
                    transcription.
                  </p>
                </div>
              </RevealItem>
              <RevealItem>
                <div className="h-full rounded-2xl bg-[#194231]/85 p-6 border border-white/12 hover:border-[#F6C96B]/50 transition-colors">
                  <Sparkles className="w-6 h-6 text-[#F6C96B] mb-3" />
                  <h3 className="font-display text-lg font-bold mb-1.5">Pronunciation Coach</h3>
                  <p className="text-sm text-[#FFF8ED]/80 leading-relaxed">
                    Honest word-by-word comparison with clear guidance—zero invented precision
                    scores.
                  </p>
                </div>
              </RevealItem>
              <RevealItem>
                <div className="h-full rounded-2xl bg-[#194231]/85 p-6 border border-white/12 hover:border-[#A9D9E8]/50 transition-colors">
                  <MessageSquare className="w-6 h-6 text-[#A9D9E8] mb-3" />
                  <h3 className="font-display text-lg font-bold mb-1.5">Live AI Conversations</h3>
                  <p className="text-sm text-[#FFF8ED]/80 leading-relaxed">
                    Real-time spoken dialogue with Zuri tailored to travel, interviews, school, and
                    daily life.
                  </p>
                </div>
              </RevealItem>
            </RevealStagger>
          </div>

          {/* Interactive Lesson Quick-Check */}
          <RevealSection className="mt-12 rounded-2xl bg-[#FFF8ED] text-[#17201C] p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
              <div>
                <p className="text-xs font-mono font-semibold text-[#245C45] mb-1">
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
                      className={`px-4 py-3 rounded-xl text-left text-sm font-medium border transition-all active:scale-[0.98] ${
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

            <AnimatePresence>
              {previewAnswer && (
                <motion.p
                  initial={reduced ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className={`mt-4 pt-3 border-t border-[#245C45]/12 text-sm font-medium ${
                    previewAnswer.startsWith('Could we') ? 'text-[#245C45]' : 'text-[#B43C25]'
                  }`}
                >
                  {previewAnswer.startsWith('Could we')
                    ? 'Correct: Offering a concrete time and checking availability is polite and clear.'
                    : 'Try the first option: proposing a specific day and time makes scheduling easy.'}
                </motion.p>
              )}
            </AnimatePresence>
          </RevealSection>
        </div>
      </section>

      {/* 5. Progress, Parent & School Section — Contrasting Surface Composition */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <RevealStagger className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <RevealItem>
            <MotionCard className="h-full rounded-3xl sauti-surface-warm p-8 sm:p-10 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-2xl bg-[#245C45]/10 text-[#245C45] flex items-center justify-center mb-5">
                  <Award className="w-6 h-6" />
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold mb-3">
                  Progress built on real completed practice.
                </h2>
                <p className="text-[#4A5851] leading-relaxed mb-8">
                  Streaks, daily goals, and milestones grow only when learners finish activities and
                  voice sessions. Young learners earn cheerful star badges while older learners
                  track CEFR readiness and speaking minutes.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/get-started?role=parent"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-[#245C45] text-[#FFF8ED] text-sm font-semibold hover:bg-[#194231] transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>Parent &amp; Guardian Portal</span>
                </Link>
              </div>
            </MotionCard>
          </RevealItem>

          <RevealItem>
            <MotionCard className="h-full rounded-3xl sauti-surface p-8 sm:p-10 flex flex-col justify-between">
              <div>
                <div className="w-11 h-11 rounded-2xl bg-[#F6C96B]/30 text-[#17201C] flex items-center justify-center mb-5">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h2 className="font-display text-2xl sm:text-3xl font-bold mb-3">
                  Built for teachers, classrooms &amp; schools.
                </h2>
                <p className="text-[#4A5851] leading-relaxed mb-8">
                  Create classrooms with unique join codes, assign age-appropriate CEFR courses, and
                  review class completion reports without exposing children to open social feeds.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/register?accountType=teacher"
                  className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-[#245C45] text-[#245C45] text-sm font-semibold hover:bg-[#245C45]/5 transition-colors"
                >
                  <Users className="w-4 h-4" />
                  <span>Register as Teacher or School</span>
                </Link>
              </div>
            </MotionCard>
          </RevealItem>
        </RevealStagger>
      </section>

      {/* 6. Sample Testimonials (Clearly Labelled Editorial Pull-Quotes) */}
      <section className="bg-[#FDF3E3] border-y border-[#245C45]/10 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <RevealSection className="mb-10">
            <p className="text-xs font-mono font-semibold text-[#245C45] mb-1.5">
              Illustrative sample stories (placeholder testimonials)
            </p>
            <h2 className="font-display text-3xl font-bold">Designed around real learning moments</h2>
          </RevealSection>

          <RevealStagger className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {SAMPLE_TESTIMONIALS.map((t) => (
              <RevealItem key={t.name}>
                <blockquote className="h-full border-t-2 border-[#245C45]/25 pt-5 flex flex-col justify-between">
                  <p className="text-sm sm:text-base text-[#17201C] leading-relaxed mb-5">
                    &ldquo;{t.quote}&rdquo;
                  </p>
                  <footer>
                    <p className="font-display font-bold text-sm text-[#245C45]">{t.name}</p>
                    <p className="text-xs text-[#4A5851]">{t.role}</p>
                  </footer>
                </blockquote>
              </RevealItem>
            ))}
          </RevealStagger>
        </div>
      </section>

      {/* 7. Free Validation Pilot Invitation */}
      <section id="validation-pilot" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
        <RevealSection className="max-w-3xl mb-12">
          <p className="text-xs font-mono font-semibold text-[#245C45] mb-2">
            Open Validation Pilot · Free Participation
          </p>
          <h2 className="font-display text-3xl sm:text-4xl font-bold mb-3 headline-balance">
            Join the SAUTI Free Validation Pilot
          </h2>
          <p className="text-base text-[#4A5851] leading-relaxed mb-3">
            SAUTI is inviting parents, teachers, schools, and learners to help validate and improve
            the learning experience. Participation is free during the validation pilot, and no
            payment details are required.
          </p>
          <p className="text-sm text-[#4A5851] leading-relaxed">
            Your feedback directly helps us improve speaking confidence, interactive learning
            activities, and accessibility across devices and connection speeds.
          </p>
        </RevealSection>

        <RevealStagger className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PILOT_PARTICIPANTS.map((item) => (
            <RevealItem key={item.title}>
              <MotionCard
                className={`h-full rounded-3xl p-7 border flex flex-col justify-between ${
                  item.highlighted
                    ? 'sauti-surface-forest border-[#245C45]'
                    : 'sauti-surface text-[#17201C]'
                }`}
              >
                <div>
                  <p
                    className={`text-xs font-mono mb-2 ${
                      item.highlighted ? 'text-[#F6C96B]' : 'text-[#245C45] font-semibold'
                    }`}
                  >
                    {item.badge}
                  </p>
                  <h3 className="font-display text-xl font-bold mb-2">{item.title}</h3>
                  <p
                    className={`text-sm mb-6 leading-relaxed ${
                      item.highlighted ? 'text-[#FFF8ED]/85' : 'text-[#4A5851]'
                    }`}
                  >
                    {item.summary}
                  </p>
                  <ul className="space-y-2.5 mb-8">
                    {item.points.map((point) => (
                      <li key={point} className="flex items-start gap-2 text-sm">
                        <Check className="w-4 h-4 mt-0.5 shrink-0" />
                        <span>{point}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <Link
                  to={item.to}
                  className={`block text-center py-3 px-4 rounded-xl font-semibold text-sm transition-colors ${
                    item.highlighted
                      ? 'bg-[#F6C96B] text-[#17201C] hover:bg-[#f8d487]'
                      : 'bg-[#245C45] text-[#FFF8ED] hover:bg-[#194231]'
                  }`}
                >
                  {item.cta}
                </Link>
              </MotionCard>
            </RevealItem>
          ))}
        </RevealStagger>
      </section>

      {/* 8. FAQ with Smooth AnimatePresence Accordion */}
      <section className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 pb-20">
        <RevealSection>
          <h2 className="font-display text-3xl font-bold mb-8">Frequently asked questions</h2>
          <div className="divide-y divide-[#245C45]/12 border-y border-[#245C45]/12">
            {FAQS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q} className="py-5">
                  <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full flex items-center justify-between gap-4 text-left font-display text-lg font-semibold text-[#17201C]"
                  >
                    <span>{item.q}</span>
                    <ChevronDown
                      className={`w-5 h-5 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  <AnimatePresence initial={false}>
                    {isOpen && (
                      <motion.div
                        initial={reduced ? false : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={reduced ? undefined : { opacity: 0, height: 0 }}
                        transition={{ duration: 0.22, ease: SAUTI_EASE }}
                        className="overflow-hidden"
                      >
                        <p className="pt-3 text-sm text-[#4A5851] leading-relaxed">{item.a}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </RevealSection>
      </section>

      {/* 9. Footer */}
      <footer className="bg-[#17201C] text-[#FFF8ED] py-14">
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
              <li>
                <Link to="/get-started" className="hover:text-white">
                  Get started
                </Link>
              </li>
              <li>
                <Link to="/login" className="hover:text-white">
                  Sign in
                </Link>
              </li>
              <li>
                <Link to="/register?accountType=parent" className="hover:text-white">
                  Parent accounts
                </Link>
              </li>
              <li>
                <Link to="/register?accountType=teacher" className="hover:text-white">
                  Schools &amp; Teachers
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <p className="text-xs font-semibold text-[#F6C96B] mb-3">Contact &amp; Community</p>
            <ul className="space-y-2 text-sm text-[#FFF8ED]/80">
              <li>
                <a href="mailto:hello@sauti.learning" className="hover:text-white">
                  hello@sauti.learning
                </a>
              </li>
              <li>
                <Link to="/get-started" className="hover:text-white">
                  Child Safety &amp; Privacy
                </Link>
              </li>
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
