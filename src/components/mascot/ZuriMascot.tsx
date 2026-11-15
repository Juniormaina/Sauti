import { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { HEAD_PX, STILLS, WALK_FRAMES, WALK_SIZE, type StillKey } from './sprites';

export type MascotPose = 'idle' | 'wave' | 'walk' | 'fall' | 'getup' | 'lying' | 'laugh';

interface ZuriMascotProps {
  pose?: MascotPose;
  /** 1 faces right, -1 faces left. */
  facing?: 1 | -1;
  /** Head diameter in px; the whole figure scales with it. In `headOnly` mode, the emblem width in px. */
  size?: number;
  /** Show only the head (used as a small brand emblem). */
  headOnly?: boolean;
  /** Seconds for one full walk cycle. */
  walkPeriod?: number;
  className?: string;
}

const STILL_FOR: Record<Exclude<MascotPose, 'walk'>, StillKey> = {
  idle: 'idle',
  wave: 'wave',
  getup: 'getup',
  fall: 'fall',
  lying: 'laugh',
  laugh: 'laugh',
};

/** Displayed pixel size of a pose for a given head diameter. */
export function spriteSize(pose: MascotPose, head: number) {
  const k = head / HEAD_PX;
  const s = pose === 'walk' ? WALK_SIZE : STILLS[STILL_FOR[pose]];
  return { w: Math.round(s.w * k), h: Math.round(s.h * k) };
}

/** Tallest pose, used to size the stage so no pose is clipped. */
export function maxSpriteHeight(head: number) {
  return Math.max(...(['idle', 'wave', 'walk', 'fall', 'getup', 'laugh'] as const).map((p) => spriteSize(p, head).h));
}

function WalkCycle({ w, h, period }: { w: number; h: number; period: number }) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    const id = window.setInterval(
      () => setFrame((f) => (f + 1) % WALK_FRAMES.length),
      (period * 1000) / WALK_FRAMES.length
    );
    return () => window.clearInterval(id);
  }, [period]);
  return (
    <>
      {WALK_FRAMES.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          width={w}
          height={h}
          className="absolute inset-0 select-none"
          style={{ visibility: i === frame ? 'visible' : 'hidden' }}
        />
      ))}
    </>
  );
}

export function ZuriMascot({
  pose = 'idle',
  facing = 1,
  size = 80,
  headOnly = false,
  walkPeriod = 0.95,
  className = '',
}: ZuriMascotProps) {
  if (headOnly) {
    const { src, w, h } = STILLS.head;
    return (
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        width={size}
        height={Math.round((size * h) / w)}
        className={className}
        style={{ objectFit: 'contain' }}
      />
    );
  }

  const { w, h } = spriteSize(pose, size);
  const laughing = pose === 'laugh';
  const falling = pose === 'fall';

  return (
    <div
      aria-hidden="true"
      className={`relative ${className}`}
      style={{ width: w, height: h, transform: `scaleX(${facing})`, transformOrigin: '50% 100%' }}
    >
      {/* soft contact shadow, drawn in CSS because the cut-outs carry none */}
      <div
        className="absolute left-1/2 rounded-[50%] bg-[#17201C]"
        style={{
          bottom: -h * 0.02,
          width: w * (pose === 'laugh' || pose === 'lying' || pose === 'getup' ? 0.85 : 0.6),
          height: Math.max(6, h * 0.045),
          transform: 'translateX(-50%)',
          opacity: falling ? 0.08 : 0.16,
          filter: 'blur(3px)',
        }}
      />
      <motion.div
        className="absolute inset-0"
        style={{ transformOrigin: '50% 100%' }}
        animate={
          laughing
            ? { y: [0, -4, 0], rotate: [-1.5, 1.5, -1.5] }
            : falling
            ? { rotate: [-7, 7] }
            : { y: 0, rotate: 0 }
        }
        transition={
          laughing
            ? { duration: 0.22, repeat: Infinity, ease: 'easeInOut' }
            : falling
            ? { duration: 0.3, repeat: Infinity, repeatType: 'mirror', ease: 'easeInOut' }
            : { duration: 0.2 }
        }
      >
        {pose === 'walk' ? (
          <WalkCycle w={w} h={h} period={walkPeriod} />
        ) : (
          <img
            src={STILLS[STILL_FOR[pose]].src}
            alt=""
            draggable={false}
            width={w}
            height={h}
            className="absolute inset-0 select-none"
          />
        )}
      </motion.div>
    </div>
  );
}
