// Generated from the supplied Zuri renders (background removed). Sizes are at HEAD_PX = 180.
import idle from '../../assets/images/zuri/idle.webp';
import wave from '../../assets/images/zuri/wave.webp';
import getup from '../../assets/images/zuri/getup.webp';
import laugh from '../../assets/images/zuri/laugh.webp';
import fall from '../../assets/images/zuri/fall.webp';
import head from '../../assets/images/zuri/head.webp';
import walk_00 from '../../assets/images/zuri/walk-00.webp';
import walk_01 from '../../assets/images/zuri/walk-01.webp';
import walk_02 from '../../assets/images/zuri/walk-02.webp';
import walk_03 from '../../assets/images/zuri/walk-03.webp';
import walk_04 from '../../assets/images/zuri/walk-04.webp';
import walk_05 from '../../assets/images/zuri/walk-05.webp';
import walk_06 from '../../assets/images/zuri/walk-06.webp';
import walk_07 from '../../assets/images/zuri/walk-07.webp';
import walk_08 from '../../assets/images/zuri/walk-08.webp';
import walk_09 from '../../assets/images/zuri/walk-09.webp';
import walk_10 from '../../assets/images/zuri/walk-10.webp';
import walk_11 from '../../assets/images/zuri/walk-11.webp';
import walk_12 from '../../assets/images/zuri/walk-12.webp';
import walk_13 from '../../assets/images/zuri/walk-13.webp';
import walk_14 from '../../assets/images/zuri/walk-14.webp';
import walk_15 from '../../assets/images/zuri/walk-15.webp';

/** Pixel height of Zuri's head in the stored sprites; scale = displayed head / HEAD_PX. */
export const HEAD_PX = 180;

export type StillKey = 'idle' | 'wave' | 'getup' | 'laugh' | 'fall' | 'head';

export const STILLS: Record<StillKey, { src: string; w: number; h: number }> = {
  idle: { src: idle, w: 234, h: 448 },
  wave: { src: wave, w: 278, h: 465 },
  getup: { src: getup, w: 345, h: 369 },
  laugh: { src: laugh, w: 437, h: 340 },
  fall: { src: fall, w: 434, h: 370 },
  head: { src: head, w: 385, h: 452 },
};

export const WALK_FRAMES: string[] = [walk_00, walk_01, walk_02, walk_03, walk_04, walk_05, walk_06, walk_07, walk_08, walk_09, walk_10, walk_11, walk_12, walk_13, walk_14, walk_15];
export const WALK_SIZE = { w: 266, h: 483 };
