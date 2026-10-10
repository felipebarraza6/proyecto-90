"use client";

import { useEffect, useMemo, useState } from "react";
import {
  macrosDayStatus,
  macroTone,
  PANEL_CONFIG_DEFAULTS,
  type MacroKey,
} from "./weekly-panel/panelConfig";
import type { PanelConfig } from "./weekly-panel/types";

type Row = Record<string, unknown>;
type Values = { calories: string; protein: string; fats: string; carbs: string };
const metrics = [
  { key: "calories", label: "Calorías", unit: "kcal" },
  { key: "protein", label: "Proteínas", unit: "g" },
  { key: "fats", label: "Grasas", unit: "g" },
  { key: "carbs", label: "Carbohidratos", unit: "g" },
] as const;
const dayNames = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const iso = (date: Date) => date.toISOString().slice(0, 10);
const chileToday = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Santiago",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
const dateAt = (value: unknown) => {
  const raw = String(value || new Date().toISOString()).slice(0, 10);
  return new Date(`${raw}T12:00:00Z`);
};
const addDays = (date: Date, days: number) => new Date(date.getTime() + days * 86400000);
const initialWeek = (start: Date) =>
  Math.max(1, Math.min(13, Math.floor((Date.now() - start.getTime()) / (7 * 86400000)) + 1));
const empty = (): Values => ({ calories: "", protein: "", fats: "", carbs: "" });
function recordValues(row?: Row): Values {
  return {
    calories: String(row?.calories ?? ""),
    protein: String(row?.protein ?? ""),
    fats: String(row?.fats ?? ""),
    carbs: String(row?.carbs ?? ""),
  };
}

function rangesOf(config?: PanelConfig | null) {
  return config?.macro_ranges || PANEL_CONFIG_DEFAULTS.macro_ranges;
}

function macroConfigOf(config?: PanelConfig | null) {
  return {
    macro_met_requires: config?.macro_met_requires || PANEL_CONFIG_DEFAULTS.macro_met_requires,
    macro_ranges: rangesOf(config),
    calories_min_enabled:
      config?.calories_min_enabled ?? PANEL_CONFIG_DEFAULTS.calories_min_enabled,
    calories_low_ratio: config?.calories_low_ratio ?? PANEL_CONFIG_DEFAULTS.calories_low_ratio,
  };
}

function rangeHelp(config?: PanelConfig | null): string {
  const ranges = rangesOf(config);
  const parts = (["calories", "protein", "carbs", "fats"] as MacroKey[]).map((key) => {
    const r = ranges[key];
    const bits: string[] = [];
    if (r.min != null) bits.push(`≥${Math.round(r.min * 100)}%`);
    if (r.max != null) bits.push(`≤${Math.round(r.max * 100)}%`);
    const label =
      key === "calories"
        ? "kcal"
        : key === "protein"
          ? "proteína"
          : key === "carbs"
            ? "carbs"
            : "grasas";
    return `${label} ${bits.join("–") || "—"}`;
  });
  return `Verde: dentro del rango configurado (${parts.join(" · ")}).`;
}

