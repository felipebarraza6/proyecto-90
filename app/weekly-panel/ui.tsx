import type { ReactNode } from "react";
import { chipAriaLabel, colorClass, formatPct, habitDisplay, studentStatusLabels } from "./format";
import type { DayChip } from "./types";

export function RetryError({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  return (
    <div className="wp-error" role="alert">
      <p>{message}</p>
      <button type="button" className="secondary" onClick={onRetry}>
        Reintentar
      </button>
    </div>
  );
}

export function EmptyNote({ title, copy }: { title: string; copy?: string }) {
  return (
    <article className="empty-state wp-empty">
      <span className="icon-tile">▦</span>
      <h2>{title}</h2>
      {copy ? <p>{copy}</p> : null}
    </article>
  );
}

export function SkeletonTable({ rows = 6 }: { rows?: number }) {
  return (
    <div className="wp-skeleton" aria-busy="true" aria-live="polite">
      <span className="wp-sr">Cargando panel…</span>
      {Array.from({ length: rows }, (_, i) => (
        <div className="wp-skeleton-row" key={i}>
          <i />
          <i />
          <i />
          <i />
        </div>
      ))}
    </div>
  );
}

export function PercentChip({
  pct,
  color,
  label,
  date,
  onOpen,
}: {
  pct: number | null;
  color: string;
  label: string;
  date: string;
  onOpen?: () => void;
}) {
  const className = `wp-chip ${colorClass(color)}`;
  const aria = chipAriaLabel({ date, pct, label });
  if (onOpen) {
    return (
      <button type="button" className={className} aria-label={aria} onClick={onOpen}>
        <b>{formatPct(pct)}</b>
        <small>{label}</small>
      </button>
    );
  }
  return (
    <span className={className} aria-label={aria}>
      <b>{formatPct(pct)}</b>
      <small>{label}</small>
    </span>
  );
}

export function StatusBadges({ status }: { status: string[] }) {
  const badges = studentStatusLabels(status);
  return (
    <span className="wp-badges">
      {badges.map((b) => (
        <span key={b.code} className={`wp-badge ${b.code}`}>
          {b.label}
        </span>
      ))}
    </span>
  );
}

export function HabitMark({ status }: { status: string }) {
  const d = habitDisplay(status);
  return (
    <span className={`wp-habit ${d.kind}`} title={d.text}>
      <b aria-hidden="true">{d.icon}</b>
      <small>{d.text}</small>
    </span>
  );
}

export function SectionBlock({
  eyebrow,
  title,
  action,
  children,
}: {
  eyebrow?: string;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="wp-section">
      <header className="wp-section-head">
        <div>
          {eyebrow ? <span className="eyebrow">{eyebrow}</span> : null}
          <h2>{title}</h2>
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function MiniDayChips({ days, onOpen }: { days: DayChip[]; onOpen?: () => void }) {
  return (
    <div className="wp-mini-days">
      {days.map((day) => (
        <PercentChip
          key={day.date}
          pct={day.pct}
          color={day.color}
          label={day.label}
          date={day.date}
          onOpen={onOpen}
        />
      ))}
    </div>
  );
}
