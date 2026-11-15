import { ReactNode } from 'react';
import { motion, useReducedMotion, type Variants } from 'motion/react';
import { Volume2 } from 'lucide-react';
import { ZuriMascot } from '../mascot/ZuriMascot';

/**
 * Centralized SAUTI motion language tokens.
 * Warm, poised, editorial — compositor-only transforms & opacity.
 */
export const SAUTI_EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const SAUTI_DURATIONS = {
  fast: 0.18,
  base: 0.34,
  slow: 0.55,
};

export const SAUTI_SPRING = {
  type: 'spring' as const,
  stiffness: 340,
  damping: 30,
  mass: 0.9,
};

export const SAUTI_STAGGER_CONTAINER: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

export const SAUTI_STAGGER_ITEM: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: SAUTI_DURATIONS.base,
      ease: SAUTI_EASE,
    },
  },
};

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className = '' }: PageTransitionProps) {
  // Route-level enter/exit is handled once by <AnimatedRoutes /> in App.tsx.
  return <div className={className}>{children}</div>;
}

interface RevealSectionProps {
  children: ReactNode;
  className?: string;
  delay?: number;
}

export function RevealSection({ children, className = '', delay = 0 }: RevealSectionProps) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      initial={{ opacity: 0, y: 18 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.15 }}
      transition={{ duration: SAUTI_DURATIONS.base, delay, ease: SAUTI_EASE }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function RevealStagger({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      variants={SAUTI_STAGGER_CONTAINER}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.12 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function RevealItem({ children, className = '' }: { children: ReactNode; className?: string }) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div variants={SAUTI_STAGGER_ITEM} className={className}>
      {children}
    </motion.div>
  );
}

interface MotionCardProps {
  children: ReactNode;
  className?: string;
  interactive?: boolean;
}

export function MotionCard({ children, className = '', interactive = true }: MotionCardProps) {
  const reduced = useReducedMotion();
  if (reduced || !interactive) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      whileHover={{ y: -3 }}
      whileTap={{ scale: 0.99 }}
      transition={SAUTI_SPRING}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface FloatingAccentProps {
  children: ReactNode;
  className?: string;
  amplitude?: number;
  duration?: number;
}

export function FloatingAccent({
  children,
  className = '',
  amplitude = 6,
  duration = 5.5,
}: FloatingAccentProps) {
  const reduced = useReducedMotion();
  if (reduced) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div
      animate={{ y: [-amplitude / 2, amplitude / 2, -amplitude / 2] }}
      transition={{
        duration,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface AnimatedProgressBarProps {
  value: number; // 0-100 real server/local derived percentage
  barClassName?: string;
  trackClassName?: string;
  ariaLabel?: string;
}

export function AnimatedProgressBar({
  value,
  barClassName = 'bg-[#245C45]',
  trackClassName = 'bg-[#245C45]/12',
  ariaLabel = 'Progress',
}: AnimatedProgressBarProps) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, Number.isFinite(value) ? value : 0));

  return (
    <div
      className={`h-3 w-full rounded-full overflow-hidden ${trackClassName}`}
      role="progressbar"
      aria-label={ariaLabel}
      aria-valuenow={Math.round(clamped)}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <motion.div
        initial={reduced ? false : { scaleX: 0 }}
        animate={{ scaleX: clamped / 100 }}
        transition={reduced ? { duration: 0 } : { duration: 0.65, ease: SAUTI_EASE }}
        style={{ transformOrigin: 'left center' }}
        className={`h-full w-full rounded-full ${barClassName}`}
      />
    </div>
  );
}

interface SautiWaveGraphicProps {
  active?: boolean;
  dark?: boolean;
  className?: string;
}

/**
 * Signature SAUTI voice-cadence wave motif.
 * Strictly visual cadence (never claims to display live mic amplitudes).
 */
export function SautiWaveGraphic({ active = false, dark = false, className = '' }: SautiWaveGraphicProps) {
  const reduced = useReducedMotion();
  const heights = [10, 18, 28, 16, 24, 32, 20, 14, 26, 18, 12];
  const palette = dark
    ? ['#A9D9E8', '#F6C96B', '#F28B75']
    : ['#245C45', '#F28B75', '#F6C96B'];

  return (
    <div className={`inline-flex items-center gap-1 h-8 ${className}`} aria-hidden="true">
      {heights.map((h, i) => (
        <motion.span
          key={i}
          style={{
            height: `${h}px`,
            backgroundColor: palette[i % palette.length],
            transformOrigin: 'center',
          }}
          animate={
            active && !reduced
              ? {
                  scaleY: [0.65, 1.18, 0.72, 1.05, 0.65],
                }
              : { scaleY: 1 }
          }
          transition={
            active && !reduced
              ? {
                  duration: 1.15,
                  repeat: Infinity,
                  delay: i * 0.08,
                  ease: 'easeInOut',
                }
              : { duration: 0.2 }
          }
          className="w-1 rounded-full opacity-90"
        />
      ))}
    </div>
  );
}

export function CelebrationBurst({ active, label = 'Great work!' }: { active: boolean; label?: string }) {
  const reduced = useReducedMotion();
  if (!active) return null;

  return (
    <motion.div
      initial={reduced ? false : { opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.35, ease: SAUTI_EASE }}
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[#F6C96B]/30 border border-[#F6C96B] text-[#17201C] text-xs font-bold"
    >
      <span
        className="w-2.5 h-2.5 rounded-full bg-[#245C45]"
        aria-hidden="true"
      />
      <span>{label}</span>
    </motion.div>
  );
}

interface ZuriCompanionCardProps {
  onPronounce?: () => void;
  isSpeaking?: boolean;
  isLoading?: boolean;
  compact?: boolean;
  dark?: boolean;
}

export function ZuriCompanionCard({
  onPronounce,
  isSpeaking = false,
  isLoading = false,
  compact = false,
  dark = false,
}: ZuriCompanionCardProps) {
  return (
    <div
      className={`rounded-2xl border p-4 sm:p-5 flex items-center gap-4 ${
        dark
          ? 'bg-[#194231] border-white/15 text-[#FFF8ED]'
          : 'bg-[#FFF8ED] border-[#245C45]/15 text-[#17201C] shadow-sm'
      }`}
    >
      <div className={`${compact ? 'w-14 h-14' : 'w-16 h-16 sm:w-20 sm:h-20'} rounded-2xl overflow-hidden shrink-0 border ${dark ? 'border-white/20' : 'border-[#245C45]/15'} bg-[#FDF3E3]`}>
        <div
          role="img"
          aria-label="Zuri, the SAUTI voice companion"
          className="flex h-full w-full items-center justify-center"
        >
          <ZuriMascot headOnly size={compact ? 46 : 62} />
        </div>
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <p className="font-display font-bold text-base sm:text-lg leading-tight">
            Meet Zuri
          </p>
          <span className={`font-mono text-[11px] ${dark ? 'text-[#F6C96B]' : 'text-[#245C45]'}`}>
            SAUTI · sah-OO-tee
          </span>
        </div>
        <p className={`text-xs sm:text-sm leading-relaxed ${dark ? 'text-[#FFF8ED]/80' : 'text-[#4A5851]'}`}>
          Your calm speaking companion—&ldquo;Sauti&rdquo; means <span className="italic">voice</span> in Swahili.
        </p>
        {onPronounce && (
          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              disabled={isLoading}
              onClick={onPronounce}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                dark
                  ? 'bg-[#F6C96B] text-[#17201C] hover:bg-[#f8d487]'
                  : 'bg-[#245C45] text-[#FFF8ED] hover:bg-[#194231]'
              }`}
            >
              <Volume2 className="w-3.5 h-3.5" />
              <span>
                {isLoading ? 'Loading...' : isSpeaking ? 'Speaking SAUTI...' : 'Hear SAUTI'}
              </span>
            </button>
            <SautiWaveGraphic active={isSpeaking} dark={dark} className="h-5" />
          </div>
        )}
      </div>
    </div>
  );
}
