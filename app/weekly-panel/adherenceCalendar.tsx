import type { ReactNode } from "react";
import type { ClosureDay } from "./insightsMath";
import { macroCalendarLabel, macroCalendarTone } from "./macroCalendar";

export function monthGrid(month: string): (string | null)[] {
  const [year, mon] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const startPad = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: startPad }, () => null);
  for (let day = 1; day <= days; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

const DOW = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function adherenceTone(pct: number): string {
  if (pct >= 90) return "tone-high";
  if (pct >= 80) return "tone-mid";
  return "tone-low";
}

export function MonthNav({
  label,
  onPrev,
  onNext,
}: {
  label: string;
  onPrev: () => void;
  onNext: () => void;
}) {
  return (
    <div className="wp-cal-nav">
      <button type="button" className="secondary" onClick={onPrev} aria-label="Mes anterior">
        ‹
      </button>
      <b>{label}</b>
      <button type="button" className="secondary" onClick={onNext} aria-label="Mes siguiente">
        ›
      </button>
    </div>
  );
}

export function AdherenceLegend() {
  return (
    <ul className="wp-cal-legend" aria-label="Leyenda de adherencia">
      <li><i className="tone-high" /> 90% o más</li>
      <li><i className="tone-mid" /> 80% a 89%</li>
      <li><i className="tone-low" /> bajo 80%</li>
      <li><i className="tone-empty" /> sin cierre</li>
      <li><i className="tone-today" /> hoy</li>
      <li><i className="tone-future" /> futuro</li>
    </ul>
  );
}

export function MacroPctLegend() {
  return (
    <ul className="wp-cal-legend" aria-label="Leyenda de cumplimiento de macros">
      <li><i className="tone-high" /> 80% o más</li>
      <li><i className="tone-low" /> bajo 80%</li>
      <li><i className="tone-empty" /> sin datos</li>
      <li><i className="tone-today" /> hoy</li>
      <li><i className="tone-future" /> futuro</li>
    </ul>
  );
}

export function HabitLegend() {
  return (
    <ul className="wp-cal-legend" aria-label="Leyenda del hábito">
      <li><i className="tone-high" /> cumplido</li>
      <li><i className="tone-low" /> no cumplido</li>
      <li><i className="tone-rest" /> descanso</li>
      <li><i className="tone-empty" /> sin registro</li>
      <li><i className="tone-today" /> hoy</li>
      <li><i className="tone-future" /> futuro</li>
    </ul>
  );
}

function DayShell({
  date,
  today,
  className,
  title,
  children,
}: {
  date: string;
  today: string;
  className: string;
  title: string;
  children: ReactNode;
}) {
  const flags = [
    className,
    date === today ? "is-today" : "",
    date > today ? "is-future" : "",
  ].filter(Boolean).join(" ");
  return (
    <span className={`wp-cal-cell ${flags}`} title={title}>
      {children}
    </span>
  );
}

export function AdherenceMonthCalendar({
  month,
  today,
  closures,
}: {
  month: string;
  today: string;
  closures: ClosureDay[];
}) {
  const byDate = new Map(closures.map((day) => [day.date, day]));
  return (
    <div className="wp-cal" aria-label="Adherencia diaria del mes">
      <div className="wp-cal-grid wp-cal-dow" aria-hidden="true">
        {DOW.map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="wp-cal-grid">
        {monthGrid(month).map((date, index) => {
          if (!date) return <span key={`pad-${index}`} className="wp-cal-pad" />;
          const dayNum = String(Number(date.slice(8)));
          if (date > today) {
            return (
              <DayShell key={date} date={date} today={today} className="is-future" title={`${date}: día futuro`}>
                <b>{dayNum}</b>
              </DayShell>
            );
          }
          const day = byDate.get(date);
          const pct = day?.closed && day.pct != null && Number.isFinite(day.pct) ? day.pct : null;
          if (pct == null) {
            return (
              <DayShell key={date} date={date} today={today} className="is-empty" title={`${date}: sin cierre`}>
                <b>{dayNum}</b>
              </DayShell>
            );
          }
          const shown = Math.round(pct);
          return (
            <DayShell key={date} date={date} today={today} className={adherenceTone(pct)} title={`${date}: ${shown}%`}>
              <b>{dayNum}</b>
              <small>{shown}%</small>
            </DayShell>
          );
        })}
      </div>
    </div>
  );
}

export function HabitMonthCalendar({
  month,
  today,
  habitLabel,
  marks,
  percents,
}: {
  month: string;
  today: string;
  habitLabel: string;
  marks: Map<string, string>;
  /** % diario de la API. Si viene, el día muestra el número (no ✓/✗). null = celda vacía. */
  percents?: Map<string, number | null>;
}) {
  return (
    <div className="wp-cal" aria-label={`Calendario de ${habitLabel}`}>
      <div className="wp-cal-grid wp-cal-dow" aria-hidden="true">
        {DOW.map((label) => <span key={label}>{label}</span>)}
      </div>
      <div className="wp-cal-grid">
        {monthGrid(month).map((date, index) => {
          if (!date) return <span key={`pad-${index}`} className="wp-cal-pad" />;
          const dayNum = String(Number(date.slice(8)));
          if (date > today) {
            return (
              <DayShell key={date} date={date} today={today} className="is-future" title={`${date}: día futuro`}>
                <b>{dayNum}</b>
              </DayShell>
            );
          }
          if (percents) {
            const pct = percents.has(date) ? percents.get(date) : null;
            const tone = macroCalendarTone(pct);
            if (tone == null || pct == null) {
              return (
                <DayShell key={date} date={date} today={today} className="is-empty" title={`${date}: sin datos`}>
                  <b>{dayNum}</b>
                </DayShell>
              );
            }
            const shown = macroCalendarLabel(pct);
            return (
              <DayShell key={date} date={date} today={today} className={tone} title={`${date}: ${shown}`}>
                <b>{dayNum}</b>
                <small>{shown}</small>
              </DayShell>
            );
          }
          const status = marks.get(date);
          const className = status === "met" ? "tone-high" : status === "missed" ? "tone-low" : status === "rest" ? "tone-rest" : "is-empty";
          const label = status === "met" ? "cumplido" : status === "missed" ? "no cumplido" : status === "rest" ? "descanso" : "sin registro";
          return (
            <DayShell key={date} date={date} today={today} className={className} title={`${date}: ${label}`}>
              <b>{dayNum}</b>
              <small>{status === "met" ? "✓" : status === "missed" ? "✗" : status === "rest" ? "D" : ""}</small>
            </DayShell>
          );
        })}
      </div>
    </div>
  );
}
