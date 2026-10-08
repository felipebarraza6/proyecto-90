import { WEEKDAYS_SHORT } from "./format";
import type { WeekOption } from "./types";

export function WeekSelector({
  weeks,
  current,
  weekStart,
  isCurrent,
  label,
  onChange,
}: {
  weeks: WeekOption[];
  current?: string;
  weekStart: string | null;
  isCurrent?: boolean;
  label?: string;
  onChange: (start: string) => void;
}) {
  const index = weeks.findIndex((w) => w.start === weekStart);
  const prev = index > 0 ? weeks[index - 1] : null;
  const next = index >= 0 && index < weeks.length - 1 ? weeks[index + 1] : null;
  const shown =
    weeks.find((w) => w.start === weekStart)?.label || label || weekStart || "Semana";
  const currentTag = isCurrent || weekStart === current;

  return (
    <div className="wp-week-selector" role="group" aria-label="Selector de semana">
      <button
        type="button"
        className="secondary wp-week-nav"
        disabled={!prev}
        aria-label="Semana anterior"
        onClick={() => prev && onChange(prev.start)}
      >
        ‹
      </button>
      <label className="wp-week-select">
        <span className="wp-sr">Semana</span>
        <select
          value={weekStart || ""}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Lista de semanas"
        >
          {!weekStart && <option value="">Elegir semana</option>}
          {weekStart && !weeks.some((w) => w.start === weekStart) && (
            <option value={weekStart}>{shown}</option>
          )}
          {weeks.map((w) => (
            <option key={w.start} value={w.start}>
              {w.label}
              {w.start === current ? " · semana en curso" : ""}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="secondary wp-week-nav"
        disabled={!next}
        aria-label="Semana siguiente"
        onClick={() => next && onChange(next.start)}
      >
        ›
      </button>
      <p className="wp-week-caption">
        {shown}
        {currentTag ? " · semana en curso" : ""}
        <small>
          {WEEKDAYS_SHORT[0]}–{WEEKDAYS_SHORT[6]}
        </small>
      </p>
    </div>
  );
}
