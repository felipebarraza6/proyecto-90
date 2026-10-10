"use client";

import { useMemo, useState } from "react";
import { NutritionDailyReview } from "./nutrition-daily";
import { TrainingDailyReview } from "./participant-adherence";
import { StaffNotesPanel } from "./notes-notices";
import type { PanelConfig } from "./weekly-panel/types";

type Row = Record<string, unknown>;
type Area = "nutrition" | "training";
type Band = "all" | "red" | "yellow" | "green" | "pending";

/** Defaults = bandas históricas del tracking (80 / 90) si aún no hay config. */
const TRACKING_BAND_DEFAULTS = { green_gt: 90, yellow_gte: 80, risk: 80 };

const nameOf = (row: Row) =>
  `${row.first_name || ""} ${row.last_name || ""}`.trim() || String(row.email || "Alumno");
const initials = (row: Row) =>
  nameOf(row)
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "90";
const percent = (person: Row, area: Area) =>
  Math.max(
    0,
    Math.min(100, Math.round(Number(area === "nutrition" ? person.macros_pct : person.training_pct) || 0)),
  );

function bandOf(
  value: number,
  thresholds: { green_gt: number; yellow_gte: number },
): Exclude<Band, "all" | "pending"> {
  if (value > thresholds.green_gt) return "green";
  if (value >= thresholds.yellow_gte) return "yellow";
  return "red";
}

// 0% no es incumplimiento: si el desafío aún no partió (día 0) el alumno no puede haber cumplido nada.
const notStarted = (person: Row) => Number(person.adherence_elapsed_days || 0) === 0;

function bandCopyFor(thresholds: { green_gt: number; yellow_gte: number }) {
  return {
    red: `Bajo ${thresholds.yellow_gte}%`,
    yellow: `Entre ${thresholds.yellow_gte}% y ${thresholds.green_gt}%`,
    green: `Sobre ${thresholds.green_gt}%`,
    pending: "Aún no inicia",
  } as const;
}

