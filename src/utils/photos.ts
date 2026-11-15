export type PhotoKey =
  | 'hero'
  | 'little-voices'
  | 'young-explorers'
  | 'teens'
  | 'young-adults'
  | 'professional'
  | 'lifelong';

const files = import.meta.glob('../assets/images/photo/*.webp', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>;

const WIDTHS = [480, 960, 1440] as const;

export interface PhotoSource {
  src: string;
  srcSet: string;
  width: number;
  height: number;
}

/** Responsive WebP sources (480/960/1440 wide, 16:10) for a generated image. */
export function photo(key: PhotoKey): PhotoSource {
  const url = (w: number) => files[`../assets/images/photo/${key}-${w}.webp`] ?? '';
  return {
    src: url(960),
    // Only list widths that exist (the journey crops are 480/960; the hero also has 1440).
    srcSet: WIDTHS.filter((w) => url(w)).map((w) => `${url(w)} ${w}w`).join(', '),
    width: 960,
    // The hero group shot keeps its native aspect; journey crops are 16:10.
    height: key === 'hero' ? 524 : 600,
  };
}
