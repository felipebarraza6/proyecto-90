"use client";

import { KeyboardEvent, ReactNode, useState } from "react";
import { NutritionAssessmentPanel, assessmentOf } from "./restored-panels";

type Row = Record<string, unknown>;
type Act = (payload: Row) => Promise<unknown>;
type MacroKey = "calories" | "protein" | "carbs" | "fats";
type Proposal = {
  calories?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fats?: number | null;
  bmr?: number | null;
  bmrSource?: string | null;
  bmrOverride?: number | null;
  maintenanceCalories?: number | null;
  height?: number | null;
  weight?: number | null;
  age?: number | null;
  bmi?: number | null;
};

const BMR_MIN = 500,
  BMR_MAX = 6000;
const MACROS: { key: MacroKey; label: string; unit: string }[] = [
  { key: "calories", label: "Calorías sugeridas", unit: "kcal" },
  { key: "protein", label: "Proteína (g)", unit: "g" },
  { key: "carbs", label: "Carbohidratos (g)", unit: "g" },
  { key: "fats", label: "Grasas / lípidos (g)", unit: "g" },
];

function text(value: unknown) {
  return value == null ? "" : String(value);
}
function fmt(value: unknown, unit: string) {
  return value == null || value === "" ? "—" : `${String(value)} ${unit}`;
}

/**
 * Bloque de macros del modal «Editar nutrición»: evaluación, recálculo y TMB.
 * Las metas por tramo (1–30 / 31–60 / 61–90) van en MacroTargetsEditor
 * (GET/POST …/macro-targets).
 */
