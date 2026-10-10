import { useEffect, useState, type FormEvent } from "react";
import { fetchHabitPlan, saveHabitPlan } from "./api";
import { formatDateShort } from "./format";
import { PANEL_CONFIG_DEFAULTS } from "./panelConfig";
import type { HabitPlanResponse } from "./types";

const DAY_TOGGLES = [
  { day: 0, label: "L" },
  { day: 1, label: "M" },
  { day: 2, label: "X" },
  { day: 3, label: "J" },
  { day: 4, label: "V" },
  { day: 5, label: "S" },
  { day: 6, label: "D" },
];

function mlToLiters(ml: number | null | undefined): string {
  if (ml == null || Number.isNaN(Number(ml))) return "";
  return String(Number(ml) / 1000);
}

function litersToMl(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const liters = Number(trimmed.replace(",", "."));
  if (Number.isNaN(liters)) return null;
  return Math.round(liters * 1000);
}

export function HabitPlanEditor({
  clientId,
  weekStart,
  challengeStart,
  defaultSessionsPerWeek = PANEL_CONFIG_DEFAULTS.default_sessions_per_week,
  defaultWaterGoalMl = PANEL_CONFIG_DEFAULTS.default_water_goal_ml,
  onSaved,
}: {
  clientId: number;
  weekStart: string;
  challengeStart: string | null;
  defaultSessionsPerWeek?: number;
  defaultWaterGoalMl?: number;
  onSaved: () => void;
}) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const [rest, setRest] = useState<number[]>([]);
  const [waterL, setWaterL] = useState(String(defaultWaterGoalMl / 1000));
  const [sessions, setSessions] = useState(String(defaultSessionsPerWeek));
  const [fromMode, setFromMode] = useState<"start" | "week" | "date">("week");
  const [customDate, setCustomDate] = useState(weekStart);
  const [hasPrior, setHasPrior] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError("");
    setOk(false);
    fetchHabitPlan(clientId, ac.signal)
      .then((res: HabitPlanResponse) => {
        const current = res.current;
        const prior = Boolean(current) || (res.history && res.history.length > 0);
        setHasPrior(prior);
        setRest(current?.rest_weekdays ? [...current.rest_weekdays] : []);
        const defaultMl =
          current?.water_goal_ml ??
          res.defaults?.water_goal_ml ??
          defaultWaterGoalMl ??
          PANEL_CONFIG_DEFAULTS.default_water_goal_ml;
        setWaterL(mlToLiters(defaultMl) || String(defaultWaterGoalMl / 1000));
        const sessionsValue =
          current?.sessions_per_week ??
          res.defaults?.sessions_per_week ??
          defaultSessionsPerWeek ??
          PANEL_CONFIG_DEFAULTS.default_sessions_per_week;
        setSessions(
          String(
            Math.min(
              7,
              Math.max(
                1,
                Number(sessionsValue) || PANEL_CONFIG_DEFAULTS.default_sessions_per_week,
              ),
            ),
          ),
        );
        setFromMode(prior ? "week" : "start");
        setCustomDate(weekStart);
      })
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "No fue posible cargar el plan de hábitos");
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [clientId, weekStart, defaultSessionsPerWeek, defaultWaterGoalMl]);

  function toggleDay(day: number) {
    setRest((prev) => {
      if (prev.includes(day)) return prev.filter((d) => d !== day);
      if (prev.length >= 6) return prev;
      return [...prev, day].sort((a, b) => a - b);
    });
    setOk(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setError("");
    setOk(false);
    const waterMl = litersToMl(waterL);
    const sessionsN = Math.min(
      7,
      Math.max(
        1,
        Math.round(Number(sessions) || defaultSessionsPerWeek || PANEL_CONFIG_DEFAULTS.default_sessions_per_week),
      ),
    );
    let effectiveFrom: string | null = null;
    if (fromMode === "start") effectiveFrom = challengeStart;
    else if (fromMode === "week") effectiveFrom = weekStart;
    else effectiveFrom = customDate || null;
    try {
      await saveHabitPlan(clientId, {
        rest_weekdays: rest,
        water_goal_ml: waterMl,
        sessions_per_week: sessionsN,
        effective_from: effectiveFrom,
      });
      setOk(true);
      setHasPrior(true);
      if (fromMode === "start") setFromMode("week");
      onSaved();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No fue posible guardar el plan");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="wp-habit-editor" onSubmit={onSubmit}>
      <h2>Plan de hábitos</h2>
      {loading ? <p className="wp-habit-hint">Cargando plan…</p> : null}
      <fieldset className="wp-habit-days" disabled={loading || saving}>
        <legend>Días de descanso</legend>
        <div className="wp-habit-toggles">
          {DAY_TOGGLES.map((item) => {
            const on = rest.includes(item.day);
            return (
              <button
                key={item.day}
                type="button"
                className={`wp-habit-toggle ${on ? "on" : ""}`}
                aria-pressed={on}
                onClick={() => toggleDay(item.day)}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </fieldset>
      <label className="wp-habit-field">
        Meta de agua (L/día)
        <input
          type="number"
          min={0.5}
          max={6}
          step={0.25}
          value={waterL}
          onChange={(e) => {
            setWaterL(e.target.value);
            setOk(false);
          }}
          disabled={loading || saving}
        />
      </label>
      <label className="wp-habit-field">
        Sesiones de entreno por semana
        <input
          type="number"
          min={1}
          max={7}
          step={1}
          value={sessions}
          onChange={(e) => {
            setSessions(e.target.value);
            setOk(false);
          }}
          disabled={loading || saving}
          aria-describedby="wp-sessions-hint"
        />
        <small id="wp-sessions-hint" className="wp-habit-hint">
          Entre 1 y 7. Define cuántos entrenamientos se esperan en la semana.
        </small>
      </label>
      <label className="wp-habit-field">
        Aplicar desde
        <select
          value={fromMode}
          onChange={(e) => setFromMode(e.target.value as "start" | "week" | "date")}
          disabled={loading || saving}
        >
          {!hasPrior ? <option value="start">Inicio del desafío</option> : null}
          <option value="week">Desde la semana del {formatDateShort(weekStart)}</option>
          <option value="date">Fecha</option>
        </select>
      </label>
      {fromMode === "date" ? (
        <label className="wp-habit-field">
          Fecha
          <input
            type="date"
            value={customDate}
            onChange={(e) => setCustomDate(e.target.value)}
            disabled={loading || saving}
          />
        </label>
      ) : null}
      {error ? (
        <p className="wp-feedback-error" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? <p className="wp-sent">Guardado</p> : null}
      <button type="submit" className="primary" disabled={loading || saving}>
        {saving ? "Guardando…" : "Guardar"}
      </button>
    </form>
  );
}
