import { useId } from 'react';
import { motion, type TargetAndTransition } from 'motion/react';

export type MascotPose = 'idle' | 'walk' | 'fall' | 'lying' | 'laugh';

interface ZuriMascotProps {
  pose?: MascotPose;
  /** 1 faces right, -1 faces left. */
  facing?: 1 | -1;
  /** Rendered width in px (height is 1.42x). */
  size?: number;
  /** Show only the head (used as a small brand emblem). */
  headOnly?: boolean;
  className?: string;
}

type Limb = 'armL' | 'armR' | 'legL' | 'legR';

const FACE = '#F28B75';
const FACE_SHADE = '#E3745D';
const INK = '#17201C';
const SWEATER = '#245C45';
const SHOE = '#FFF8ED';
const LIE_LIFT = 30;

const swing = (duration: number) => ({
  duration,
  repeat: Infinity,
  repeatType: 'mirror' as const,
  ease: 'easeInOut' as const,
});

function limbTarget(pose: MascotPose, limb: Limb): TargetAndTransition {
  const settle = { duration: 0.25, ease: 'easeOut' as const };
  switch (pose) {
    case 'walk': {
      const a = limb === 'armL' || limb === 'legR' ? [-30, 30] : [30, -30];
      const amp = limb.startsWith('leg') ? a.map((v) => v * 0.9) : a;
      return { rotate: amp, transition: swing(0.28) };
    }
    case 'fall': {
      if (limb === 'armL') return { rotate: [158, 138], transition: swing(0.14) };
      if (limb === 'armR') return { rotate: [-158, -138], transition: swing(0.14) };
      return { rotate: limb === 'legL' ? [16, -10] : [-16, 10], transition: swing(0.12) };
    }
    case 'laugh': {
      // Arms hug the belly and jiggle while the body shakes.
      if (limb === 'armL') return { rotate: [40, 52], transition: swing(0.12) };
      if (limb === 'armR') return { rotate: [-40, -52], transition: swing(0.12) };
      return { rotate: limb === 'legL' ? 8 : -8, transition: settle };
    }
    case 'lying':
      return { rotate: limb.startsWith('arm') ? (limb === 'armL' ? 24 : -24) : 0, transition: settle };
    default:
      return { rotate: 0, transition: settle };
  }
}

