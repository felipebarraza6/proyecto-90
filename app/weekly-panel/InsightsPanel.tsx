import { useEffect, useMemo, useState } from "react";
import { fetchStudentWeek, fetchWeeks } from "./api";
import {
  adherenceStreaks,
  monthAdherenceSummary,
  type ClosureDay,
} from "./insightsMath";
import type { MacroCell, StudentWeekResponse, TableRow, WeekOption } from "./types";

const HABITS = [
  { id: "water", label: "Agua" },
  { id: "macros", label: "Cumplimiento macros" },
  { id: "training", label: "Entrenamiento" },
] as const;

const MACROS = [
  { id: "calories", label: "Calorías" },
  { id: "protein", label: "Proteínas" },
  { id: "fats", label: "Grasas" },
  { id: "carbs", label: "Carbohidratos" },
] as const;

type HabitId = (typeof HABITS)[number]["id"];
type MacroId = (typeof MACROS)[number]["id"];

export function canOpenInsights(role: string, specialty?: string): boolean {
  if (role === "admin") return true;
  return role === "professional" && (specialty === "coach" || specialty === "nutrition");
}

function monthLabel(month: string): string {
  const parsed = new Date(`${month}-01T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return month;
  return parsed.toLocaleDateString("es-CL", { month: "long", year: "numeric", timeZone: "UTC" });
}

function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

function pctTone(pct: number): string {
  if (pct >= 90) return "mark-high";
  if (pct >= 80) return "mark-mid";
  return "mark-low";
}

function DailyAdherenceCalendar({
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
    <div className="wp-insights-cal" aria-label="Adherencia diaria del mes">
      {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((label) => (
        <span key={label}>{label}</span>
      ))}
      {monthGrid(month).map((date, index) => {
        if (!date) return <span key={`pad-ad-${index}`} />;
        if (date > today) return <span key={date} className="mark-empty">{date.slice(8)}</span>;
        const day = byDate.get(date);
        const pct = day?.closed && day.pct != null && Number.isFinite(day.pct) ? day.pct : null;
        if (pct == null) return <span key={date} className="mark-empty" title={`${date}: sin cierre`}>{date.slice(8)}</span>;
        const shown = Math.round(pct);
        return (
          <span key={date} className={pctTone(pct)} title={`${date}: ${shown}%`}>
            {shown}%
          </span>
        );
      })}
    </div>
  );
}

function MacroChart({
  days,
  values,
  target,
  macroLabel,
}: {
  days: { date: string }[];
  values: (number | null)[];
  target: number | null;
  macroLabel: string;
}) {
  const max = Math.max(target || 0, ...values.map((value) => value || 0), 1);
  const targetBottom = target == null ? null : Math.max(0, Math.round((target / max) * 110));
  return (
    <div>
      <p className="wp-insights-note">
        La línea es la meta{target == null ? " (sin objetivo en esta semana)" : `: ${target}`}. Las barras son el cierre de cada día. Un día sin valor no se dibuja como 0.
      </p>
      <div className="wp-insights-chart">
        {targetBottom != null ? <i className="wp-insights-target" style={{ bottom: targetBottom }} /> : null}
        <div className="wp-insights-bars" aria-label={`Barras de ${macroLabel}`}>
          {days.map((day, index) => {
            const value = values[index];
            const height = value == null ? 0 : Math.max(4, Math.round((value / max) * 110));
            return (
              <div key={day.date}>
                {value == null ? <small>—</small> : <i style={{ height }} title={`${day.date}: ${value}`} />}
                <small>{day.date.slice(8)}</small>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function monthGrid(month: string): (string | null)[] {
  const [year, mon] = month.split("-").map(Number);
  const first = new Date(Date.UTC(year, mon - 1, 1));
  const startPad = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(year, mon, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: startPad }, () => null);
  for (let day = 1; day <= days; day += 1) {
    cells.push(`${month}-${String(day).padStart(2, "0")}`);
  }
  return cells;
}

function weeksOverlapping(weeks: WeekOption[], month: string): WeekOption[] {
  const start = `${month}-01`;
  const [year, mon] = month.split("-").map(Number);
  const end = new Date(Date.UTC(year, mon, 0)).toISOString().slice(0, 10);
  return weeks.filter((week) => week.start <= end && week.end >= start);
}

function absorbWeek(
  week: StudentWeekResponse,
  closures: Map<string, ClosureDay>,
  habits: Map<string, string>,
) {
  const total = week.table.rows.find((row) => row.key === "daily_total");
  week.table.days.forEach((day, index) => {
    const cell = total?.cells[index] as { pct?: number | null } | undefined;
    const pct = cell?.pct == null || !Number.isFinite(Number(cell.pct)) ? null : Number(cell.pct);
    const future = day.state === "future" || day.state === "not_started" || day.state === "out_of_challenge";
    const closed = !future && pct != null;
    const prev = closures.get(day.date);
    if (!prev || closed) closures.set(day.date, { date: day.date, pct, closed });
    for (const habit of HABITS) {
      const row = week.table.rows.find((item) => item.key === habit.id);
      const status = String((row?.cells[index] as { status?: string } | undefined)?.status || "");
      if (status === "met" || status === "missed" || status === "rest") {
        habits.set(`${habit.id}:${day.date}`, status);
      }
    }
  });
}

export function StaffInsights({
  clientId,
  today,
}: {
  clientId: number;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(today.slice(0, 7));
  const [habit, setHabit] = useState<HabitId>("water");
  const [macro, setMacro] = useState<MacroId>("calories");
  const [weekStart, setWeekStart] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [missingDaily, setMissingDaily] = useState(false);
  const [closures, setClosures] = useState<ClosureDay[]>([]);
  const [habitMarks, setHabitMarks] = useState<Map<string, string>>(new Map());
  const [weeksByStart, setWeeksByStart] = useState<Map<string, StudentWeekResponse>>(new Map());
  const [weekChoices, setWeekChoices] = useState<WeekOption[]>([]);

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    setLoading(true);
    setError("");
    setMissingDaily(false);
    fetchWeeks(ac.signal)
      .then(async (list) => {
        const overlapping = weeksOverlapping(list.weeks || [], month);
        setWeekChoices(overlapping);
        if (!overlapping.length) {
          setClosures([]);
          setHabitMarks(new Map());
          setWeeksByStart(new Map());
          setWeekStart("");
          return;
        }
        const payloads = await Promise.all(
          overlapping.map((week) => fetchStudentWeek(clientId, week.start, ac.signal)),
        );
        const closureMap = new Map<string, ClosureDay>();
        const marks = new Map<string, string>();
        const byStart = new Map<string, StudentWeekResponse>();
        payloads.forEach((payload, index) => {
          const start = overlapping[index].start;
          byStart.set(start, payload);
          absorbWeek(payload, closureMap, marks);
        });
        setMissingDaily(!payloads.some((payload) => payload.table.rows.some((row) => row.key === "daily_total")));
        setClosures([...closureMap.values()]);
        setHabitMarks(marks);
        setWeeksByStart(byStart);
        setWeekStart((current) => (byStart.has(current) ? current : overlapping[overlapping.length - 1].start));
      })
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "No fue posible cargar el historial");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [open, month, clientId]);

  const streaks = useMemo(() => adherenceStreaks(closures, today), [closures, today]);
  const summary = useMemo(() => monthAdherenceSummary(closures, month, today), [closures, month, today]);
  const chartWeek = weeksByStart.get(weekStart) || null;

  return (
    <section className="wp-insights">
      <div className="wp-insights-head">
        <div>
          <span className="eyebrow">INSIGHTS</span>
          <h3>Adherencia del alumno</h3>
        </div>
        <button type="button" className="secondary" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
          {open ? "Ocultar resumen" : "Ver resumen"}
        </button>
      </div>
      {open ? (
        <>
          <div className="wp-insights-streaks">
            <article>
              <small>Racha actual</small>
              <strong>{missingDaily ? "—" : streaks.current}</strong>
              <small>días seguidos con cierre &gt; 80%</small>
            </article>
            <article>
              <small>Mejor racha</small>
              <strong>{missingDaily ? "—" : streaks.best}</strong>
              <small>en el historial cargado</small>
            </article>
          </div>
          {missingDaily ? (
            <p className="wp-insights-note">
              La ficha semanal no trae la fila de adherencia diaria. La racha y el consolidado no se calculan.
            </p>
          ) : (
            <p className="wp-insights-summary">
              <strong>{summary.averagePct == null ? "—" : `${Math.round(summary.averagePct)}%`}</strong>
              Adherencia consolidada de {monthLabel(month)} · {summary.above80} días &gt; 80% de {summary.closedDays} con cierre. Los días sin registro no entran como 0. 80% exacto no suma racha.
            </p>
          )}
          <h4>Adherencia diaria</h4>
          <DailyAdherenceCalendar month={month} today={today} closures={closures} />
          <div className="wp-insights-filters">
            <button type="button" className="secondary" onClick={() => setMonth((value) => shiftMonth(value, -1))}>
              Mes anterior
            </button>
            <b>{monthLabel(month)}</b>
            <button type="button" className="secondary" onClick={() => setMonth((value) => shiftMonth(value, 1))}>
              Mes siguiente
            </button>
            {HABITS.map((item) => (
              <button key={item.id} type="button" className="secondary" aria-pressed={habit === item.id} onClick={() => setHabit(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          {loading ? <p className="wp-insights-note">Cargando semanas del mes…</p> : null}
          {error ? <p className="wp-insights-note">{error}</p> : null}
          <div className="wp-insights-cal" aria-label={`Calendario de ${habit}`}>
            {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((label) => (
              <span key={label}>{label}</span>
            ))}
            {monthGrid(month).map((date, index) => {
              if (!date) return <span key={`pad-${index}`} />;
              if (date > today) return <span key={date} className="mark-empty">{date.slice(8)}</span>;
              const status = habitMarks.get(`${habit}:${date}`);
              const className = status === "met" ? "mark-met" : status === "missed" ? "mark-missed" : "mark-empty";
              const label = status === "met" ? "cumplido" : status === "missed" ? "no cumplido" : status === "rest" ? "descanso" : "sin registro";
              return (
                <span key={date} className={className} title={`${date}: ${label}`}>
                  {date.slice(8)}
                </span>
              );
            })}
          </div>
          <div className="wp-insights-filters">
            <label>
              Semana del gráfico
              <select value={weekStart} onChange={(event) => setWeekStart(event.target.value)}>
                {weekChoices.map((week) => (
                  <option key={week.start} value={week.start}>
                    {week.label || week.start}
                  </option>
                ))}
              </select>
            </label>
            {MACROS.map((item) => (
              <button key={item.id} type="button" className="secondary" aria-pressed={macro === item.id} onClick={() => setMacro(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <MacroBars week={chartWeek} macro={macro} />
        </>
      ) : null}
    </section>
  );
}

function MacroBars({ week, macro }: { week: StudentWeekResponse | null; macro: MacroId }) {
  if (!week) return <p className="wp-insights-note">Elige una semana cargada para ver el gráfico.</p>;
  const row = week.table.rows.find((item): item is Extract<TableRow, { key: MacroId }> => item.key === macro);
  if (!row) {
    return <p className="wp-insights-note">Esta semana no trae la serie de {macro}. No se dibujan barras inventadas.</p>;
  }
  const target = row.target == null || !Number.isFinite(Number(row.target)) ? null : Number(row.target);
  const values = row.cells.map((cell) => {
    const value = (cell as MacroCell).value;
    return value == null || !Number.isFinite(Number(value)) ? null : Number(value);
  });
  return <MacroChart days={week.table.days} values={values} target={target} macroLabel={macro} />;
}

type LogRow = Record<string, unknown>;

export function StudentInsights({
  habitLogs,
  nutritionLogs,
  targets,
  today,
  adherenceDaily = [],
}: {
  habitLogs: LogRow[];
  nutritionLogs: LogRow[];
  targets: { calories?: number | null; protein?: number | null; carbs?: number | null; fats?: number | null } | null;
  today: string;
  adherenceDaily?: { date?: string; pct?: number | null }[];
}) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const [habit, setHabit] = useState<HabitId>("water");
  const [macro, setMacro] = useState<MacroId>("calories");
  const marks = useMemo(() => {
    const map = new Map<string, string>();
    for (const row of habitLogs) {
      const date = String(row.habit_date || "").slice(0, 10);
      const id = String(row.habit || "");
      const status = String(row.status || "");
      if (!date || (id !== "water" && id !== "macros" && id !== "training")) continue;
      if (status === "met" || status === "missed" || status === "rest") map.set(`${id}:${date}`, status);
    }
    return map;
  }, [habitLogs]);
  const weekStarts = useMemo(() => {
    const [year, mon] = month.split("-").map(Number);
    const last = new Date(Date.UTC(year, mon, 0)).getUTCDate();
    const starts: string[] = [];
    for (let day = 1; day <= last; day += 1) {
      const date = new Date(Date.UTC(year, mon - 1, day));
      if (date.getUTCDay() === 1) starts.push(date.toISOString().slice(0, 10));
    }
    return starts;
  }, [month]);
  const [weekStart, setWeekStart] = useState(weekStarts[0] || "");
  useEffect(() => {
    setWeekStart(weekStarts[0] || "");
  }, [weekStarts]);
  const closures = useMemo<ClosureDay[]>(
    () =>
      adherenceDaily
        .map((row) => {
          const date = String(row.date || "").slice(0, 10);
          const pct = row.pct == null || !Number.isFinite(Number(row.pct)) ? null : Number(row.pct);
          return { date, pct, closed: pct != null };
        })
        .filter((row) => row.date),
    [adherenceDaily],
  );
  const streaks = useMemo(() => adherenceStreaks(closures, today), [closures, today]);
  const summary = useMemo(() => monthAdherenceSummary(closures, month, today), [closures, month, today]);
  const hasSeries = adherenceDaily.length > 0;
  const nutrition = useMemo(
    () => new Map(nutritionLogs.map((row) => [String(row.log_date || "").slice(0, 10), row])),
    [nutritionLogs],
  );
  const target = targets?.[macro] == null || !Number.isFinite(Number(targets?.[macro])) ? null : Number(targets?.[macro]);
  const bars = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(Date.parse(`${weekStart || today}T12:00:00Z`) + index * 86400000).toISOString().slice(0, 10);
    const row = nutrition.get(date);
    const raw = row ? Number(row[macro]) : null;
    const value = row && Number.isFinite(raw) ? raw : null;
    return { date, value };
  });

  return (
    <section className="wp-insights">
      <div>
        <span className="eyebrow">INSIGHTS</span>
        <h3>Tu adherencia</h3>
      </div>
      <div className="wp-insights-streaks">
        <article>
          <small>Racha actual</small>
          <strong>{hasSeries ? streaks.current : "—"}</strong>
          <small>días seguidos con cierre &gt; 80%</small>
        </article>
        <article>
          <small>Mejor racha</small>
          <strong>{hasSeries ? streaks.best : "—"}</strong>
          <small>en la serie diaria</small>
        </article>
      </div>
      {hasSeries ? (
        <p className="wp-insights-summary">
          <strong>{summary.averagePct == null ? "—" : `${Math.round(summary.averagePct)}%`}</strong>
          Adherencia consolidada de {monthLabel(month)} · {summary.above80} días &gt; 80% de {summary.closedDays} con cierre. 80% exacto no suma racha.
        </p>
      ) : (
        <p className="wp-insights-note">
          El perfil todavía no trae adherenceDaily. La racha y el consolidado quedan en blanco hasta que la API publique la serie. No se recalcula con los registros sueltos.
        </p>
      )}
      <h4>Adherencia diaria</h4>
      <DailyAdherenceCalendar month={month} today={today} closures={closures} />
      <div className="wp-insights-filters">
        <button type="button" className="secondary" onClick={() => setMonth((value) => shiftMonth(value, -1))}>Mes anterior</button>
        <b>{monthLabel(month)}</b>
        <button type="button" className="secondary" onClick={() => setMonth((value) => shiftMonth(value, 1))}>Mes siguiente</button>
        {HABITS.map((item) => (
          <button key={item.id} type="button" className="secondary" aria-pressed={habit === item.id} onClick={() => setHabit(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <div className="wp-insights-cal" aria-label={`Calendario de ${habit}`}>
        {["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"].map((label) => (
          <span key={label}>{label}</span>
        ))}
        {monthGrid(month).map((date, index) => {
          if (!date) return <span key={`pad-${index}`} />;
          if (date > today) return <span key={date} className="mark-empty">{date.slice(8)}</span>;
          const status = marks.get(`${habit}:${date}`);
          const className = status === "met" ? "mark-met" : status === "missed" ? "mark-missed" : "mark-empty";
          return <span key={date} className={className}>{date.slice(8)}</span>;
        })}
      </div>
      <div className="wp-insights-filters">
        <label>
          Semana
          <select value={weekStart} onChange={(event) => setWeekStart(event.target.value)}>
            {weekStarts.map((start) => (
              <option key={start} value={start}>{start}</option>
            ))}
          </select>
        </label>
        {MACROS.map((item) => (
          <button key={item.id} type="button" className="secondary" aria-pressed={macro === item.id} onClick={() => setMacro(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <MacroChart days={bars} values={bars.map((bar) => bar.value)} target={target} macroLabel={macro} />
    </section>
  );
}
