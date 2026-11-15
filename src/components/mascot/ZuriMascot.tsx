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
const SCARF = '#F6C96B';
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

function Arm({ pose, limb, x }: { pose: MascotPose; limb: Limb; x: number }) {
  return (
    <g transform={`translate(${x} 82)`}>
      <motion.g
        initial={false}
        animate={limbTarget(pose, limb)}
        style={{ originX: 0.5, originY: 0 }}
      >
        <line x1={0} y1={0} x2={0} y2={30} stroke={FACE} strokeWidth={9} strokeLinecap="round" />
        <circle cx={0} cy={33} r={5.5} fill={FACE_SHADE} />
      </motion.g>
    </g>
  );
}

function Leg({ pose, limb, x }: { pose: MascotPose; limb: Limb; x: number }) {
  return (
    <g transform={`translate(${x} 116)`}>
      <motion.g
        initial={false}
        animate={limbTarget(pose, limb)}
        style={{ originX: 0.5, originY: 0 }}
      >
        <line x1={0} y1={0} x2={0} y2={30} stroke={INK} strokeWidth={10} strokeLinecap="round" />
        <ellipse cx={3} cy={36} rx={10} ry={5.5} fill={SHOE} stroke={INK} strokeWidth={2} />
      </motion.g>
    </g>
  );
}

function Face({ pose }: { pose: MascotPose }) {
  const laughing = pose === 'laugh';
  const surprised = pose === 'fall';
  return (
    <g>
      <circle cx={60} cy={42} r={30} fill={FACE} />
      {/* soft sound-wave tuft, the SAUTI motif */}
      <path
        d="M44 15 q6 -11 12 0 q6 -11 12 0 q6 -11 12 0"
        fill="none"
        stroke={SCARF}
        strokeWidth={4.5}
        strokeLinecap="round"
      />
      <ellipse cx={42} cy={50} rx={5} ry={3.2} fill="#FFB4A6" opacity={0.75} />
      <ellipse cx={78} cy={50} rx={5} ry={3.2} fill="#FFB4A6" opacity={0.75} />
      {laughing ? (
        <>
          <path d="M44 40 q5 -7 10 0" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
          <path d="M66 40 q5 -7 10 0" fill="none" stroke={INK} strokeWidth={3} strokeLinecap="round" />
          <path d="M46 49 Q60 74 74 49 Z" fill="#7A2A1F" />
          <path d="M53 62 Q60 56 67 62 Q60 68 53 62 Z" fill="#FFB4A6" />
        </>
      ) : surprised ? (
        <>
          <circle cx={49} cy={40} r={4.6} fill="#fff" stroke={INK} strokeWidth={1.5} />
          <circle cx={71} cy={40} r={4.6} fill="#fff" stroke={INK} strokeWidth={1.5} />
          <circle cx={49} cy={41} r={2.2} fill={INK} />
          <circle cx={71} cy={41} r={2.2} fill={INK} />
          <ellipse cx={60} cy={56} rx={5} ry={6.5} fill="#7A2A1F" />
        </>
      ) : (
        <>
          <circle cx={49} cy={40} r={3.4} fill={INK} />
          <circle cx={71} cy={40} r={3.4} fill={INK} />
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
        <Face pose="idle" />
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
      <ellipse cx={60} cy={162} rx={30} ry={4} fill="#17201C" opacity={0.14} />
      <motion.g initial={false} animate={bodyMotion} style={{ originX: 0.5, originY: 1 }}>
        <Leg pose={pose} limb="legL" x={50} />
        <Leg pose={pose} limb="legR" x={70} />
        <rect x={37} y={68} width={46} height={56} rx={23} fill={SWEATER} />
        <rect x={39} y={64} width={42} height={14} rx={7} fill={SCARF} />
        <Arm pose={pose} limb="armL" x={40} />
        <Arm pose={pose} limb="armR" x={80} />
        <Face pose={pose} />
      </motion.g>
    </svg>
  );
}