export function NutritionDailyTracker({
  records,
  plan,
  startDate,
  act,
  panelConfig,
}: {
  records: Row[];
  plan?: Row | null;
  startDate: unknown;
  act: (payload: Row) => Promise<unknown>;
  panelConfig?: PanelConfig | null;
}) {
  const start = useMemo(() => dateAt(startDate), [startDate]);
  const [week, setWeek] = useState(() => initialWeek(start));
  useEffect(() => {
    setWeek(initialWeek(start));
  }, [start]);
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => addDays(start, (week - 1) * 7 + index)).filter(
        (day) => day < addDays(start, 90),
      ),
    [start, week],
  );
  const [values, setValues] = useState<Record<string, Values>>({});
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    const next: Record<string, Values> = {};
    for (const day of days) {
      const date = iso(day);
      next[date] = recordValues(records.find((row) => String(row.log_date) === date));
    }
    setValues(next);
  }, [records, days]);
  const target = (key: (typeof metrics)[number]["key"]) => Number(plan?.[key] || 0);
  const ranges = rangesOf(panelConfig);
  async function save() {
    const entries = days
      .map((day) => ({ date: iso(day), ...(values[iso(day)] || empty()) }))
      .filter((entry) => metrics.every((metric) => entry[metric.key] !== ""));
    if (!entries.length) return;
    setSaving(true);
    try {
      await act({ action: "nutrition.daily.save", entries });
    } finally {
      setSaving(false);
    }
  }
  return (
    <section className="daily-nutrition">
      <header>
        <div>
          <span className="eyebrow">REGISTRO DIARIO · DÍA 1 AL 90</span>
          <h2>Mis macros reales</h2>
          <p>Ingresa los valores que obtuviste en tu aplicación de registro. {rangeHelp(panelConfig)}</p>
        </div>
        <label>
          Semana
          <select value={week} onChange={(event) => setWeek(Number(event.target.value))}>
            {Array.from({ length: 13 }, (_, index) => (
              <option value={index + 1} key={index}>
                Semana {index + 1}
              </option>
            ))}
          </select>
        </label>
      </header>
      {!plan ? (
        <div className="professional-file-empty">
          <b>Objetivos aún no aprobados</b>
          <p>Podrás comparar tus registros cuando la nutricionista publique el plan.</p>
        </div>
      ) : (
        <>
          <div className="daily-nutrition-wrap">
            <table>
              <thead>
                <tr>
                  <th>Objetivo</th>
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
                {metrics.map((metric) => (
                  <tr key={metric.key}>
                    <th>
                      <b>{metric.label}</b>
                      <small>
                        {target(metric.key)} {metric.unit}/día
                      </small>
                    </th>
                    {days.map((day) => {
                      const date = iso(day);
                      const disabled = date > chileToday();
                      return (
                        <td key={date}>
                          <input
                            aria-label={`${metric.label} ${date}`}
                            type="number"
                            min="0"
                            step="0.1"
                            disabled={disabled}
                            className={macroTone(
                              values[date]?.[metric.key] || "",
                              target(metric.key),
                              ranges[metric.key],
                            )}
                            value={values[date]?.[metric.key] || ""}
                            onChange={(event) =>
                              setValues((current) => ({
                                ...current,
                                [date]: {
                                  ...(current[date] || empty()),
                                  [metric.key]: event.target.value,
                                },
                              }))
                            }
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer>
            <span>Los días futuros se habilitan automáticamente.</span>
            <button className="primary" disabled={saving} onClick={save}>
              {saving ? "Guardando…" : "Guardar semana"}
            </button>
          </footer>
        </>
      )}
    </section>
  );
}

export function NutritionDailyReview({
  records,
  person,
  panelConfig,
}: {
  records: Row[];
  person: Row;
  panelConfig?: PanelConfig | null;
}) {
  const start = useMemo(
    () => dateAt(person.challenge_start || person.assigned_at || person.created_at),
    [person.challenge_start, person.assigned_at, person.created_at],
  );
  const [week, setWeek] = useState(() => initialWeek(start));
  useEffect(() => {
    setWeek(initialWeek(start));
  }, [start]);
  const days = useMemo(
    () =>
      Array.from({ length: 7 }, (_, index) => addDays(start, (week - 1) * 7 + index)).filter(
        (day) => day < addDays(start, 90),
      ),
    [start, week],
  );
  const own = records.filter((row) => String(row.user_id) === String(person.id));
  const target = (key: (typeof metrics)[number]["key"]) => Number(person[key] || 0);
  const entry = (date: string) => own.find((row) => String(row.log_date) === date);
  const ranges = rangesOf(panelConfig);
  const macroCfg = macroConfigOf(panelConfig);
  const closure = (date: string) => {
    const row = entry(date);
    if (!row) return "empty";
    return macrosDayStatus(
      {
        calories: Number(row.calories || 0),
        protein: Number(row.protein || 0),
        carbs: Number(row.carbs || 0),
        fats: Number(row.fats || 0),
      },
      {
        calories: target("calories"),
        protein: target("protein"),
        carbs: target("carbs"),
        fats: target("fats"),
      },
      macroCfg,
    );
  };
  return (
    <section className="daily-nutrition review">
      <header>
        <div>
          <span className="eyebrow">SEGUIMIENTO SEMANAL</span>
          <h3>Cierre diario de macros</h3>
          <p>
            Primero ves si cumplió; debajo está el detalle de cada valor y su porcentaje respecto al
            objetivo. {rangeHelp(panelConfig)}
          </p>
        </div>
        <label>
          Semana
          <select value={week} onChange={(event) => setWeek(Number(event.target.value))}>
            {Array.from({ length: 13 }, (_, index) => (
              <option value={index + 1} key={index}>
                Semana {index + 1}
              </option>
            ))}
          </select>
        </label>
      </header>
      <div className="macro-closure-grid">
        {days.map((day) => {
          const status = closure(iso(day));
          return (
            <article className={status} key={iso(day)}>
              <small>
                {dayNames[day.getUTCDay()]} ·{" "}
                {day.toLocaleDateString("es-CL", {
                  day: "2-digit",
                  month: "2-digit",
                  timeZone: "UTC",
                })}
              </small>
              <strong>{status === "met" ? "✓" : status === "missed" ? "×" : "·"}</strong>
              <b>
                {status === "met" ? "Cumplió" : status === "missed" ? "No cumplió" : "Sin registrar"}
              </b>
            </article>
          );
        })}
      </div>
      <div className="daily-nutrition-wrap">
        <table>
          <thead>
            <tr>
              <th>Objetivo</th>
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
            {metrics.map((metric) => (
              <tr key={metric.key}>
                <th>
                  <b>{metric.label}</b>
                  <small>
                    {target(metric.key)} {metric.unit}
                  </small>
                </th>
                {days.map((day) => {
                  const value = String(entry(iso(day))?.[metric.key] ?? "");
                  const percentage =
                    value && target(metric.key)
                      ? Math.round((Number(value) / target(metric.key)) * 100)
                      : null;
                  return (
                    <td key={iso(day)}>
                      <span
                        className={`daily-value ${macroTone(value, target(metric.key), ranges[metric.key])}`}
                      >
                        <b>{value || "—"}</b>
                        {percentage != null && <small>{percentage}% del objetivo</small>}
                      </span>
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
