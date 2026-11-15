import { CSSProperties, useRef } from 'react';
import {
  motion,
  useMotionValue,
  useMotionValueEvent,
  useReducedMotion,
  useSpring,
  type MotionValue,
} from 'motion/react';
import { SAUTI_EASE } from './SautiMotion';

const LETTERS = ['S', 'A', 'U', 'T', 'I'];

/** Halftone / dithered fill: forest dots with offset coral dots, clipped to the glyph. */
const DITHER: CSSProperties = {
  backgroundImage:
    'radial-gradient(circle at 50% 50%, #245C45 0 2.7px, transparent 3.2px), radial-gradient(circle at 50% 50%, #F28B75 0 1.6px, transparent 2.1px)',
  backgroundSize: '7px 7px, 7px 7px',
  backgroundPosition: '0 0, 3.5px 3.5px',
  WebkitBackgroundClip: 'text',
  backgroundClip: 'text',
  color: 'transparent',
  WebkitTextFillColor: 'transparent',
  WebkitTextStroke: '2px #245C45',
};

function Letter({
  char,
  index,
  pointerX,
  interactive,
}: {
  char: string;
  index: number;
  pointerX: MotionValue<number>;
  interactive: boolean;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const lift = useSpring(0, { stiffness: 240, damping: 20 });
  const tilt = useSpring(0, { stiffness: 240, damping: 20 });

  useMotionValueEvent(pointerX, 'change', (px) => {
    const el = ref.current;
    if (!el || !interactive) return;
    const r = el.getBoundingClientRect();
    const centre = r.left + r.width / 2;
    const t = Math.max(0, 1 - Math.abs(px - centre) / (r.width * 1.5));
    lift.set(-t * r.height * 0.12);
    tilt.set(((px - centre) / r.width) * -7 * t);
  });

  return (
    <span className="-mt-[0.2em] inline-block overflow-hidden pt-[0.2em] align-bottom">
      <motion.span
        initial={interactive ? { y: '108%' } : false}
        animate={{ y: 0 }}
        transition={{ duration: 0.95, delay: 0.1 + index * 0.08, ease: SAUTI_EASE }}
        className="inline-block"
      >
        <motion.span
          ref={ref}
          style={{ y: lift, rotate: tilt, ...DITHER }}
          className="inline-block px-[0.02em]"
        >
          {char}
        </motion.span>
      </motion.span>
    </span>
  );
}

/**
 * Oversized dithered SAUTI wordmark. Letters rise out of a mask on load and,
 * with a mouse, lift and tilt towards the pointer. Static under reduced motion.
 */
export function KineticWordmark({ className = '' }: { className?: string }) {
  const reduced = useReducedMotion();
  const pointerX = useMotionValue(-9999);
  const interactive = !reduced;

  return (
    <h1
      aria-label="SAUTI"
      onPointerMove={(e) => {
        if (interactive && e.pointerType === 'mouse') pointerX.set(e.clientX);
      }}
      onPointerLeave={() => pointerX.set(-9999)}
      className={`select-none font-display font-extrabold leading-[0.85] tracking-[-0.04em] text-[clamp(5.5rem,25vw,24rem)] ${className}`}
    >
      {LETTERS.map((char, i) => (
        <Letter key={char + i} char={char} index={i} pointerX={pointerX} interactive={interactive} />
      ))}
    </h1>
  );
}
