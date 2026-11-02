"use client";

import { useEffect, useMemo, useState } from "react";
import {
  milestoneWindowsHint,
  PANEL_CONFIG_DEFAULTS,
} from "./weekly-panel/panelConfig";
import type { PanelConfig } from "./weekly-panel/types";

type Row = Record<string, unknown>;

function valueFor(person: Row, checkpoints: Row[], day: number, key: "weight" | "adherence") {
  if (day === 0) return key === "weight" ? person.weight : 0;
  if (key === "weight")
    return checkpoints.find((row) => Number(row.day) === day)?.weight ?? person[`weight_day_${day}`];
  return person[`adherence_day_${day}`];
}

export function ProgressMilestones({
  person,
  checkpoints = [],
  currentDay,
  editable = false,
  act,
  panelConfig,
  variant = "default",
}: {
  person: Row;
  checkpoints?: Row[];
  currentDay?: number;
  editable?: boolean;
  act?: (payload: Row) => Promise<unknown>;
  panelConfig?: PanelConfig | null;
  variant?: "default" | "weight-only";
}) {
  const milestoneDays = panelConfig?.milestone_days?.length
    ? panelConfig.milestone_days
    : PANEL_CONFIG_DEFAULTS.milestone_days;
  const challengeDays =
    panelConfig?.challenge_length_days ?? PANEL_CONFIG_DEFAULTS.challenge_length_days;
  const dayNow = currentDay ?? challengeDays;
  const weightMin = panelConfig?.weight_min_kg ?? PANEL_CONFIG_DEFAULTS.weight_min_kg;
  const weightMax = panelConfig?.weight_max_kg ?? PANEL_CONFIG_DEFAULTS.weight_max_kg;
  const days = useMemo(() => [0, ...milestoneDays], [milestoneDays]);
  const formula = milestoneWindowsHint(
    panelConfig?.milestone_windows || PANEL_CONFIG_DEFAULTS.milestone_windows,
  );
  const [drafts, setDrafts] = useState<Record<number, string>>({});

  useEffect(() => {
    const next: Record<number, string> = {};
    for (const day of milestoneDays) {
      next[day] = String(valueFor(person, checkpoints, day, "weight") ?? "");
    }
    setDrafts(next);
  }, [person, checkpoints, milestoneDays]);

  const daysLabel = milestoneDays.join(", ");

  return (
    <section className="milestone-panel">
      <header>
        <div>
          <span className="eyebrow">HITOS DEL PROCESO</span>
          <h2>{variant === "weight-only" ? "Mi peso" : "Peso y adherencia"}</h2>
          <p>
            Una fotografía comparable de tu avance al inicio y en los días {daysLabel}.
          </p>
        </div>
        {variant === "default" && <span className="milestone-formula">{formula}</span>}
      </header>
      <div className="milestone-grid">
        {days.map((day) => {
          const unlocked = day === 0 || dayNow >= day;
          const weight = valueFor(person, checkpoints, day, "weight");
          const adherence = valueFor(person, checkpoints, day, "adherence");
          return (
            <article key={day} className={unlocked ? "unlocked" : "locked"}>
              <div className="milestone-day">
                <span>{day === 0 ? "INICIO" : `DÍA ${day}`}</span>
                <i>{unlocked ? "✓" : "○"}</i>
              </div>
              <div className="milestone-values">
                <span>
                  <small>Peso</small>
                  {editable && day > 0 && unlocked ? (
                    <label>
                      <input
                        aria-label={`Peso día ${day}`}
                        type="number"
                        min={weightMin}
                        max={weightMax}
                        step="0.1"
                        value={drafts[day] || ""}
                        placeholder="kg"
                        onChange={(event) =>
                          setDrafts({ ...drafts, [day]: event.target.value })
                        }
                      />
                      <em>kg</em>
                    </label>
                  ) : (
                    <b>
                      {weight
                        ? `${Number(weight).toFixed(1).replace(".0", "")} kg`
                        : unlocked
                          ? "Pendiente"
                          : "—"}
                    </b>
                  )}
                </span>
                {variant === "default" && (
                  <span>
                    <small>Adherencia</small>
                    <b>
                      {unlocked && adherence != null ? `${Math.round(Number(adherence))}%` : "—"}
                    </b>
                  </span>
                )}
              </div>
              {editable && day > 0 && unlocked && (
                <button
                  className="milestone-save"
                  disabled={!drafts[day]}
                  onClick={() =>
                    act?.({ action: "checkpoint.self.save", day, weight: drafts[day] })
                  }
                >
                  {weight ? "Actualizar peso" : "Guardar peso"}
                </button>
              )}
              {!unlocked && (
                <small className="milestone-locked">Disponible al llegar al día {day}</small>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}