/** Shared gradients give the flat shapes a soft, rounded, lit-from-above volume. */
function Defs({ id }: { id: string }) {
  return (
    <defs>
      <radialGradient id={`${id}-head`} cx="38%" cy="28%" r="80%">
        <stop offset="0" stopColor="#FFC2B3" />
        <stop offset="0.45" stopColor={FACE} />
        <stop offset="1" stopColor="#D9634D" />
      </radialGradient>
      <linearGradient id={`${id}-sweater`} x1="0" y1="0" x2="1" y2="0.4">
        <stop offset="0" stopColor="#3B8061" />
        <stop offset="0.55" stopColor={SWEATER} />
        <stop offset="1" stopColor="#173F2F" />
      </linearGradient>
      <linearGradient id={`${id}-scarf`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stopColor="#FFE3A0" />
        <stop offset="1" stopColor="#E9B44C" />
      </linearGradient>
      <radialGradient id={`${id}-shoe`} cx="40%" cy="30%" r="80%">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="1" stopColor="#E9DFCB" />
      </radialGradient>
      <radialGradient id={`${id}-hand`} cx="40%" cy="30%" r="80%">
        <stop offset="0" stopColor="#FFB09F" />
        <stop offset="1" stopColor="#E3745D" />
      </radialGradient>
    </defs>
  );
}

function Arm({ pose, limb, x, id }: { pose: MascotPose; limb: Limb; x: number; id: string }) {
  return (
    <g transform={`translate(${x} 82)`}>
      <motion.g
        initial={false}
        animate={limbTarget(pose, limb)}
        style={{ originX: 0.5, originY: 0 }}
      >
        <line x1={0} y1={0} x2={0} y2={29} stroke="#D9634D" strokeWidth={10} strokeLinecap="round" />
        <line x1={-1.5} y1={2} x2={-1.5} y2={27} stroke={FACE} strokeWidth={6} strokeLinecap="round" />
        <circle cx={0} cy={33} r={6.2} fill={`url(#${id}-hand)`} />
        <circle cx={-1.8} cy={31} r={1.6} fill="#fff" opacity={0.45} />
      </motion.g>
    </g>
  );
}

function Leg({ pose, limb, x, id }: { pose: MascotPose; limb: Limb; x: number; id: string }) {
  return (
    <g transform={`translate(${x} 116)`}>
      <motion.g
        initial={false}
        animate={limbTarget(pose, limb)}
        style={{ originX: 0.5, originY: 0 }}
      >
        <line x1={0} y1={0} x2={0} y2={30} stroke={INK} strokeWidth={10} strokeLinecap="round" />
        <ellipse cx={3} cy={36} rx={11} ry={6} fill={`url(#${id}-shoe)`} stroke={INK} strokeWidth={2} />
        <path d="M-5 37 Q3 41 11 37" fill="none" stroke="#C9BBA0" strokeWidth={1.6} strokeLinecap="round" />
      </motion.g>
    </g>
  );
}

/** Eyes blink every few seconds so the character never looks frozen. */
function Eyes({ children, cy }: { children: React.ReactNode; cy: number }) {
  return (
    <motion.g
      initial={false}
      animate={{ scaleY: [1, 1, 0.08, 1] }}
      transition={{ duration: 3.8, times: [0, 0.93, 0.96, 1], repeat: Infinity, ease: 'easeInOut' }}
      style={{ originX: 0.5, originY: 0, transformOrigin: `60px ${cy}px` }}
    >
      {children}
    </motion.g>
  );
}

function Face({ pose, id }: { pose: MascotPose; id: string }) {
  const laughing = pose === 'laugh';
  const surprised = pose === 'fall';
  return (
    <g>
      <circle cx={60} cy={42} r={30} fill={`url(#${id}-head)`} />
      {/* soft sound-wave tuft, the SAUTI motif */}
      <path
        d="M44 15 q6 -11 12 0 q6 -11 12 0 q6 -11 12 0"
        fill="none"
        stroke={`url(#${id}-scarf)`}
        strokeWidth={4.5}
        strokeLinecap="round"
      />
      {/* rim light on the upper left of the head */}
      <path d="M36 30 Q40 16 54 13" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" opacity={0.35} />
      <ellipse cx={42} cy={50} rx={5} ry={3.2} fill="#FFB4A6" opacity={0.75} />
      <ellipse cx={78} cy={50} rx={5} ry={3.2} fill="#FFB4A6" opacity={0.75} />
      {laughing ? (
        <>
          <path d="M44 40 q5 -7 10 0" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
          <path d="M66 40 q5 -7 10 0" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
          <motion.g
            initial={false}
            animate={{ scaleY: [1, 0.78, 1] }}
            transition={{ duration: 0.22, repeat: Infinity, ease: 'easeInOut' }}
            style={{ transformOrigin: '60px 49px' }}
          >
            <path d="M46 49 Q60 74 74 49 Z" fill="#7A2A1F" />
            <path d="M48 49.5 H72 Q70 54 60 54 Q50 54 48 49.5 Z" fill="#FFF8ED" />
            <path d="M53 63 Q60 57 67 63 Q60 69 53 63 Z" fill="#FFB4A6" />
          </motion.g>
        </>
      ) : surprised ? (
        <>
          <circle cx={49} cy={40} r={4.8} fill="#fff" stroke={INK} strokeWidth={1.5} />
          <circle cx={71} cy={40} r={4.8} fill="#fff" stroke={INK} strokeWidth={1.5} />
          <circle cx={49} cy={41} r={2.3} fill={INK} />
          <circle cx={71} cy={41} r={2.3} fill={INK} />
          <ellipse cx={60} cy={56} rx={5} ry={6.5} fill="#7A2A1F" />
        </>
      ) : (
        <>
          <Eyes cy={40}>
            <circle cx={49} cy={40} r={3.8} fill={INK} />
            <circle cx={71} cy={40} r={3.8} fill={INK} />
            <circle cx={50.2} cy={38.6} r={1.2} fill="#fff" />
            <circle cx={72.2} cy={38.6} r={1.2} fill="#fff" />
          </Eyes>
          <path d="M50 52 Q60 61 70 52" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
        </>
      )}
    </g>
  );
}

export function ZuriMascot({
  pose = 'idle',
  facing = 1,
  size = 104,
  headOnly = false,
  className = '',
}: ZuriMascotProps) {
  const id = useId().replace(/:/g, '');

  if (headOnly) {
    return (
      <svg
        viewBox="22 6 76 72"
        width={size}
        height={size * 0.95}
        className={className}
        aria-hidden="true"
        focusable="false"
      >
        <Defs id={id} />
        <Face pose="idle" id={id} />
      </svg>
    );
  }

  const lying = pose === 'lying' || pose === 'laugh';
  const bodyMotion: TargetAndTransition =
    pose === 'walk'
      ? { y: [0, -4], rotate: 0, transition: { y: swing(0.14), rotate: { duration: 0.2 } } }
      : pose === 'laugh'
      ? {
          // Lying on its back pivots around the feet, so lift by half the body width to rest on the ground.
          y: [-LIE_LIFT, -LIE_LIFT - 3],
          rotate: 90,
          transition: { y: swing(0.09), rotate: { duration: 0.35, ease: 'easeOut' } },
        }
      : pose === 'fall'
      ? { y: 0, rotate: [-14, 14], transition: { rotate: swing(0.22), y: { duration: 0.1 } } }
      : {
          y: lying ? -LIE_LIFT : 0,
          rotate: lying ? 90 : 0,
          transition: { rotate: { duration: 0.45, ease: 'easeOut' }, y: { duration: 0.3, ease: 'easeOut' } },
        };

  return (
    <svg
      viewBox="0 0 120 170"
      width={size}
      height={size * 1.42}
      className={className}
      style={{ transform: `scaleX(${facing})`, overflow: 'visible' }}
      aria-hidden="true"
      focusable="false"
    >
      <Defs id={id} />
      <ellipse cx={60} cy={162} rx={30} ry={4.5} fill="#17201C" opacity={0.18} />
      <ellipse cx={60} cy={162} rx={20} ry={2.6} fill="#17201C" opacity={0.14} />
      <motion.g initial={false} animate={bodyMotion} style={{ originX: 0.5, originY: 1 }}>
        <Leg pose={pose} limb="legL" x={50} id={id} />
        <Leg pose={pose} limb="legR" x={70} id={id} />
        <rect x={37} y={68} width={46} height={56} rx={23} fill={`url(#${id}-sweater)`} />
        <path d="M43 80 Q42 100 47 116" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" opacity={0.18} />
        <rect x={39} y={64} width={42} height={14} rx={7} fill={`url(#${id}-scarf)`} />
        <Arm pose={pose} limb="armL" x={40} id={id} />
        <Arm pose={pose} limb="armR" x={80} id={id} />
        <Face pose={pose} id={id} />
      </motion.g>
    </svg>
  );
}
