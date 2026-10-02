"use client";

import { useState } from "react";

type Row = Record<string, unknown>;
type Act = (payload: Row) => Promise<unknown>;

// Rangos del backend (participant.body.update). Se validan aquí para avisar
// antes de enviar; el backend vuelve a validar y su mensaje se muestra igual.
const WEIGHT_MIN = 30, WEIGHT_MAX = 300, HEIGHT_MIN = 100, HEIGHT_MAX = 230;
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
  return {
    weight: text(person.weight),
    height: text(person.height),
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

function validate(values: Values): Partial<Record<FieldKey, string>> {
  const errors: Partial<Record<FieldKey, string>> = {};
  for (const key of ["weight", "weightDay30", "weightDay60", "weightDay90"] as FieldKey[]) {
    const raw = values[key].trim();
    if (!raw) continue;
    const n = Number(raw.replace(",", "."));
    if (!Number.isFinite(n) || n < WEIGHT_MIN || n > WEIGHT_MAX) errors[key] = `Usa un valor entre ${WEIGHT_MIN} y ${WEIGHT_MAX} kg`;
  }
  const height = values.height.trim();
  if (height) {
    const n = Number(height.replace(",", "."));
    if (!Number.isFinite(n) || n < HEIGHT_MIN || n > HEIGHT_MAX) errors.height = `Usa un valor entre ${HEIGHT_MIN} y ${HEIGHT_MAX} cm`;
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
export function BodyDataEditor({ person, questions, act, startOpen = false }: { person: Row; questions: Row[]; act: Act; startOpen?: boolean }) {
  const [openEditor, setOpenEditor] = useState(startOpen);
  const [baseline, setBaseline] = useState<Values>(() => valuesOf(person));
  const [values, setValues] = useState<Values>(() => valuesOf(person));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<string[] | null>(null);
  const errors = validate(values);
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

  async function save() {
    if (hasErrors) { setError("Corrige los campos marcados antes de guardar."); return; }
    if (!changed.length) { setError("No hay cambios para guardar."); return; }
    const payload: Row = { action: "participant.body.update", id: person.id };
    for (const key of changed) {
      const raw = values[key].trim();
      payload[key] = key === "birthdate" || key === "gender" ? raw : Number(raw.replace(",", "."));
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

  const numberField = (key: FieldKey, unit: string, min: number, max: number) => <label className={errors[key] ? "body-field invalid" : changed.includes(key) ? "body-field changed" : "body-field"}>{LABELS[key]} ({unit})<input type="number" inputMode="decimal" step="0.1" min={min} max={max} value={values[key]} placeholder={key.startsWith("weightDay") ? "Sin registro" : "No informado"} onChange={e => set(key, e.target.value)} aria-invalid={Boolean(errors[key])}/>{errors[key] && <em role="alert">{errors[key]}</em>}</label>;

  return <section className="body-data-editor">
    <header>
      <div><b>Datos corporales del alumno (solo administrador)</b><p>Corrige peso inicial, estatura, fecha de nacimiento, género y pesos de los días 30/60/90 si el alumno se equivocó al ingresarlos. Se actualizan la ficha, el perfil del alumno y la evaluación de la nutri.</p></div>
      {!openEditor && <button type="button" className="secondary" onClick={() => setOpenEditor(true)}>Editar datos</button>}
    </header>
    {openEditor && <>
      <div className="form-grid four">
        {numberField("weight", "kg", WEIGHT_MIN, WEIGHT_MAX)}
        {numberField("height", "cm", HEIGHT_MIN, HEIGHT_MAX)}
        <label className={errors.birthdate ? "body-field invalid" : changed.includes("birthdate") ? "body-field changed" : "body-field"}>{LABELS.birthdate}<input type="date" max={todayIso()} value={values.birthdate} onChange={e => set("birthdate", e.target.value)} aria-invalid={Boolean(errors.birthdate)}/>{errors.birthdate && <em role="alert">{errors.birthdate}</em>}</label>
        <label className={changed.includes("gender") ? "body-field changed" : "body-field"}>{LABELS.gender}<select value={values.gender} onChange={e => set("gender", e.target.value)}><option value="">No informado</option>{genders.map(option => <option key={option} value={option}>{option}</option>)}</select></label>
        {numberField("weightDay30", "kg", WEIGHT_MIN, WEIGHT_MAX)}
        {numberField("weightDay60", "kg", WEIGHT_MIN, WEIGHT_MAX)}
        {numberField("weightDay90", "kg", WEIGHT_MIN, WEIGHT_MAX)}
      </div>
      <p className="body-data-hint">Rangos: peso {WEIGHT_MIN}–{WEIGHT_MAX} kg · estatura {HEIGHT_MIN}–{HEIGHT_MAX} cm. Solo se envían los campos modificados; un campo vacío no borra el dato guardado. Corregir datos <b>no publica macros nuevos</b>: la nutri debe usar «Recalcular con datos actuales» en Editar nutrición y guardar el plan.</p>
      {error && <p className="upload-error" role="alert">{error}</p>}
      {result && <div className="body-data-result" role="status"><b>✓ Datos corregidos</b>{result.length ? <ul>{result.map((change, index) => <li key={index}>{change}</li>)}</ul> : <p>Sin diferencias respecto a lo guardado.</p>}</div>}
      <div className="body-data-actions">
        <button type="button" className="secondary" disabled={saving} onClick={() => { reset(); if (!startOpen) setOpenEditor(false); }}>{startOpen ? "Deshacer cambios" : "Cerrar"}</button>
        <button type="button" className="primary" disabled={saving || !changed.length || hasErrors} onClick={save}>{saving ? "Guardando…" : changed.length ? `Guardar ${changed.length} ${changed.length === 1 ? "cambio" : "cambios"}` : "Sin cambios"}</button>
      </div>
    </>}
  </section>;
}
