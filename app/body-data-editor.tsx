"use client";

import { useState } from "react";
import { heightCmForDisplay, normalizeHeightInputCm } from "./height";
import { PANEL_CONFIG_DEFAULTS } from "./weekly-panel/panelConfig";
import type { PanelConfig } from "./weekly-panel/types";

type Row = Record<string, unknown>;
type Act = (payload: Row) => Promise<unknown>;

const FALLBACK_GENDERS = ["Mujer", "Hombre", "No binario", "Prefiero no responder", "Otro"];

type FieldKey = "weight" | "height" | "birthdate" | "gender" | "weightDay30" | "weightDay60" | "weightDay90";
type Values = Record<FieldKey, string>;

const LABELS: Record<FieldKey, string> = {
  weight: "Peso inicial",
  height: "Estatura",
  birthdate: "Fecha de nacimiento",
  gender: "Género",
  weightDay30: "Peso día 30",
  weightDay60: "Peso día 60",
  weightDay90: "Peso día 90",
};

function text(value: unknown) { return value == null ? "" : String(value); }
function valuesOf(person: Row): Values {
  const heightCm = heightCmForDisplay(person.height);
  return {
    weight: text(person.weight),
    height: heightCm == null ? "" : String(heightCm),
    birthdate: text(person.birthdate).slice(0, 10),
    gender: text(person.gender),
    weightDay30: text(person.weight_day_30),
    weightDay60: text(person.weight_day_60),
    weightDay90: text(person.weight_day_90),
  };
}
function genderOptions(questions: Row[], current: string) {
  const question = questions.find(q => String(q.key) === "gender");
  let options: string[] = [];
  try { options = question?.options_json ? JSON.parse(String(question.options_json)) as string[] : []; } catch { options = []; }
  if (!options.length) options = FALLBACK_GENDERS;
  return current && !options.includes(current) ? [current, ...options] : options;
}
function sameNumber(a: string, b: string) { return a.trim() !== "" && b.trim() !== "" && Number(a) === Number(b); }
function todayIso() { const d = new Date(); const pad = (n: number) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

function validate(
  values: Values,
  ranges: { weightMin: number; weightMax: number; heightMin: number; heightMax: number },
): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  for (const key of ["weight", "weightDay30", "weightDay60", "weightDay90"] as FieldKey[]) {
    const raw = values[key].trim();
    if (!raw) continue;
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n) || n < ranges.weightMin || n > ranges.weightMax) {
      errors[key] = `Usa un valor entre ${ranges.weightMin} y ${ranges.weightMax} kg`;
    }
  }
  const height = values.height.trim();
  if (height) {
    const result = normalizeHeightInputCm(height, {
      min: ranges.heightMin,
      max: ranges.heightMax,
    });
    if (result.error) errors.height = result.error;
  }
  const birthdate = values.birthdate.trim();
  if (birthdate) {
    const date = new Date(`${birthdate}T12:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(birthdate) || Number.isNaN(date.getTime())) errors.birthdate = "Fecha no válida (AAAA-MM-DD)";
    else if (birthdate > todayIso()) errors.birthdate = "La fecha de nacimiento no puede ser futura";
    else if (birthdate < "1900-01-01") errors.birthdate = "Revisa el año de nacimiento";
  }
  return errors;
}

/**
 * Corrección admin de peso inicial, estatura, fecha de nacimiento, género y
 * pesos de los hitos 30/60/90 (acción `participant.body.update`, solo admin).
 * Solo envía los campos que cambiaron; el backend no borra datos omitidos.
 */
export function BodyDataEditor({
  person,
  questions,
  act,
  startOpen = false,
  panelConfig,
}: {
  person: Row;
  questions: Row[];
  act: Act;
  startOpen?: boolean;
  panelConfig?: PanelConfig | null;
}) {
  const [openEditor, setOpenEditor] = useState(startOpen);
  const [baseline, setBaseline] = useState<Values>(() => valuesOf(person));
  const [values, setValues] = useState<Values>(() => valuesOf(person));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<string[] | null>(null);
  const ranges = {
    weightMin: panelConfig?.weight_min_kg ?? PANEL_CONFIG_DEFAULTS.weight_min_kg,
    weightMax: panelConfig?.weight_max_kg ?? PANEL_CONFIG_DEFAULTS.weight_max_kg,
    heightMin: panelConfig?.height_min_cm ?? PANEL_CONFIG_DEFAULTS.height_min_cm,
    heightMax: panelConfig?.height_max_cm ?? PANEL_CONFIG_DEFAULTS.height_max_cm,
  };
  const errors = validate(values, ranges);
  const changed = (Object.keys(values) as FieldKey[]).filter(key => {
    const next = values[key].trim();
    if (!next) return false; // vacío = sin cambio (el backend no borra datos)
    const before = baseline[key].trim();
    return key === "birthdate" || key === "gender" ? next !== before : !sameNumber(next, before);
  });
  const hasErrors = Object.keys(errors).length > 0;
  const genders = genderOptions(questions, values.gender);

  function set(key: FieldKey, value: string) { setValues(current => ({ ...current, [key]: value })); setError(""); setResult(null); }
  function reset() { setValues(baseline); setError(""); setResult(null); }

  function commitHeight() {
    const result = normalizeHeightInputCm(values.height, {
      min: ranges.heightMin,
      max: ranges.heightMax,
    });
    if (result.cm != null && result.convertedFromMeters) {
      setValues((current) => ({ ...current, height: String(result.cm) }));
    }
  }

  async function save() {
    if (hasErrors) { setError("Corrige los campos marcados antes de guardar."); return; }
    if (!changed.length) { setError("No hay cambios para guardar."); return; }
    const payload: Row = { action: "participant.body.update", id: person.id };
    for (const key of changed) {
      const raw = values[key].trim();
      if (key === "birthdate" || key === "gender") {
        payload[key] = raw;
        continue;
      }
      if (key === "height") {
        const result = normalizeHeightInputCm(raw, {
          min: ranges.heightMin,
          max: ranges.heightMax,
        });
        if (result.error || result.cm == null) {
          setError(result.error || "Revisa la estatura en centímetros.");
          return;
        }
        payload[key] = result.cm;
        continue;
      }
      payload[key] = Number(raw.replace(",", "."));
    }
    setSaving(true); setError(""); setResult(null);
    try {
      const json = await act(payload) as Row;
      const saved: Values = {
        weight: text(json.weight ?? values.weight),
        height: text(json.height ?? values.height),
        birthdate: text(json.birthdate ?? values.birthdate).slice(0, 10),
        gender: text(json.gender ?? values.gender),
        weightDay30: text(json.weightDay30 ?? values.weightDay30),
        weightDay60: text(json.weightDay60 ?? values.weightDay60),
        weightDay90: text(json.weightDay90 ?? values.weightDay90),
      };
      setBaseline(saved); setValues(saved);
      const changes = Array.isArray(json.changes) ? (json.changes as unknown[]).map(change => String(change).replace(/\b(None|null)\b/g, "sin dato")) : [];
      setResult(changes);
    } catch (err) {
      setError(err instanceof Error && err.message && err.message !== "undefined" ? err.message : "No fue posible guardar los datos");
    } finally { setSaving(false); }
  }

  const numberField = (key: FieldKey, unit: string, min: number, max: number) => (
    <label className={errors[key] ? "body-field invalid" : changed.includes(key) ? "body-field changed" : "body-field"}>
      {LABELS[key]} ({unit})
      <input
        type="number"
        inputMode="decimal"
        step="0.1"
        min={key === "height" ? undefined : min}
        max={key === "height" ? undefined : max}
        value={values[key]}
        placeholder={key === "height" ? "Ej. 170" : key.startsWith("weightDay") ? "Sin registro" : "No informado"}
        onChange={(e) => set(key, e.target.value)}
        onBlur={key === "height" ? commitHeight : undefined}
        aria-invalid={Boolean(errors[key])}
      />
      {errors[key] && <em role="alert">{errors[key]}</em>}
      {key === "height" ? (
        <small className="body-field-hint">En centímetros. Si escribes metros (1,70), lo convertimos a 170 cm.</small>
      ) : null}
    </label>
  );

  return <section className="body-data-editor">
    <header>
      <div><b>Datos corporales del alumno (solo administrador)</b><p>Corrige peso inicial, estatura, fecha de nacimiento, género y pesos de los días 30/60/90 si el alumno se equivocó al ingresarlos. Se actualizan la ficha, el perfil del alumno y la evaluación de la nutri.</p></div>
      {!openEditor && <button type="button" className="secondary" onClick={() => setOpenEditor(true)}>Editar datos</button>}
    </header>
    {openEditor && <>
      <div className="form-grid four">
        {numberField("weight", "kg", ranges.weightMin, ranges.weightMax)}
        {numberField("height", "cm", ranges.heightMin, ranges.heightMax)}
        <label className={errors.birthdate ? "body-field invalid" : changed.includes("birthdate") ? "body-field changed" : "body-field"}>{LABELS.birthdate}<input type="date" max={todayIso()} value={values.birthdate} onChange={e => set("birthdate", e.target.value)} aria-invalid={Boolean(errors.birthdate)}/>{errors.birthdate && <em role="alert">{errors.birthdate}</em>}</label>
        <label className={changed.includes("gender") ? "body-field changed" : "body-field"}>{LABELS.gender}<select value={values.gender} onChange={e => set("gender", e.target.value)}><option value="">No informado</option>{genders.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
        {numberField("weightDay30", "kg", ranges.weightMin, ranges.weightMax)}
        {numberField("weightDay60", "kg", ranges.weightMin, ranges.weightMax)}
        {numberField("weightDay90", "kg", ranges.weightMin, ranges.weightMax)}
      </div>
      <p className="body-data-hint">Rangos: peso {ranges.weightMin}–{ranges.weightMax} kg · estatura {ranges.heightMin}–{ranges.heightMax} cm. Solo se envían los campos modificados; un campo vacío no borra el dato guardado. Corregir datos <b>no publica macros nuevos</b>: la nutri debe usar «Recalcular con datos actuales» en Editar nutrición y guardar el plan.</p>
      {error && <p className="upload-error" role="alert">{error}</p>}
      {result && <div className="body-data-result" role="status"><b>✓ Datos corregidos</b>{result.length ? <ul>{result.map((change, index) => <li key={index}>{change}</li>)}</ul> : <p>Sin diferencias respecto a lo guardado.</p>}</div>}
      <div className="body-data-actions">
        <button type="button" className="secondary" disabled={saving} onClick={() => { reset(); if (!startOpen) setOpenEditor(false); }}>{startOpen ? "Deshacer cambios" : "Cerrar"}</button>
        <button type="button" className="primary" disabled={saving || !changed.length || hasErrors} onClick={save}>{saving ? "Guardando…" : changed.length ? `Guardar ${changed.length} ${changed.length === 1 ? "cambio" : "cambios"}` : "Sin cambios"}</button>
      </div>
    </>}
  </section>;
}
