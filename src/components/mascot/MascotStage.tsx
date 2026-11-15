import { useEffect, useRef, useState } from 'react';
import { animate, AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ZuriMascot, maxSpriteHeight, spriteSize, type MascotPose } from './ZuriMascot';

const GROUND = 6;
const INTERACTIVE = 'a,button,input,select,textarea,label,summary,[role="button"],[role="link"],[contenteditable="true"]';
const WALK_SPEED = 170; // px per second
const STRIDE = 1.9; // head-widths covered per walk cycle, so the feet do not slide

interface TapScene {
  id: number;
  x: number;
  walkDir: 1 | -1;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));
const headFor = (vw: number) => Math.round(clamp(vw / 12, 60, 108));

/** Mascot A crosses the whole page along the bottom edge. */
function Walker({ dir, onDone }: { dir: 1 | -1; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const vw = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const head = headFor(vw);
  const { w } = spriteSize('walk', head);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const from = dir === 1 ? -w - 24 : vw + 24;
    const to = dir === 1 ? vw + 24 : -w - 24;
    const controls = animate(el, { x: [from, to] }, { duration: Math.abs(to - from) / WALK_SPEED, ease: 'linear' });
    controls.then(() => {
      if (!cancelled) onDone();
    });
    return () => {
      cancelled = true;
      controls.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={ref} className="absolute left-0" style={{ bottom: GROUND, transform: 'translateX(-9999px)' }}>
      <ZuriMascot pose="walk" facing={dir} size={head} walkPeriod={(STRIDE * head) / WALK_SPEED} />
    </div>
  );
}

/** Three soft puffs kicked up at the feet on landing. */
function DustPuff({ spread }: { spread: number }) {
  return (
    <>
      {[-1, 0, 1].map((n) => (
        <motion.span
          key={n}
          initial={{ opacity: 0.55, scale: 0.4, x: 0, y: 0 }}
          animate={{ opacity: 0, scale: 1.5, x: n * spread, y: -10 - (1 - Math.abs(n)) * 8 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
          className="absolute rounded-full bg-[#D9CDB6]"
          style={{ left: -9, bottom: 0, width: 18, height: 18 }}
        />
      ))}
    </>
  );
}

/**
 * Mascot B drops in from above at the tap point, lands on its back, laughs,
 * pushes itself up, waves and walks off towards the nearest edge.
 */
function Faller({ x, onDone }: { x: number; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pose, setPose] = useState<MascotPose>('fall');
  const [facing, setFacing] = useState<1 | -1>(1);
  const [laughing, setLaughing] = useState(false);
  const [dust, setDust] = useState(0);

  const vw = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 768 : window.innerHeight;
  const head = headFor(vw);
  const tall = maxSpriteHeight(head);
  const widest = Math.max(spriteSize('laugh', head).w, spriteSize('getup', head).w);
  const cx = clamp(x, widest / 2 + 8, Math.max(widest / 2 + 8, vw - widest / 2 - 8));
  const groundY = vh - tall - GROUND;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const running: Array<{ stop: () => void }> = [];
    const run = (target: Record<string, unknown>, options: Record<string, unknown>) => {
      const c = animate(el, target as never, options as never);
      running.push(c);
      return c;
    };

    (async () => {
      // 1. Fall from above the viewport, stretching as it speeds up.
      run({ scaleY: [1, 1.08], scaleX: [1, 0.96] }, { duration: 0.7, ease: 'easeIn' });
      await run({ y: [-tall * 1.4, groundY] }, { duration: 0.7, ease: [0.55, 0, 1, 0.45] });
      if (cancelled) return;

      // 2. Land on its back: heavy squash, a small rebound, then settle. Dust puffs out.
      setPose('lying');
      setDust((d) => d + 1);
      await run(
        { scaleY: [1.08, 0.78, 1.05, 0.97, 1], scaleX: [0.96, 1.16, 0.98, 1.02, 1] },
        { duration: 0.5, ease: 'easeOut', times: [0, 0.22, 0.5, 0.75, 1] }
      );
      if (cancelled) return;
      await wait(180);
      if (cancelled) return;

      // 3. Laugh.
      setPose('laugh');
      setLaughing(true);
      await wait(1800);
      if (cancelled) return;
      setLaughing(false);

      // 4. Push up off the floor, then spring to standing with a wave.
      setPose('getup');
      await wait(650);
      if (cancelled) return;
      setPose('wave');
      await run(
        { y: [groundY, groundY - 26, groundY], scaleY: [0.92, 1.06, 0.94, 1], scaleX: [1.05, 0.96, 1.05, 1] },
        { duration: 0.42, ease: 'easeOut', times: [0, 0.5, 0.85, 1] }
      );
      if (cancelled) return;
      setDust((d) => d + 1);
      await wait(700);
      if (cancelled) return;

      // 5. Walk away towards the nearer edge.
      const dir: 1 | -1 = cx < vw / 2 ? -1 : 1;
      setFacing(dir);
      setPose('walk');
      const walkW = spriteSize('walk', head).w;
      const distance = dir === 1 ? vw - cx + walkW : cx + walkW;
      await run({ x: dir === 1 ? distance : -distance }, { duration: distance / WALK_SPEED, ease: 'linear' });
      if (!cancelled) onDone();
    })();

    return () => {
      cancelled = true;
      running.forEach((c) => c.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const laughSize = spriteSize('laugh', head);

  return (
    <div
      ref={ref}
      className="absolute top-0"
      style={{
        left: cx,
        width: 0,
        height: tall,
        transform: `translateY(${-tall * 1.4}px)`,
        transformOrigin: '0 100%',
      }}
    >
      <div className="absolute bottom-0 left-0" style={{ transform: 'translateX(-50%)' }}>
        <ZuriMascot
          pose={pose}
          facing={facing}
          size={head}
          walkPeriod={(STRIDE * head) / WALK_SPEED}
        />
      </div>
      {dust > 0 && <DustPuff key={dust} spread={head * 0.8} />}
      <AnimatePresence>
        {laughing && (
          <motion.span
            initial={{ opacity: 0, scale: 0.6, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: [0, -5, 0] }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.5, y: { duration: 0.45, repeat: Infinity } }}
            className="absolute whitespace-nowrap rounded-full bg-[#F6C96B] px-3 py-1 font-display text-sm font-bold text-[#17201C] shadow-sm"
            style={{ left: laughSize.w * 0.22, bottom: laughSize.h + 6 }}
          >
            ha ha ha!
          </motion.span>
        )}
      </AnimatePresence>
    </div>
  );
}

function Scene({ scene, onFinish }: { scene: TapScene; onFinish: (id: number) => void }) {
  const done = useRef(0);
  const finishOne = () => {
    done.current += 1;
    if (done.current >= 2) onFinish(scene.id);
  };
  return (
    <>
      <Walker dir={scene.walkDir} onDone={finishOne} />
      <Faller x={scene.x} onDone={finishOne} />
    </>
  );
}

/**
 * Touch/click anywhere (outside links, buttons and form controls) and Zuri
 * walks across the page while a second Zuri falls in, laughs, gets up and
 * wanders off. Uses `click` so scrolling gestures never trigger it, and is
 * disabled entirely under prefers-reduced-motion.
 */
export function MascotStage() {
  const reduced = useReducedMotion();
  const [scene, setScene] = useState<TapScene | null>(null);
  const [showHint, setShowHint] = useState(false);
  const counter = useRef(0);
  const busy = useRef(false);

  useEffect(() => {
    if (reduced) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Element | null;
      if (busy.current || (target && target.closest(INTERACTIVE))) return;
      busy.current = true;
      counter.current += 1;
      setShowHint(false);
      setScene({ id: counter.current, x: e.clientX, walkDir: Math.random() < 0.5 ? 1 : -1 });
    };
    window.addEventListener('click', onClick);
    const showTimer = window.setTimeout(() => setShowHint(true), 1400);
    const hideTimer = window.setTimeout(() => setShowHint(false), 9000);
    return () => {
      window.removeEventListener('click', onClick);
      window.clearTimeout(showTimer);
      window.clearTimeout(hideTimer);
    };
  }, [reduced]);

  if (reduced) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[70] overflow-hidden">
      <AnimatePresence>
        {showHint && !scene && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            className="absolute inset-x-0 bottom-5 flex justify-center"
          >
            <span className="rounded-full border border-[#245C45]/20 bg-[#FFF8ED]/95 px-4 py-2 font-mono text-xs font-semibold text-[#245C45] shadow-sm">
              Tap anywhere to meet Zuri
            </span>
          </motion.div>
        )}
      </AnimatePresence>
      {scene && (
        <Scene
          key={scene.id}
          scene={scene}
          onFinish={() => {
            busy.current = false;
            setScene(null);
          }}
        />
      )}
    </div>
  );
}
