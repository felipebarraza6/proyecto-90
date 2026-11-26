import { useEffect, useMemo, useState } from "react";
import { fetchStudentWeek, fetchWeeks } from "./api";
import {
  AdherenceLegend,
  AdherenceMonthCalendar,
  HabitLegend,
  HabitMonthCalendar,
  MacroPctLegend,
  MonthNav,
} from "./adherenceCalendar";
import {
  adherenceStreaks,
  monthAdherenceSummary,
  type ClosureDay,
} from "./insightsMath";
import {
  hasSeriesData,
  seriesFromNutritionLogs,
  seriesFromWeeks,
} from "./macroChartSeries";
import type { StudentWeekResponse, WeekOption } from "./types";

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
  // Con más de 10 días (p. ej. un mes completo) el gráfico pasa a modo denso:
  // una columna por día y etiquetas cada 5 días en el eje X.
  const dense = days.length > 10;
  const denseStyle = dense ? { gridTemplateColumns: `repeat(${days.length},minmax(0,1fr))` } : undefined;
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
        <div
          className={`wp-insights-bars${dense ? " is-dense" : ""}`}
          style={denseStyle}
          aria-label={`Barras de ${macro}`}
        >
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
      <div
        className={`wp-insights-xaxis${dense ? " is-dense" : ""}`}
        style={denseStyle}
        aria-hidden="true"
      >
        {days.map((day, index) =>
          !dense || index % 5 === 0 ? (
            <small key={day.date}>{dense ? day.date.slice(8) : weekdayTick(day.date)}</small>
          ) : (
            <small key={day.date}>{"\u00a0"}</small>
          ),
        )}
      </div>
    </div>
  );
}

