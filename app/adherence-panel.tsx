"use client";

import { useMemo, useState } from "react";
import {
  buildEffectiveRecords,
  chileToday,
  computeAdherenceAlerts,
  mondayOf,
  type Row,
} from "./adherence-alerts";
import { WeeklyTeamPanel } from "./weekly-team-panel";

type Act = (payload: Row) => Promise<unknown>;
type AlertFilter = "all" | "risk" | "missing";
type Mode = "full" | "training" | "macros";

const habits = {
  training: { label: "Entrenamientos", icon: "↗" },
  macros: { label: "Macros", icon: "◒" },
  water: { label: "Consumo de agua", icon: "◉" },
} as const;

const dayNames = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const iso = (date: Date) => date.toISOString().slice(0, 10);
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
const weekLabel = (offset: number, start: Date) =>
  `${offset === 0 ? "Semana actual" : offset === 1 ? "Semana anterior" : `Hace ${offset} semanas`} · ${start.toLocaleDateString("es-CL", { day: "numeric", month: "short", timeZone: "UTC" })}–${addDays(start, 6).toLocaleDateString("es-CL", { day: "numeric", month: "short", timeZone: "UTC" })}`;
const nameOf = (row: Row) =>
  `${row.first_name || ""} ${row.last_name || ""}`.trim() || String(row.email || "Alumno");

const modeCopy: Record<Mode, { title: string; copy: string; habits: (keyof typeof habits)[] }> = {
  full: {
    title: "Alertas locales de adherencia",
    copy: "Seguimiento basado en registros de /api/app. Sus reglas de 3 incumplimientos y 48 horas son distintas a las alertas del panel semanal del backend.",
    habits: ["training", "macros", "water"],
  },
  training: {
    title: "Alertas locales de entrenamiento",
    copy: "Seguimiento basado en registros de /api/app; conserva sus reglas locales y es independiente del panel semanal del backend.",
    habits: ["training"],
  },
  macros: {
    title: "Alertas locales de macros",
    copy: "Seguimiento basado en registros de /api/app; conserva sus reglas locales y es independiente del panel semanal del backend.",
    habits: ["macros"],
  },
};

