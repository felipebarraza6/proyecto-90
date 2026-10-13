import { useEffect, useState } from "react";
import { fetchMacroTargets, saveMacroTarget } from "./api";
import {
  MACRO_PERIODS,
  carryForwardMacroPeriods,
  type MacroPeriodKey,
} from "./macroScore";
import type { MacroTargetRecord } from "./types";

type Draft = {
  period: MacroPeriodKey;
  label: string;
  calories: string;
  protein: string;
  carbs: string;
  fats: string;
  effective_from: string;
  note: string;
};

const FIELDS = [
  { key: "calories" as const, label: "Calorías", unit: "kcal" },
  { key: "protein" as const, label: "Proteína", unit: "g" },
  { key: "carbs" as const, label: "Carbos", unit: "g" },
  { key: "fats" as const, label: "Grasas", unit: "g" },
];

function text(value: unknown) {
  return value == null ? "" : String(value);
}

function toNum(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function draftsFromItems(items: MacroTargetRecord[]): Draft[] {
  const byPeriod = new Map<string, MacroTargetRecord>();
  for (const item of items) {
    if (item?.period) byPeriod.set(String(item.period), item);
  }
  return MACRO_PERIODS.map((meta) => {
    const saved = byPeriod.get(meta.period);
    return {
      period: meta.period,
      label: meta.label,
      calories: text(saved?.calories),
      protein: text(saved?.protein),
      carbs: text(saved?.carbs),
      fats: text(saved?.fats),
      effective_from: text(saved?.effective_from).slice(0, 10),
      note: text(saved?.note),
    };
  });
}

function emptyDrafts(): Draft[] {
  return MACRO_PERIODS.map((meta) => ({
    period: meta.period,
    label: meta.label,
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
    effective_from: "",
    note: "",
  }));
}

/**
 * Metas por tramo vía GET/POST /api/p90/panel/participants/{id}/macro-targets.
 * Vacío = arrastra el tramo anterior al guardar.
 */
export function MacroTargetsEditor({
  clientId,
  onSaved,
}: {
  clientId: number;
  onSaved?: () => void;
}) {
  const [drafts, setDrafts] = useState<Draft[]>(emptyDrafts);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [canEdit, setCanEdit] = useState(true);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError("");
    setOk(false);
    fetchMacroTargets(clientId, ac.signal)
      .then((res) => {
        setCanEdit(res.can_edit !== false);
        setDrafts(draftsFromItems(res.items));
      })
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "No fue posible cargar las metas por tramo");
        setDrafts(emptyDrafts());
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [clientId]);

  function setField(index: number, field: keyof Draft, value: string) {
    setDrafts((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
    setOk(false);
  }

  async function save() {
    if (saving || !canEdit) return;
    setSaving(true);
    setError("");
    setOk(false);
    const carried = carryForwardMacroPeriods(
      drafts.map((row) => ({
        calories: toNum(row.calories),
        protein: toNum(row.protein),
        carbs: toNum(row.carbs),
        fats: toNum(row.fats),
        effective_from: row.effective_from.trim() || null,
      })),
    );
    try {
      for (let i = 0; i < drafts.length; i++) {
        const draft = drafts[i];
        const effective = carried[i];
        const calories = effective?.calories;
        const protein = effective?.protein;
        if (calories == null || protein == null) continue;
        await saveMacroTarget(clientId, {
          period: draft.period,
          calories,
          protein,
          carbs: effective?.carbs ?? null,
          fats: effective?.fats ?? null,
          effective_from: draft.effective_from.trim() || effective?.effective_from || null,
          note: draft.note.trim() || null,
        });
      }
      setOk(true);
      onSaved?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No fue posible guardar las metas");
    } finally {
      setSaving(false);
    }
  }

  const carried = carryForwardMacroPeriods(
    drafts.map((row) => ({
      calories: toNum(row.calories),
      protein: toNum(row.protein),
      carbs: toNum(row.carbs),
      fats: toNum(row.fats),
      effective_from: row.effective_from.trim() || null,
    })),
  );

  return (
    <section className="macro-period-targets">
      <header>
        <div>
          <span className="eyebrow">METAS POR TRAMO</span>
          <h4>Objetivos de macros (1–30 · 31–60 · 61–90)</h4>
          <p>
            Si dejas un tramo vacío, se mantiene el anterior. Cada fecha «Vigente desde» rige desde
            ese día, sin recalcular el historial previo.
          </p>
        </div>
      </header>
      {loading ? <p className="wp-habit-hint">Cargando metas…</p> : null}
      {!loading && !canEdit ? (
        <p className="wp-readonly-note">Solo lectura: no puedes editar las metas de este alumno.</p>
      ) : null}
      <div className="macro-period-rows">
        {drafts.map((row, index) => {
          const effective = carried[index];
          return (
            <article key={row.period} className="macro-period-row">
              <div className="macro-period-head">
                <b>{row.label}</b>
                <label>
                  Vigente desde
                  <input
                    type="date"
                    value={row.effective_from}
                    onChange={(e) => setField(index, "effective_from", e.target.value)}
                    disabled={loading || saving || !canEdit}
                    aria-label={`Vigente desde · ${row.label}`}
                  />
                </label>
              </div>
              <div className="form-grid four">
                {FIELDS.map((item) => (
                  <label key={item.key}>
                    {item.label} ({item.unit})
                    <input
                      type="number"
                      value={row[item.key]}
                      placeholder={
                        index > 0 && effective?.[item.key] != null
                          ? `Arrastra ${effective[item.key]}`
                          : undefined
                      }
                      onChange={(e) => setField(index, item.key, e.target.value)}
                      disabled={loading || saving || !canEdit}
                    />
                    {!row[item.key].trim() && index > 0 && effective?.[item.key] != null ? (
                      <em>
                        Vacío = arrastra {effective[item.key]} {item.unit}
                      </em>
                    ) : null}
                  </label>
                ))}
              </div>
              <label>
                Nota (opcional)
                <input
                  type="text"
                  value={row.note}
                  onChange={(e) => setField(index, "note", e.target.value)}
                  disabled={loading || saving || !canEdit}
                />
              </label>
            </article>
          );
        })}
      </div>
      {error ? (
        <p className="upload-error" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? <p className="wp-sent">Metas por tramo guardadas</p> : null}
      {canEdit ? (
        <button type="button" className="primary" disabled={loading || saving} onClick={() => void save()}>
          {saving ? "Guardando…" : "Guardar metas por tramo"}
        </button>
      ) : null}
    </section>
  );
}