function AdherenceStatCards({
  current,
  best,
  consolidated,
  consolidatedNote,
}: {
  current: string | number;
  best: string | number;
  consolidated: string;
  consolidatedNote: string;
}) {
  return (
    <div className="wp-insights-streaks">
      <article>
        <small>Racha actual</small>
        <strong>{current}</strong>
        <small>días seguidos ≥ 80%</small>
      </article>
      <article>
        <small>Mejor racha</small>
        <strong>{best}</strong>
        <small>en el historial</small>
      </article>
      <article>
        <small>Adherencia consolidada</small>
        <strong>{consolidated}</strong>
        <small>{consolidatedNote}</small>
      </article>
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [missingDaily, setMissingDaily] = useState(false);
  const [closures, setClosures] = useState<ClosureDay[]>([]);
  const [habitMarks, setHabitMarks] = useState<Map<string, string>>(new Map());
  const [weeksByStart, setWeeksByStart] = useState<Map<string, StudentWeekResponse>>(new Map());

  useEffect(() => {
    if (!open) return;
    const ac = new AbortController();
    setLoading(true);
    setError("");
    setMissingDaily(false);
    fetchWeeks(ac.signal)
      .then(async (list) => {
        const overlapping = weeksOverlapping(list.weeks || [], month);
        if (!overlapping.length) {
          setClosures([]);
          setHabitMarks(new Map());
          setWeeksByStart(new Map());
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
  const { series, target } = useMemo(
    () => seriesFromWeeks(month, macro, weeksByStart),
    [month, macro, weeksByStart],
  );
  const macroLabel = MACROS.find((item) => item.id === macro)?.label || macro;

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
          <AdherenceStatCards
            current={missingDaily ? "—" : streaks.current}
            best={missingDaily ? "—" : streaks.best}
            consolidated={missingDaily || summary.averagePct == null ? "—" : `${Math.round(summary.averagePct)}%`}
            consolidatedNote={
              missingDaily
                ? "sin serie diaria"
                : `${monthLabel(month)} · ${summary.above80} de ${summary.closedDays} ≥ 80%`
            }
          />
          {missingDaily ? (
            <p className="wp-insights-note">
              La ficha semanal no trae la fila de adherencia diaria. La racha y el consolidado no se calculan.
            </p>
          ) : null}
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
            {MACROS.map((item) => (
              <button key={item.id} type="button" className="secondary" aria-pressed={macro === item.id} onClick={() => setMacro(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <h4>Macro por día · {monthLabel(month)}</h4>
          {hasSeriesData(series) ? (
            <MacroChart days={series.days} values={series.values} target={target} macro={macro} />
          ) : (
            <p className="wp-insights-note">
              Sin datos de {macroLabel} en {monthLabel(month)}. Cambia el período para ver otro mes.
            </p>
          )}
        </>
      ) : null}
    </section>
  );
}

type LogRow = Record<string, unknown>;

export function StudentInsights({
  habitLogs,
  nutritionLogs,
  targets,
  today,
  adherenceDaily = [],
  macrosDaily,
}: {
  habitLogs: LogRow[];
  nutritionLogs: LogRow[];
  targets: { calories?: number | null; protein?: number | null; carbs?: number | null; fats?: number | null } | null;
  today: string;
  adherenceDaily?: { date?: string; pct?: number | null }[];
  /** undefined = API vieja (sin la clave). null en un día = sin datos, no 0 %. */
  macrosDaily?: { date?: string; pct?: number | null }[] | null;
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
  const macroPcts = useMemo(() => {
    const map = new Map<string, number | null>();
    for (const row of macrosDaily || []) {
      const date = String(row.date || "").slice(0, 10);
      if (!date) continue;
      const raw = row.pct;
      const pct = raw == null || !Number.isFinite(Number(raw)) ? null : Number(raw);
      map.set(date, pct);
    }
    return map;
  }, [macrosDaily]);
  const target = targets?.[macro] == null || !Number.isFinite(Number(targets?.[macro])) ? null : Number(targets?.[macro]);
  const series = useMemo(
    () => seriesFromNutritionLogs(month, macro, nutritionLogs),
    [month, macro, nutritionLogs],
  );
  const macroLabel = MACROS.find((item) => item.id === macro)?.label || macro;

  return (
    <section className="wp-insights">
      <div>
        <span className="eyebrow">INSIGHTS</span>
        <h3>Tu adherencia</h3>
      </div>
      <AdherenceStatCards
        current={hasSeries ? streaks.current : "—"}
        best={hasSeries ? streaks.best : "—"}
        consolidated={!hasSeries || summary.averagePct == null ? "—" : `${Math.round(summary.averagePct)}%`}
        consolidatedNote={
          hasSeries
            ? `${monthLabel(month)} · ${summary.above80} de ${summary.closedDays} ≥ 80%`
            : "sin serie diaria"
        }
      />
      {hasSeries ? null : (
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
        marks={habit === "macros" ? new Map() : new Map([...marks.entries()].filter(([key]) => key.startsWith(`${habit}:`)).map(([key, status]) => [key.slice(habit.length + 1), status]))}
        percents={habit === "macros" ? macroPcts : undefined}
      />
      {habit === "macros" && macrosDaily == null ? (
        <p className="wp-insights-note">
          El perfil todavía no trae macrosDaily. El calendario de macros queda vacío hasta que la API publique el % diario.
        </p>
      ) : null}
      {habit === "macros" ? <MacroPctLegend /> : <HabitLegend />}
      <div className="wp-insights-filters">
        {MACROS.map((item) => (
          <button key={item.id} type="button" className="secondary" aria-pressed={macro === item.id} onClick={() => setMacro(item.id)}>
            {item.label}
          </button>
        ))}
      </div>
      <h4>Macro por día · {monthLabel(month)}</h4>
      {hasSeriesData(series) ? (
        <MacroChart days={series.days} values={series.values} target={target} macro={macro} />
      ) : (
        <p className="wp-insights-note">
          Sin datos de {macroLabel} en {monthLabel(month)}. Cambia el período para ver otro mes.
        </p>
      )}
    </section>
  );
}