export function AdherencePanel({
  people,
  records,
  nutritionRecords,
  outreach,
  act,
  mode = "full",
  canEditCells = true,
  canMarkContact = true,
}: {
  people: Row[];
  records: Row[];
  nutritionRecords: Row[];
  outreach: Row[];
  act: Act;
  mode?: Mode;
  canEditCells?: boolean;
  canMarkContact?: boolean;
}) {
  const config = modeCopy[mode];
  const defaultHabit = config.habits[0];
  const [habit, setHabit] = useState<keyof typeof habits>(defaultHabit);
  const [weekOffset, setWeekOffset] = useState(0);
  const [alertFilter, setAlertFilter] = useState<AlertFilter>("all");
  const today = chileToday();
  const currentMonday = useMemo(() => mondayOf(new Date(`${today}T12:00:00Z`)), [today]);
  const weekStart = useMemo(() => addDays(currentMonday, -weekOffset * 7), [currentMonday, weekOffset]);
  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDays(weekStart, index)), [weekStart]);
  const alertHabits = (mode === "full" ? ["training", "macros"] : config.habits.filter((h) => h !== "water")) as (
    | "training"
    | "macros"
  )[];
  const alertKey = alertHabits.join("|");
  const alerts = useMemo(
    () =>
      computeAdherenceAlerts(
        people,
        records,
        nutritionRecords,
        alertKey.split("|").filter(Boolean) as ("training" | "macros")[],
      ),
    [people, records, nutritionRecords, alertKey],
  );
  const effectiveRecords = useMemo(
    () => buildEffectiveRecords(people, records, nutritionRecords),
    [people, records, nutritionRecords],
  );
  const lookup = useMemo(
    () => new Map(effectiveRecords.map((row) => [`${row.user_id}:${row.habit}:${row.habit_date}`, String(row.status)])),
    [effectiveRecords],
  );
  const outreachLookup = useMemo(
    () => new Map(outreach.map((row) => [`${row.user_id}:${row.week_start}:${row.alert_type}`, Boolean(row.contacted)])),
    [outreach],
  );
  const currentWeekIso = iso(currentMonday);
  const alertsAvailable = weekOffset === 0;
  const riskReasons = alerts.riskReasons;
  const missingReasons = alerts.missingReasons;
  const visible = people.filter(
    (person) =>
      alertFilter === "all" ||
      (alertFilter === "risk" ? riskReasons : missingReasons).has(String(person.id)),
  );
  const completed = visible.reduce(
    (total, person) =>
      total + days.filter((day) => lookup.get(`${person.id}:${habit}:${iso(day)}`) === "met").length,
    0,
  );
  const missed = visible.reduce(
    (total, person) =>
      total + days.filter((day) => lookup.get(`${person.id}:${habit}:${iso(day)}`) === "missed").length,
    0,
  );

  async function cycle(userId: string, date: string) {
    if (!canEditCells || habit === "macros") return;
    const current = lookup.get(`${userId}:${habit}:${date}`);
    await act({
      action: "adherence.set",
      userId,
      habit,
      date,
      status: current === "met" ? "missed" : current === "missed" ? "" : "met",
    });
  }

  async function setContacted(userId: string, alertType: "risk" | "missing") {
    if (!canMarkContact) return;
    const key = `${userId}:${currentWeekIso}:${alertType}`;
    await act({
      action: "adherence.contact.set",
      userId,
      weekStart: currentWeekIso,
      alertType,
      contacted: !outreachLookup.get(key),
    });
  }

  function changeWeek(offset: number) {
    setWeekOffset(offset);
    setAlertFilter("all");
  }

  return (
    <div className="adherence-panel">
      <WeeklyTeamPanel />
      <div className="admin-title">
        <div>
          <span className="eyebrow">SEGUIMIENTO SEMANAL · PROYECTO 90</span>
          <h1>{config.title}</h1>
          <p>{config.copy}</p>
        </div>
        <span className="integration-pill">● Alertas locales</span>
      </div>
      <section className="adherence-controls">
        <div className="habit-tabs">
          {config.habits.map((key) => (
            <button key={key} className={habit === key ? "active" : ""} onClick={() => setHabit(key)}>
              <i>{habits[key].icon}</i>
              <span>{habits[key].label}</span>
            </button>
          ))}
        </div>
        <div className="adherence-selectors">
          <label>
            Semana
            <select value={weekOffset} onChange={(e) => changeWeek(Number(e.target.value))}>
              {Array.from({ length: 13 }, (_, offset) => {
                const optionStart = addDays(currentMonday, -offset * 7);
                return (
                  <option value={offset} key={offset}>
                    {weekLabel(offset, optionStart)}
                  </option>
                );
              })}
            </select>
          </label>
          <div className="alert-filters">
            <button className={alertFilter === "all" ? "active" : ""} onClick={() => setAlertFilter("all")}>
              Todos <b>{people.length}</b>
            </button>
            <button
              className={`risk ${alertFilter === "risk" ? "active" : ""}`}
              disabled={!alertsAvailable}
              onClick={() => setAlertFilter("risk")}
            >
              ! En riesgo <b>{riskReasons.size}</b>
            </button>
            <button
              className={`missing ${alertFilter === "missing" ? "active" : ""}`}
              disabled={!alertsAvailable}
              onClick={() => setAlertFilter("missing")}
            >
              ◷ Falta reportar <b>{missingReasons.size}</b>
            </button>
          </div>
        </div>
      </section>
      {!alertsAvailable && (
        <p className="alert-scope-note">
          Las alertas “En riesgo” y “Falta reportar” se calculan únicamente en la semana que está transcurriendo.
        </p>
      )}
      <section className="adherence-summary">
        <article>
          <small>Hábito seleccionado</small>
          <b>{habits[habit].label}</b>
          <span>{weekLabel(weekOffset, days[0])}</span>
        </article>
        <article className="met">
          <small>Cumplimientos registrados</small>
          <b>{completed}</b>
          <span>Marcados en verde</span>
        </article>
        <article className="missed">
          <small>Incumplimientos registrados</small>
          <b>{missed}</b>
          <span>Marcados en rojo</span>
        </article>
        <article className="risk">
          <small>Alertas esta semana</small>
          <b>{alertsAvailable ? riskReasons.size + missingReasons.size : 0}</b>
          <span>
            {riskReasons.size} en riesgo · {missingReasons.size} sin reporte
          </span>
        </article>
      </section>
      <div className="adherence-matrix-wrap">
        <table className="adherence-matrix">
          <thead>
            <tr>
              <th>Participante</th>
              {days.map((day, index) => (
                <th key={iso(day)}>
                  <b>{dayNames[index]}</b>
                  <small>{day.getUTCDate()}</small>
                </th>
              ))}
              <th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((person) => {
              const id = String(person.id);
              const risk = riskReasons.get(id) || [];
              const missing = missingReasons.get(id) || [];
              const selectedReasons = alertFilter === "risk" ? risk : missing;
              const selectedType = alertFilter === "risk" ? "risk" : "missing";
              const contacted =
                alertFilter !== "all" && outreachLookup.get(`${id}:${currentWeekIso}:${selectedType}`);
              return (
                <tr key={id} className={risk.length ? "risk-row" : missing.length ? "missing-row" : ""}>
                  <td>
                    <b>{nameOf(person)}</b>
                    <small>{String(person.email || "")}</small>
                  </td>
                  {days.map((day) => {
                    const date = iso(day);
                    const status = lookup.get(`${id}:${habit}:${date}`) || "empty";
                    return (
                      <td key={date}>
                        <button
                          disabled={!canEditCells || habit === "macros"}
                          title={
                            habit === "macros"
                              ? "Calculado desde calorías y proteínas"
                              : canEditCells
                                ? "Clic: cumplido → no cumplido → sin registro"
                                : "Solo lectura"
                          }
                          className={`habit-cell ${status}`}
                          onClick={() => cycle(id, date)}
                        >
                          {status === "met" ? "✓" : status === "missed" ? "×" : "·"}
                        </button>
                      </td>
                    );
                  })}
                  <td>
                    <div className="status-stack">
                      {alertFilter === "all" ? (
                        <>
                          {risk.length > 0 && <span className="risk-label">En riesgo: {risk.join(" y ")}</span>}
                          {missing.length > 0 && (
                            <span className="missing-label">Falta reportar: {missing.join(" y ")}</span>
                          )}
                          {!risk.length && !missing.length && <span className="stable-label">Sin alerta</span>}
                        </>
                      ) : (
                        <>
                          <span className={alertFilter === "risk" ? "risk-label" : "missing-label"}>
                            {alertFilter === "risk" ? "En riesgo" : "Falta reportar"}: {selectedReasons.join(" y ")}
                          </span>
                          {canMarkContact && (
                            <label className="contact-check">
                              <input
                                type="checkbox"
                                checked={Boolean(contacted)}
                                onChange={() => setContacted(id, selectedType)}
                              />
                              <span>{contacted ? "Contactado" : "Marcar contactado"}</span>
                            </label>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={9} className="matrix-empty">
                  {alertFilter === "risk"
                    ? `No hay participantes con tres incumplimientos consecutivos en ${mode === "macros" ? "macros" : mode === "training" ? "entrenamiento" : "entrenamiento o macros"} esta semana.`
                    : alertFilter === "missing"
                      ? "No hay participantes con reportes pendientes por más de 48 horas."
                      : "No hay participantes registrados."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="adherence-footnote">
        “En riesgo” considera 3 días cerrados consecutivos en rojo. “Falta reportar” detecta registros vacíos con al
        menos 48 horas. Agua no genera alertas de riesgo.
      </p>
    </div>
  );
}
