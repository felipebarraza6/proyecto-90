import { PanelStatsProvider } from "./weekly-panel/PanelStatsContext";
import { PANEL_CONFIG_DEFAULTS } from "./weekly-panel/panelConfig";
import { AdherenceLegend, AdherenceMonthCalendar, HabitLegend, HabitMonthCalendar, MonthNav } from "./weekly-panel/adherenceCalendar";
import { StudentWeekTable } from "./weekly-panel/StudentWeekTable";
import type { PanelConfig, StudentWeekResponse } from "./weekly-panel/types";

const TODAY = "2026-11-07";

const week = {
  profile: { nutrition_targets: { changed_in_week: [] }, habit_plan: {}, weight: { initial: null, milestones: [], latest: null } },
  weekly: { pct: 98.5, color: "green", status: [] },
  training_progress: { done: 2, planned: 4, partial: true },
  table: {
    days: ["2026-11-02", "2026-11-03", "2026-11-04", "2026-11-05", "2026-11-06", "2026-11-07", "2026-11-08"].map((date, index) => ({
      date,
      weekday: index,
      state: index < 4 ? "closed" : index === 4 ? "due" : index === 5 ? "today" : "future",
    })),
    rows: [
      { key: "daily_total", cells: [99.5, 99.5, 98.7, 96.5, null, null, null].map((pct) => ({ pct, color: pct == null ? "neutral" : "green", label: pct == null ? "Sin cierre" : "Exigible" })) },
      { key: "training", cells: ["met", "rest", "met", "rest", "missing", "today", "future"].map((status) => ({ status, pct: null, label: status })) },
      { key: "water", goal_ml: 2000, cells: ["met", "met", "met", "met", "missing", "today", "future"].map((status) => ({ status, pct: null, label: status })) },
      { key: "macros", cells: ["met", "met", "met", "met", "missing", "today", "future"].map((status) => ({ status, pct: status === "met" ? 100 : null, label: status })) },
      { key: "calories", target: 3100, cells: [3132, 3098, 3028, 3172, null, null, null].map((value) => ({ value, pct: value == null ? null : Math.round((value / 3100) * 100), status: value == null ? "missing" : "met", in_range: value != null })) },
      { key: "protein", target: 163, cells: [183, 168, 189, 184, null, null, null].map((value) => ({ value, pct: value == null ? null : Math.round((value / 163) * 100), status: value == null ? "missing" : "met", in_range: true })) },
      { key: "carbs", target: 403, cells: [387, 397, 391, 336, null, null, null].map((value) => ({ value, pct: value == null ? null : Math.round((value / 403) * 100), status: value == null ? "missing" : "met", in_range: value == null ? null : value !== 336 })) },
      { key: "fats", target: 93, cells: [96, 88, 75, 118, null, null, null].map((value) => ({ value, pct: value == null ? null : Math.round((value / 93) * 100), status: value == null ? "missing" : "met", in_range: value === 88 || value === 96 })) },
    ],
  },
} as unknown as StudentWeekResponse;

const closures = [
  { date: "2026-11-01", pct: 82, closed: true },
  { date: "2026-11-02", pct: 100, closed: true },
  { date: "2026-11-03", pct: 100, closed: true },
  { date: "2026-11-04", pct: 99, closed: true },
  { date: "2026-11-05", pct: 97, closed: true },
];

const habitMarks = new Map<string, string>([
  ["2026-11-02", "met"],
  ["2026-11-03", "met"],
  ["2026-11-04", "met"],
  ["2026-11-05", "met"],
  ["2026-11-01", "met"],
]);

/** Pantalla local de evidencia. No es una ruta de producción. */
export function UxFixture() {
  return (
    <PanelStatsProvider config={PANEL_CONFIG_DEFAULTS as unknown as PanelConfig}>
      <main className="wp-page" style={{ padding: 12, maxWidth: 960, margin: "0 auto" }}>
        <p className="wp-insights-note">FIXTURE LOCAL · datos de ejemplo · no es producción · no son mediciones reales</p>
        <section className="wp-insights">
          <h3>Ver resumen</h3>
          <MonthNav label="noviembre de 2026" onPrev={() => undefined} onNext={() => undefined} />
          <AdherenceMonthCalendar month="2026-11" today={TODAY} closures={closures} />
          <AdherenceLegend />
          <HabitMonthCalendar month="2026-11" today={TODAY} habitLabel="Agua" marks={habitMarks} />
          <HabitLegend />
        </section>
        <section className="wp-weight-card" style={{ marginTop: 12 }}>
          <div className="wp-weight-cols">
            <div className="wp-weight-col"><dt>Inicial</dt><dd>150 kg<small>1/10 · perfil</small></dd></div>
            <div className="wp-weight-col"><dt>Día 30</dt><dd>143,9 kg<small>4/11 · hito</small></dd></div>
            <div className="wp-weight-col"><dt>Día 60</dt><dd>Pendiente<small>se registra el 29/11</small></dd></div>
            <div className="wp-weight-col"><dt>Día 90</dt><dd>Pendiente<small>se registra el 29/12</small></dd></div>
            <div className="wp-weight-col"><dt>Último</dt><dd>143,9 kg<small>4/11 · hito</small></dd></div>
          </div>
        </section>
        <StudentWeekTable data={week} />
      </main>
    </PanelStatsProvider>
  );
}
