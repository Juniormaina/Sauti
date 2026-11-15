import { ReactNode } from 'react';

interface PageHeaderProps {
  /** Small monospaced label above the title, e.g. "Learning library". */
  eyebrow?: string;
  title: string;
  subtitle?: ReactNode;
  /** Short facts shown as pills under the subtitle, e.g. ["12 courses", "A1–C2"]. */
  meta?: string[];
  /** Right-aligned controls (buttons, links). */
  actions?: ReactNode;
  /** Content above the eyebrow, e.g. a "Back" link. */
  back?: ReactNode;
  className?: string;
}

/** Shared page heading so every route has the same hierarchy: eyebrow, title, subtitle, facts. */
export function PageHeader({
  eyebrow,
  title,
  subtitle,
  meta,
  actions,
  back,
  className = '',
}: PageHeaderProps) {
  return (
    <header
      className={`flex flex-col gap-4 border-b border-[#245C45]/12 pb-6 md:flex-row md:items-end md:justify-between ${className}`}
    >
      <div className="min-w-0 space-y-2">
        {back}
        {eyebrow && (
          <p className="font-mono text-xs font-semibold text-[#245C45]">{eyebrow}</p>
        )}
        <h1 className="headline-balance font-display text-3xl font-bold leading-tight sm:text-4xl">
          {title}
        </h1>
        {subtitle && (
          <div className="max-w-3xl text-sm leading-relaxed text-[#4A5851] sm:text-base">
            {subtitle}
          </div>
        )}
        {meta && meta.length > 0 && (
          <ul className="flex flex-wrap gap-2 pt-1">
            {meta.map((m) => (
              <li
                key={m}
                className="rounded-full border border-[#245C45]/15 bg-white/70 px-3 py-1 font-mono text-[11px] font-semibold text-[#245C45]"
              >
                {m}
              </li>
            ))}
          </ul>
        )}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}