export function ProfessionalTracking({
  people,
  nutritionRecords,
  habitRecords,
  initialArea,
  allowAreaSwitch = false,
  notes = [],
  act,
  canPauseMacros = false,
  canDeleteNotes = false,
  macrosControls,
  panelConfig,
}: {
  people: Row[];
  nutritionRecords: Row[];
  habitRecords: Row[];
  initialArea: Area;
  allowAreaSwitch?: boolean;
  notes?: Row[];
  act?: (payload: Row) => Promise<unknown>;
  canPauseMacros?: boolean;
  canDeleteNotes?: boolean;
  macrosControls?: (person: Row) => React.ReactNode;
  panelConfig?: PanelConfig | null;
}) {
  const [area, setArea] = useState<Area>(initialArea);
  const [band, setBand] = useState<Band>("all");
  const [studentId, setStudentId] = useState("");
  const thresholds = panelConfig?.thresholds
    ? {
        green_gt: panelConfig.thresholds.green_gt,
        yellow_gte: panelConfig.thresholds.yellow_gte,
        risk: panelConfig.thresholds.risk,
      }
    : TRACKING_BAND_DEFAULTS;
  const bandCopy = bandCopyFor(thresholds);
  const bandFor = (person: Row, nextArea: Area): Exclude<Band, "all"> =>
    notStarted(person) ? "pending" : bandOf(percent(person, nextArea), thresholds);

  const counts = useMemo(
    () => ({
      all: people.length,
      red: people.filter((person) => bandFor(person, area) === "red").length,
      yellow: people.filter((person) => bandFor(person, area) === "yellow").length,
      green: people.filter((person) => bandFor(person, area) === "green").length,
      pending: people.filter((person) => bandFor(person, area) === "pending").length,
    }),
    // thresholds + area drive bandFor
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, area, thresholds.green_gt, thresholds.yellow_gte],
  );
  const filtered = useMemo(
    () => people.filter((person) => band === "all" || bandFor(person, area) === band),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [people, area, band, thresholds.green_gt, thresholds.yellow_gte],
  );
  const selected = filtered.find((person) => String(person.id) === studentId) || filtered[0];
  function changeArea(next: Area) {
    setArea(next);
    setBand("all");
    setStudentId("");
  }
  function changeBand(next: Band) {
    setBand(next);
    setStudentId("");
  }
  return (
    <div className={`professional-tracking tracking-${area}`}>
      <div className="admin-title">
        <div>
          <span className="eyebrow">SEGUIMIENTO INDIVIDUAL · PROYECTO 90</span>
          <h1>
            {area === "nutrition" ? "Cumplimiento de macros" : "Cumplimiento de entrenamientos"}
          </h1>
          <p>
            {area === "nutrition"
              ? "Selecciona un alumno para revisar exactamente lo que registró cada día y compararlo con sus objetivos aprobados."
              : "Selecciona un alumno para revisar qué entrenamientos informó como cumplidos, no cumplidos o pendientes."}
          </p>
        </div>
        {allowAreaSwitch && (
          <div className="tracking-area-switch">
            <button
              className={area === "nutrition" ? "active" : ""}
              onClick={() => changeArea("nutrition")}
            >
              ◒ Nutrición
            </button>
            <button
              className={area === "training" ? "active" : ""}
              onClick={() => changeArea("training")}
            >
              ↗ Entrenamiento
            </button>
          </div>
        )}
      </div>
      <section className="tracking-band-filters">
        {(["all", "red", "yellow", "green", "pending"] as const).map((key) => (
          <button
            key={key}
            className={`${key} ${band === key ? "active" : ""}`}
            onClick={() => changeBand(key)}
          >
            <span>{key === "all" ? "Todos los alumnos" : bandCopy[key]}</span>
            <b>{counts[key]}</b>
            <small>
              {key === "all"
                ? "Sin filtro"
                : key === "red"
                  ? "Necesita apoyo"
                  : key === "yellow"
                    ? "Seguimiento preventivo"
                    : key === "green"
                      ? "Buen cumplimiento"
                      : "Su desafío aún no comienza"}
            </small>
          </button>
        ))}
      </section>
      <section className="tracking-picker">
        <label>
          Alumno
          <select
            value={selected ? String(selected.id) : ""}
            onChange={(event) => setStudentId(event.target.value)}
          >
            <option value="" disabled>
              {filtered.length ? "Selecciona un alumno" : "Sin alumnos en este rango"}
            </option>
            {filtered.map((person) => (
              <option key={String(person.id)} value={String(person.id)}>
                {nameOf(person)} ·{" "}
                {notStarted(person) ? "sin iniciar" : `${percent(person, area)}%`}
              </option>
            ))}
          </select>
        </label>
        <span>
          Mostrando {filtered.length} de {people.length} alumnos
        </span>
      </section>
      {!selected ? (
        <article className="empty-state compact">
          <h3>No hay alumnos en este rango</h3>
          <p>Cambia el filtro de cumplimiento para revisar otro grupo.</p>
        </article>
      ) : (
        <>
          <section className="tracking-student-hero">
            <span className="avatar">{initials(selected)}</span>
            <div>
              <small>
                {area === "nutrition" ? "SEGUIMIENTO NUTRICIONAL" : "SEGUIMIENTO DE ENTRENAMIENTO"}
              </small>
              <h2>{nameOf(selected)}</h2>
              <p>{String(selected.email || "")}</p>
            </div>
            <div className={`tracking-score ${bandFor(selected, area)}`}>
              {notStarted(selected) ? (
                <>
                  <strong>—</strong>
                  <span>aún no inicia</span>
                </>
              ) : (
                <>
                  <strong>{percent(selected, area)}%</strong>
                  <span>cumplimiento</span>
                </>
              )}
            </div>
          </section>
          {notStarted(selected) && (
            <p className="tracking-notstarted-note">
              Este alumno todavía no comienza su desafío: su día 1 es el{" "}
              {formatDate(selected.challenge_start || selected.assigned_at || selected.created_at)}.
              Por eso no muestra cumplimiento ni genera alertas de apoyo.
            </p>
          )}
          {area === "nutrition" ? (
            <>
              <section className="tracking-targets">
                <span>
                  <small>Calorías</small>
                  <b>{selected.calories ? `${selected.calories} kcal` : "—"}</b>
                </span>
                <span>
                  <small>Proteínas</small>
                  <b>{selected.protein ? `${selected.protein} g` : "—"}</b>
                </span>
                <span>
                  <small>Carbohidratos</small>
                  <b>{selected.carbs ? `${selected.carbs} g` : "—"}</b>
                </span>
                <span>
                  <small>Grasas</small>
                  <b>{selected.fats ? `${selected.fats} g` : "—"}</b>
                </span>
              </section>
              <NutritionDailyReview
                records={nutritionRecords}
                person={selected}
                panelConfig={panelConfig}
              />
            </>
          ) : (
            <TrainingDailyReview records={habitRecords} person={selected} panelConfig={panelConfig} />
          )}
          {act && (
            <>
              {canPauseMacros && macrosControls ? macrosControls(selected) : null}
              {notes.length >= 0 && (
                <StaffNotesPanel
                  notes={notes}
                  userId={String(selected.id)}
                  act={act}
                  canDelete={canDeleteNotes}
                />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

function formatDate(raw: unknown) {
  const value = String(raw || "").slice(0, 10);
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("es-CL", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      });
}
