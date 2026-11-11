import { useEffect, useMemo, useState } from "react";
import { fetchStudentWeek, fetchWeeks } from "./api";
import {
  AdherenceLegend,
  AdherenceMonthCalendar,
  HabitLegend,
  HabitMonthCalendar,
  MonthNav,
} from "./adherenceCalendar";
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

const MACRO_Y_MAX: Record<MacroId, number> = {
  calories: 5000,
  protein: 300,
  fats: 150,
  carbs: 500,
};

const MACRO_Y_UNIT: Record<MacroId, string> = {
  calories: "kcal",
  protein: "g",
  fats: "g",
  carbs: "g",
};

const CHART_H = 140;

function weekdayTick(iso: string): string {
  const parsed = new Date(`${iso}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return iso.slice(8);
  return parsed.toLocaleDateString("es-CL", { weekday: "short", timeZone: "UTC" }).replace(".", "");
}

function formatAxisValue(value: number, unit: string): string {
  const rounded = Number.isInteger(value) ? String(value) : String(Math.round(value * 10) / 10);
  return `${rounded} ${unit}`;
}

export function canOpenInsights(role: string, specialty?: string): boolean {
  if (role === "admin") return true;
  return role === "professional" && (specialty === "coach" || specialty === "nutrition");
}

function monthLabel(month: string): string {
  const parsed = new Date(`${month}-01T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return month;
  const label = parsed.toLocaleDateString("es-CL", { month: "long", year: "numeric", timeZone: "UTC" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function shiftMonth(month: string, delta: number): string {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mon - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

function MacroChart({
  days,
  values,
  target,
  macro,
}: {
  days: { date: string }[];
  values: (number | null)[];
  target: number | null;
  macro: MacroId;
}) {
  const max = MACRO_Y_MAX[macro];
  const unit = MACRO_Y_UNIT[macro];
  const yPos = (value: number) => Math.max(0, Math.min(CHART_H, Math.round((value / max) * CHART_H)));
  const targetClipped = target == null || !Number.isFinite(target) ? null : Math.min(Math.max(target, 0), max);
  const targetBottom = targetClipped == null ? null : yPos(targetClipped);
  return (
    <div className="wp-insights-chart" aria-label={`${MACROS.find((item) => item.id === macro)?.label || macro} · eje Y en ${unit}`}>
      <div className="wp-insights-yaxis" aria-hidden="true" style={{ height: CHART_H }}>
        <span className="wp-insights-ytick wp-insights-ymax">{formatAxisValue(max, unit)}</span>
        {targetBottom != null ? (
          <span className="wp-insights-ytick wp-insights-ymeta" style={{ bottom: targetBottom }}>
            {formatAxisValue(target as number, unit)}
          </span>
        ) : null}
        <span className="wp-insights-ytick wp-insights-yzero">{formatAxisValue(0, unit)}</span>
      </div>
      <div className="wp-insights-plot" style={{ height: CHART_H }}>
        {targetBottom != null ? <i className="wp-insights-target" style={{ bottom: targetBottom }} /> : null}
        <div className="wp-insights-bars" aria-label={`Barras de ${macro}`}>
          {days.map((day, index) => {
            const value = values[index];
            if (value == null) {
              return <div key={day.date} className="wp-insights-bar-slot" title={`${day.date}: sin valor`} />;
            }
            const height = value <= 0 ? 0 : Math.max(3, yPos(Math.min(value, max)));
            return (
              <div key={day.date} className="wp-insights-bar-slot">
                {height > 0 ? <i style={{ height }} title={`${day.date}: ${value} ${unit}`} /> : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className="wp-insights-xaxis" aria-hidden="true">
        {days.map((day) => (
          <small key={day.date}>{weekdayTick(day.date)}</small>
        ))}
      </div>
    </div>
  );
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
              Adherencia consolidada de {monthLabel(month)} · {summary.above80} días &gt; 80% de {summary.closedDays} con cierre. La racha suma cierres con más de 80%. Un día ya vencido sin ese cierre la corta. Hoy, si sigue abierto, no la corta ni la alarga. Un día sin registro no entra como 0.
            </p>
          )}
          <h4>Adherencia diaria</h4>
          <MonthNav
            label={monthLabel(month)}
            onPrev={() => setMonth((value) => shiftMonth(value, -1))}
            onNext={() => setMonth((value) => shiftMonth(value, 1))}
          />
          <AdherenceMonthCalendar month={month} today={today} closures={closures} />
          <AdherenceLegend />
          <div className="wp-insights-filters" role="group" aria-label="Hábito del calendario">
            {HABITS.map((item) => (
              <button key={item.id} type="button" className="secondary" aria-pressed={habit === item.id} onClick={() => setHabit(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          {loading ? <p className="wp-insights-note">Cargando semanas del mes…</p> : null}
          {error ? <p className="wp-insights-note">{error}</p> : null}
          <HabitMonthCalendar
            month={month}
            today={today}
            habitLabel={HABITS.find((item) => item.id === habit)?.label || habit}
            marks={new Map([...habitMarks.entries()].filter(([key]) => key.startsWith(`${habit}:`)).map(([key, status]) => [key.slice(habit.length + 1), status]))}
          />
          <HabitLegend />
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
  return <MacroChart days={week.table.days} values={values} target={target} macro={macro} />;
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
          Adherencia consolidada de {monthLabel(month)} · {summary.above80} días &gt; 80% de {summary.closedDays} con cierre. La racha suma cierres con más de 80%. Un día ya vencido sin ese cierre la corta. Hoy, si sigue abierto, no la corta ni la alarga. Un día sin registro no entra como 0.
        </p>
      ) : (
        <p className="wp-insights-note">
          El perfil todavía no trae adherenceDaily. La racha y el consolidado quedan en blanco hasta que la API publique la serie. No se recalcula con los registros sueltos.
        </p>
      )}
      <h4>Adherencia diaria</h4>
      <MonthNav
        label={monthLabel(month)}
        onPrev={() => setMonth((value) => shiftMonth(value, -1))}
        onNext={() => setMonth((value) => shiftMonth(value, 1))}
      />
      <AdherenceMonthCalendar month={month} today={today} closures={closures} />
      <AdherenceLegend />
      <div className="wp-insights-filters" role="group" aria-label="Hábito del calendario">
        {HABITS.map((item) => (
          <button key={item.id} type="button" className="secondary" aria-pressed={habit === item.id} onClick={() => setHabit(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <HabitMonthCalendar
        month={month}
        today={today}
        habitLabel={HABITS.find((item) => item.id === habit)?.label || habit}
        marks={new Map([...marks.entries()].filter(([key]) => key.startsWith(`${habit}:`)).map(([key, status]) => [key.slice(habit.length + 1), status]))}
      />
      <HabitLegend />
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
      <MacroChart days={bars} values={bars.map((bar) => bar.value)} target={target} macro={macro} />
    </section>
  );
}
