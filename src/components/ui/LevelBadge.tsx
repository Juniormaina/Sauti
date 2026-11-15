/** CEFR level pill. Colour follows the band (A beginner, B independent, C proficient); dark text keeps contrast. */
export function LevelBadge({ level, className = '' }: { level: string; className?: string }) {
  const band = level?.[0]?.toUpperCase();
  const tone =
    band === 'A'
      ? 'bg-[#A9D9E8] text-[#17201C]'
      : band === 'B'
      ? 'bg-[#F6C96B] text-[#17201C]'
      : band === 'C'
      ? 'bg-[#F28B75] text-[#17201C]'
      : 'bg-[#E7E2D8] text-[#17201C]';
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${tone} ${className}`}
    >
      {level}
    </span>
  );
}
