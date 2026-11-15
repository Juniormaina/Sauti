import { useEffect, useRef, useState } from 'react';
import { animate, AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ZuriMascot, type MascotPose } from './ZuriMascot';

const SIZE = 104;
const GROUND = 6;
const INTERACTIVE = 'a,button,input,select,textarea,label,summary,[role="button"],[role="link"],[contenteditable="true"]';

interface TapScene {
  id: number;
  x: number;
  walkDir: 1 | -1;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const wait = (ms: number) => new Promise<void>((r) => window.setTimeout(r, ms));

/** Mascot A crosses the whole page along the bottom edge. */
function Walker({ dir, onDone }: { dir: 1 | -1; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let cancelled = false;
    const vw = window.innerWidth;
    const from = dir === 1 ? -SIZE - 24 : vw + 24;
    const to = dir === 1 ? vw + 24 : -SIZE - 24;
    const controls = animate(el, { x: [from, to] }, { duration: Math.max(3.2, vw / 200), ease: 'linear' });
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
    <div
      ref={ref}
      className="absolute left-0"
      style={{ bottom: GROUND, width: SIZE, transform: 'translateX(-9999px)' }}
    >
      <ZuriMascot pose="walk" facing={dir} size={SIZE} />
    </div>
  );
}

/**
 * Mascot B drops in from above at the tap point, lands on its back, laughs,
 * gets back up and walks off towards the nearest edge.
 */
function Faller({ x, onDone }: { x: number; onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [pose, setPose] = useState<MascotPose>('fall');
  const [facing, setFacing] = useState<1 | -1>(1);
  const [laughing, setLaughing] = useState(false);

  const vw = typeof window === 'undefined' ? 1024 : window.innerWidth;
  const vh = typeof window === 'undefined' ? 768 : window.innerHeight;
  // Leave room on the right for the lying body.
  const left = clamp(x - SIZE / 2, 8, Math.max(8, vw - SIZE * 2.3));
  const groundY = vh - SIZE * 1.42 - GROUND;

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
      // 1. Fall from above the viewport.
      await run({ y: [-SIZE * 1.6, groundY] }, { duration: 0.7, ease: [0.55, 0, 1, 0.45] });
      if (cancelled) return;

      // 2. Land on its back with a small squash.
      setPose('lying');
      await run({ scaleY: [1, 0.84, 1] }, { duration: 0.24, ease: 'easeOut' });
      if (cancelled) return;
      await wait(260);
      if (cancelled) return;

      // 3. Laugh.
      setPose('laugh');
      setLaughing(true);
      await wait(1700);
      if (cancelled) return;
      setLaughing(false);

      // 4. Get up with a little hop.
      setPose('idle');
      await wait(380);
      if (cancelled) return;
      await run({ y: [groundY, groundY - 20, groundY] }, { duration: 0.34, ease: 'easeOut' });
      if (cancelled) return;
      await wait(200);
      if (cancelled) return;

      // 5. Walk away towards the nearer edge.
      const dir: 1 | -1 = left + SIZE / 2 < vw / 2 ? -1 : 1;
      setFacing(dir);
      setPose('walk');
      const distance = dir === 1 ? vw - left + SIZE : left + SIZE * 2;
      await run({ x: dir === 1 ? distance : -distance }, { duration: Math.max(2, distance / 190), ease: 'linear' });
      if (!cancelled) onDone();
    })();

    return () => {
      cancelled = true;
      running.forEach((c) => c.stop());
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={ref}
      className="absolute top-0"
      style={{
        left,
        width: SIZE,
        transform: `translateY(${-SIZE * 1.6}px)`,
        transformOrigin: '50% 100%',
      }}
    >
      <ZuriMascot pose={pose} facing={facing} size={SIZE} />
      <AnimatePresence>
        {laughing && (
          <motion.span
            initial={{ opacity: 0, scale: 0.6, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: [0, -5, 0] }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ duration: 0.5, y: { duration: 0.45, repeat: Infinity } }}
            className="absolute whitespace-nowrap rounded-full bg-[#F6C96B] px-3 py-1 font-display text-sm font-bold text-[#17201C] shadow-sm"
            style={{ left: SIZE * 1.05, bottom: SIZE * 0.85 }}
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
