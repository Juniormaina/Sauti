import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Volume2 } from 'lucide-react';
import { PublicHeader } from '../../components/navigation/PublicHeader';
import { ResilientImage } from '../../components/ui/ResilientImage';
import { KineticWordmark } from '../../components/motion/KineticWordmark';
import { RevealSection, SAUTI_EASE } from '../../components/motion/SautiMotion';
import { ENVIRONMENTS } from '../../utils/environments';
import { photo } from '../../utils/photos';
import { useSpeechPlayback } from '../../hooks/useSpeechPlayback';

const MODES = ['Listen & Learn', 'Speak & Practise', 'Pronunciation Coach', 'Live AI Conversations'];

/**
 * Concise public landing page: one hero screen and one journeys screen.
 * Account choice, the free pilot and sign-up live on /get-started.
 */
export function HomePage() {
  // null = show the shared group photo; an index = that age group's portrait.
  const [active, setActive] = useState<number | null>(null);
  const { speak, isSpeaking, isLoading } = useSpeechPlayback();
  const reduced = useReducedMotion();

  const env = active === null ? null : ENVIRONMENTS[active];
  const activePhoto = photo(env ? env.photoKey : 'hero');

  const handleHearSauti = () => {
    void speak(
      'Jambo! I am SAUTI, your voice-first English companion. In Swahili, SAUTI means voice.',
      { style: 'Warm, welcoming companion tone' }
    );
  };

  return (
    <div className="min-h-screen overflow-x-clip bg-[#FFF8ED] text-[#17201C]">
      <PublicHeader />

      {/* Screen 1 — hero */}
      <section className="bg-editorial-dots border-b border-[#245C45]/10">
        <div className="mx-auto flex min-h-[calc(100svh-4rem)] max-w-7xl flex-col justify-center gap-8 px-4 py-12 sm:px-6 lg:px-8">
          <p className="font-mono text-xs font-semibold text-[#245C45] sm:text-sm">
            Voice-first English learning · From Little Voices to Lifelong English · CEFR A1 to C2
          </p>

          <KineticWordmark className="-ml-[0.04em]" />

          <div className="grid items-end gap-8 lg:grid-cols-12">
            <div className="lg:col-span-7">
              <h2 className="headline-balance mb-3 font-display text-3xl font-bold leading-tight sm:text-4xl">
                Don&apos;t just learn English. Find your voice.
              </h2>
              <p className="max-w-xl leading-relaxed text-[#4A5851]">
                Real microphone practice, patient coaching and lessons that fit every stage of life,
                with a calm space for each age and your own pace at every level.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 lg:col-span-5 lg:justify-end">
              <Link
                to="/get-started"
                className="inline-flex items-center gap-2.5 whitespace-nowrap rounded-xl bg-[#245C45] px-6 py-3.5 font-semibold text-[#FFF8ED] shadow-sm transition-all hover:bg-[#194231] active:scale-[0.98]"
              >
                <span>Start learning</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                type="button"
                onClick={handleHearSauti}
                disabled={isLoading}
                className="inline-flex items-center gap-2 whitespace-nowrap rounded-xl border border-[#245C45]/25 bg-white/80 px-6 py-3.5 font-semibold text-[#245C45] transition-colors hover:border-[#245C45] hover:bg-white disabled:opacity-60"
              >
                <Volume2 className="h-4 w-4" />
                <span>{isLoading ? 'Loading…' : isSpeaking ? 'Speaking…' : 'Hear SAUTI'}</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Screen 2 — the six journeys as a numbered index */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <RevealSection>
          <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="mb-2 font-mono text-xs font-semibold text-[#245C45]">Six journeys</p>
              <h2 className="headline-balance font-display text-3xl font-bold sm:text-4xl">
                A space for every age, a path for every level.
              </h2>
            </div>
            <p className="font-mono text-xs text-[#4A5851]">{MODES.join(' · ')}</p>
          </div>

          <div className="grid items-start gap-8 lg:grid-cols-12 lg:gap-12">
            <div className="relative order-first aspect-[16/10] overflow-hidden rounded-3xl border border-[#245C45]/15 bg-[#FDF3E3] lg:sticky lg:top-24 lg:order-last lg:col-span-5">
              <AnimatePresence initial={false}>
                <motion.div
                  key={env ? env.id : 'group'}
                  initial={reduced ? false : { opacity: 0, scale: 1.05 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={reduced ? undefined : { opacity: 0 }}
                  transition={{ duration: 0.5, ease: SAUTI_EASE }}
                  className="absolute inset-0"
                >
                  <ResilientImage
                    src={activePhoto.src}
                    srcSet={activePhoto.srcSet}
                    sizes="(min-width: 1024px) 40vw, 100vw"
                    alt={
                      env
                        ? `${env.title}, ages ${env.ageRange}`
                        : 'Learners of every age sharing a tablet in a park'
                    }
                    className="h-full w-full object-cover"
                  />
                </motion.div>
              </AnimatePresence>
              <div className="absolute bottom-3 left-3 rounded-full bg-[#FFF8ED]/92 px-3.5 py-1.5 font-mono text-xs font-semibold text-[#245C45]">
                {env ? `${env.title} · Ages ${env.ageRange}` : 'Every age, one voice'}
              </div>
            </div>

            <ol className="lg:col-span-7" onMouseLeave={() => setActive(null)}>
              {ENVIRONMENTS.map((e, i) => (
                <li key={e.id}>
                  <Link
                    to="/get-started"
                    onMouseEnter={() => setActive(i)}
                    onTouchStart={() => setActive(i)}
                    onFocus={() => setActive(i)}
                    onBlur={() => setActive(null)}
                    onClick={() => setActive(i)}
                    aria-current={i === active ? 'true' : undefined}
                    className="group grid grid-cols-[2.75rem_1fr_auto] items-center gap-4 border-t border-[#245C45]/15 py-5 transition-colors last:border-b hover:bg-[#245C45]/[0.04]"
                  >
                    <span
                      className={`font-mono text-xs font-semibold ${
                        i === active ? 'text-[#F28B75]' : 'text-[#245C45]'
                      }`}
                    >
                      {String(i + 1).padStart(2, '0')}
                    </span>
                    <span>
                      <span className="block font-display text-2xl font-bold transition-colors group-hover:text-[#245C45] sm:text-3xl">
                        {e.title}
                      </span>
                      <span className="mt-0.5 block text-sm text-[#4A5851]">{e.tagline}</span>
                    </span>
                    <span className="flex items-center gap-2 font-mono text-xs text-[#4A5851]">
                      Ages {e.ageRange}
                      <ArrowRight className="h-4 w-4 text-[#245C45] transition-transform group-hover:translate-x-1" />
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          </div>
        </RevealSection>

        <footer className="mt-14 flex flex-wrap items-center justify-between gap-4 border-t border-[#245C45]/12 pt-6 text-sm text-[#4A5851]">
          <p>SAUTI is Swahili for &ldquo;voice&rdquo;. Free during the validation pilot.</p>
          <nav aria-label="Footer" className="flex gap-6 font-medium text-[#245C45]">
            <Link to="/get-started" className="hover:underline">
              Get started
            </Link>
            <Link to="/login" className="hover:underline">
              Sign in
            </Link>
          </nav>
        </footer>
      </section>
    </div>
  );
}
