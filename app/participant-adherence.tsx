"use client";

import { useEffect, useMemo, useState } from "react";
import {
  challengeWeeks,
  macrosDayStatus,
  PANEL_CONFIG_DEFAULTS,
  type MacroKey,
} from "./weekly-panel/panelConfig";
import type { PanelConfig } from "./weekly-panel/types";

type Row = Record<string, unknown>;
const habits = {
  training: { label: "Entrenamiento", icon: "↗" },
  macros: { label: "Macros", icon: "◒" },
  water: { label: "Consumo de agua", icon: "◉" },
} as const;
const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
const iso = (date: Date) => date.toISOString().slice(0, 10);
const chileToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const dateAt = (value: unknown) =>
  new Date(`${String(value || new Date().toISOString()).slice(0, 10)}T12:00:00Z`);
const initialWeek = (start: Date, weeks = challengeWeeks()) =>
  Math.max(1, Math.min(weeks, Math.floor((Date.now() - start.getTime()) / (7 * 86400000)) + 1));

type HabitStatus = "met" | "missed" | "rest" | "empty";

export function ParticipantHabitMatrix({
  records,
  nutritionRecords,
  plan,
  startDate,
  act,
  panelConfig,
}: {
  records: Row[];
  nutritionRecords: Row[];
  plan?: Row | null;
  startDate: unknown;
  act: (payload: Row) => Promise<unknown>;
  panelConfig?: PanelConfig | null;
}) {
  const start = useMemo(() => dateAt(startDate), [startDate]);
  const weeks = challengeWeeks(panelConfig);
  const challengeLen =
    panelConfig?.challenge_length_days ?? PANEL_CONFIG_DEFAULTS.challenge_length_days;
  const [week, setWeek] = useState(() => initialWeek(start, weeks));
  useEffect(() => {
    setWeek(initialWeek(start, weeks));
  }, [start, weeks]);
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => addDays(start, (week - 1) * 7 + index)).filter(
        (day) => day < addDays(start, challengeLen),
      ),
    [start, week, challengeLen],
  );
  const lookup = useMemo(
    () => new Map(records.map((row) => [`${row.habit}:${row.habit_date}`, String(row.status)])),
    [records],
  );
  const nutrition = useMemo(
    () => new Map(nutritionRecords.map((row) => [String(row.log_date), row])),
    [nutritionRecords],
  );
  const allowRest = Boolean(panelConfig?.allow_student_rest);
  const macroConfig = panelConfig || {
    macro_met_requires: PANEL_CONFIG_DEFAULTS.macro_met_requires,
    macro_ranges: PANEL_CONFIG_DEFAULTS.macro_ranges,
    calories_min_enabled: PANEL_CONFIG_DEFAULTS.calories_min_enabled,
    calories_low_ratio: PANEL_CONFIG_DEFAULTS.calories_low_ratio,
  };

  function statusFor(habit: keyof typeof habits, date: string): HabitStatus {
    if (habit !== "macros") {
      const raw = lookup.get(`${habit}:${date}`) || "empty";
      if (raw === "met" || raw === "missed" || raw === "rest") return raw;
      return "empty";
    }
    const row = nutrition.get(date);
    const targets: Partial<Record<MacroKey, number>> = {
      calories: Number(plan?.calories || 0),
      protein: Number(plan?.protein || 0),
      carbs: Number(plan?.carbs || 0),
      fats: Number(plan?.fats || 0),
    };
    const values: Partial<Record<MacroKey, number>> = {
      calories: Number(row?.calories || 0),
      protein: Number(row?.protein || 0),
      carbs: Number(row?.carbs || 0),
      fats: Number(row?.fats || 0),
    };
    if (!row) return "empty";
    return macrosDayStatus(values, targets, macroConfig);
  }

  async function setStatus(
    habit: "training" | "water",
    date: string,
    status: "met" | "missed" | "rest",
  ) {
    const current = statusFor(habit, date);
    await act({
      action: "habit.self.set",
      habit,
      date,
      status: current === status ? "" : status,
    });
  }

  const restHint = allowRest
    ? "En entreno también puedes marcar D (descanso) si tu coach lo habilita."
    : "Vacío significa que todavía no registras ese día.";

  return (
    <section className="participant-habit-panel">
      <header>
        <div>
          <span className="eyebrow">REGISTRO PROPIO · PROYECTO 90</span>
          <h2>Mi adherencia semanal</h2>
          <p>
            Elige ✓ si cumpliste o × si no cumpliste. {restHint}
          </p>
        </div>
        <label>
          Semana
          <select value={week} onChange={(event) => setWeek(Number(event.target.value))}>
            {Array.from({ length: weeks }, (_, index) => (
              <option value={index + 1} key={index}>
                Semana {index + 1}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="participant-matrix-wrap">
        <table className="participant-matrix">
          <thead>
            <tr>
              <th>Seguimiento</th>
              {days.map((day) => (
                <th key={iso(day)}>
                  <b>{dayNames[day.getUTCDay()]}</b>
                  <small>
                    {day.toLocaleDateString("es-CL", {
                      day: "2-digit",
                      month: "2-digit",
                      timeZone: "UTC",
                    })}
                  </small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["training", "macros", "water"] as const).map((habit) => (
              <tr key={habit}>
                <td>
                  <i>{habits[habit].icon}</i>
                  <b>{habits[habit].label}</b>
                </td>
                {days.map((day) => {
                  const date = iso(day);
                  const status = statusFor(habit, date);
                  const disabled = date > chileToday();
                  if (habit === "macros") {
                    return (
                      <td key={date}>
                        <span
                          className={`participant-habit-cell ${status}`}
                          aria-label={
                            status === "met"
                              ? "Cumplido"
                              : status === "missed"
                                ? "No cumplido"
                                : "Sin registro"
                          }
                        >
                          {status === "met" ? "✓" : status === "missed" ? "×" : ""}
                        </span>
                      </td>
                    );
                  }
                  const showRest = habit === "training" && allowRest;
                  return (
                    <td key={date}>
                      <div
                        className={`habit-choice ${showRest ? "with-rest" : ""} ${status} ${disabled ? "disabled" : ""}`}
                      >
                        <button
                          type="button"
                          disabled={disabled}
                          className={status === "met" ? "selected" : ""}
                          onClick={() => setStatus(habit, date, "met")}
                          aria-label={`Marcar ${habits[habit].label} como cumplido`}
                        >
                          ✓
                        </button>
                        <button
                          type="button"
                          disabled={disabled}
                          className={status === "missed" ? "selected" : ""}
                          onClick={() => setStatus(habit, date, "missed")}
                          aria-label={`Marcar ${habits[habit].label} como no cumplido`}
                        >
                          ×
                        </button>
                        {showRest ? (
                          <button
                            type="button"
                            disabled={disabled}
                            className={status === "rest" ? "selected" : ""}
                            onClick={() => setStatus(habit, date, "rest")}
                            aria-label="Marcar entrenamiento como descanso"
                            title="Descanso"
                          >
                            D
                          </button>
                        ) : null}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function TrainingDailyReview({ records, person, panelConfig }: { records: Row[]; person: Row; panelConfig?: PanelConfig | null }) {
  const start = useMemo(
    () => dateAt(person.challenge_start || person.assigned_at || person.created_at),
    [person.challenge_start, person.assigned_at, person.created_at],
  );
  const weeks = challengeWeeks(panelConfig);
  const challengeLen =
    panelConfig?.challenge_length_days ?? PANEL_CONFIG_DEFAULTS.challenge_length_days;
  const [week, setWeek] = useState(() => initialWeek(start, weeks));
  useEffect(() => {
    setWeek(initialWeek(start, weeks));
  }, [start, weeks]);
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => addDays(start, (week - 1) * 7 + index)).filter(
        (day) => day < addDays(start, challengeLen),
      ),
    [start, week, challengeLen],
  );
  const own = new Map(
    records
      .filter((row) => String(row.user_id) === String(person.id) && row.habit === "training")
      .map((row) => [String(row.habit_date), String(row.status)]),
  );
  const met = days.filter((day) => own.get(iso(day)) === "met").length;
  const missed = days.filter((day) => own.get(iso(day)) === "missed").length;
  const rest = days.filter((day) => own.get(iso(day)) === "rest").length;

  return (
    <section className="professional-file-section training-review">
      <div className="professional-file-heading">
        <div>
          <span className="eyebrow">SEGUIMIENTO DEL ALUMNO</span>
          <h3>Entrenamientos registrados</h3>
          <p>Vacío significa sin registrar; ✓ cumplido, × no cumplido y D descanso.</p>
        </div>
        <label>
          Semana
          <select value={week} onChange={(event) => setWeek(Number(event.target.value))}>
            {Array.from({ length: weeks }, (_, index) => (
              <option value={index + 1} key={index}>
                Semana {index + 1}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="tracking-summary">
        <span>
          <small>Cumplidos</small>
          <b className="green-text">{met}</b>
        </span>
        <span>
          <small>No cumplidos</small>
          <b className="red-text">{missed}</b>
        </span>
        <span>
          <small>Descanso</small>
          <b>{rest}</b>
        </span>
        <span>
          <small>Sin registrar</small>
          <b>{days.length - met - missed - rest}</b>
        </span>
      </div>
      <div className="training-review-grid">
        {days.map((day) => {
          const status = own.get(iso(day)) || "empty";
          return (
            <article className={status} key={iso(day)}>
              <small>{dayNames[day.getUTCDay()]}</small>
              <b>
                {day.toLocaleDateString("es-CL", {
                  day: "2-digit",
                  month: "2-digit",
                  timeZone: "UTC",
                })}
              </b>
              <strong>
                {status === "met" ? "✓" : status === "missed" ? "×" : status === "rest" ? "D" : "·"}
              </strong>
              <span>
                {status === "met"
                  ? "Cumplido"
                  : status === "missed"
                    ? "No cumplido"
                    : status === "rest"
                      ? "Descanso"
                      : "Sin registrar"}
              </span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