export function NutritionPlanFields({
  person,
  act,
  canRecalculate,
  children,
}: {
  person: Row;
  act: Act;
  canRecalculate: boolean;
  children?: ReactNode;
}) {
  const saved: Record<MacroKey, string> = {
    calories: text(person.calories),
    protein: text(person.protein),
    carbs: text(person.carbs),
    fats: text(person.fats),
  };
  const stored = assessmentOf(person) as Row | null;
  const [macros, setMacros] = useState<Record<MacroKey, string>>(saved);
  const [proposal, setProposal] = useState<Proposal | null>(null);
  const [proposalAssessment, setProposalAssessment] = useState<Row | null>(null);
  const [bmrInput, setBmrInput] = useState(text(stored?.bmr));
  const [busy, setBusy] = useState<"" | "recalc" | "bmr" | "clear">("");
  const [error, setError] = useState("");
  const [overrideTouched, setOverrideTouched] = useState(false);
  const current = proposalAssessment || stored;
  const manual = String(current?.bmrSource || "") === "manual" || Boolean(current?.bmrOverride);

  async function recalculate(kind: "recalc" | "bmr" | "clear") {
    const payload: Row = { action: "nutrition.recalculate", userId: person.id };
    if (kind === "bmr") {
      const value = Number(bmrInput.replace(",", "."));
      if (!bmrInput.trim() || !Number.isFinite(value) || value < BMR_MIN || value > BMR_MAX) {
        setError(`La TMB debe estar entre ${BMR_MIN} y ${BMR_MAX} kcal.`);
        return;
      }
      payload.bmr = Math.round(value);
    }
    if (kind === "clear") payload.clearBmrOverride = true;
    setBusy(kind);
    setError("");
    try {
      const json = (await act(payload)) as Row;
      const next = (json.proposal || {}) as Proposal;
      const assessment = (json.assessment || null) as Row | null;
      setProposal(next);
      setProposalAssessment(assessment);
      if (kind !== "recalc") setOverrideTouched(true);
      if (next.bmr != null) setBmrInput(String(next.bmr));
      if (next.calories != null) {
        setMacros((currentMacros) => ({
          calories: text(next.calories ?? currentMacros.calories),
          protein: text(next.protein ?? currentMacros.protein),
          carbs: text(next.carbs ?? currentMacros.carbs),
          fats: text(next.fats ?? currentMacros.fats),
        }));
      } else {
        const blockers = Array.isArray(assessment?.calculationBlockers)
          ? (assessment?.calculationBlockers as Row[]).map((item) => String(item.label))
          : [];
        setError(
          `No se pudo calcular una propuesta${blockers.length ? `: ${blockers.join(" · ")}` : " con los datos actuales"}. Los campos no se modificaron.`,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error && err.message && err.message !== "undefined"
          ? err.message
          : "No fue posible recalcular",
      );
    } finally {
      setBusy("");
    }
  }
  function discard() {
    setMacros(saved);
    setProposal(null);
    setError("");
    if (!overrideTouched) {
      setProposalAssessment(null);
      setBmrInput(text(stored?.bmr));
    }
  }
  function onBmrKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      void recalculate("bmr");
    }
  }

  const filled = Boolean(proposal && proposal.calories != null);
  return (
    <>
      <NutritionAssessmentPanel person={person} override={proposalAssessment} proposal={filled} />
      {children}
      {canRecalculate && (
        <section className="nutrition-recalc">
          <header>
            <div>
              <span className="eyebrow">TMB Y RECÁLCULO</span>
              <h4>Recalcular la propuesta</h4>
              <p>
                Usa el peso, la estatura, la edad y el género actuales del alumno (por ejemplo,
                después de que el administrador corrigió un dato). Nada se publica hasta que pulses
                «Guardar plan».
              </p>
            </div>
            <button
              type="button"
              className="primary"
              disabled={Boolean(busy)}
              onClick={() => recalculate("recalc")}
            >
              {busy === "recalc" ? "Recalculando…" : "↻ Recalcular con datos actuales"}
            </button>
          </header>
          <div className="nutrition-recalc-bmr">
            <label>
              TMB (kcal/día) ·{" "}
              {manual ? (
                <b className="bmr-tag manual">Manual</b>
              ) : (
                <b className="bmr-tag">Harris-Benedict</b>
              )}
              <input
                type="number"
                inputMode="numeric"
                min={BMR_MIN}
                max={BMR_MAX}
                step="1"
                value={bmrInput}
                placeholder={`${BMR_MIN}–${BMR_MAX}`}
                onChange={(e) => {
                  setBmrInput(e.target.value);
                  setError("");
                }}
                onKeyDown={onBmrKey}
                aria-label="TMB manual en kcal"
              />
            </label>
            <button
              type="button"
              className="secondary"
              disabled={Boolean(busy) || !bmrInput.trim()}
              onClick={() => recalculate("bmr")}
            >
              {busy === "bmr" ? "Aplicando…" : "Aplicar TMB manual"}
            </button>
            {manual && (
              <button
                type="button"
                className="secondary"
                disabled={Boolean(busy)}
                onClick={() => recalculate("clear")}
              >
                {busy === "clear" ? "Volviendo…" : "Volver a TMB automática"}
              </button>
            )}
          </div>
          <p className="nutrition-recalc-note">
            La TMB manual (rango {BMR_MIN}–{BMR_MAX} kcal) reemplaza a Harris-Benedict: GET y macros
            se derivan de ella con el factor de actividad y el ajuste del objetivo. Queda recordada
            en la evaluación del alumno para próximos recálculos hasta que vuelvas a la TMB
            automática; los macros del alumno no cambian hasta guardar el plan.
          </p>
          {error && (
            <p className="upload-error" role="alert">
              {error}
            </p>
          )}
          {filled && proposal && (
            <div className="nutrition-proposal-banner" role="status">
              <div>
                <b>Propuesta sin guardar</b>
                <p>
                  Peso {fmt(proposal.weight, "kg")} · Estatura {fmt(proposal.height, "cm")} ·{" "}
                  {proposal.age ?? "—"} años · TMB {fmt(proposal.bmr, "kcal")} (
                  {proposal.bmrSource === "manual" ? "manual" : "Harris-Benedict"}) · GET{" "}
                  {fmt(proposal.maintenanceCalories, "kcal")}. Los campos de abajo se rellenaron con
                  esta propuesta: revísalos y pulsa «Guardar plan» para publicarla. El alumno no ve
                  ningún cambio hasta entonces.
                </p>
              </div>
              <button
                type="button"
                className="secondary"
                onClick={discard}
                title={
                  overrideTouched
                    ? "Restaura los macros guardados. La TMB manual aplicada sigue registrada en la evaluación."
                    : "Restaura los macros guardados."
                }
              >
                Descartar propuesta
              </button>
            </div>
          )}
        </section>
      )}
      <div className="form-grid four">
        {MACROS.map((item) => {
          const changed = filled && macros[item.key] !== saved[item.key];
          return (
            <label key={item.key} className={changed ? "proposal-field" : undefined}>
              {item.label}
              <input
                name={item.key}
                type="number"
                value={macros[item.key]}
                onChange={(e) =>
                  setMacros((currentMacros) => ({ ...currentMacros, [item.key]: e.target.value }))
                }
              />
              {changed && (
                <em>
                  Propuesta · guardado:{" "}
                  {saved[item.key] ? `${saved[item.key]} ${item.unit}` : "sin plan"}
                </em>
              )}
            </label>
          );
        })}
      </div>
    </>
  );
}
