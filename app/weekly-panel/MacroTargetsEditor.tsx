import { useEffect, useState } from "react";
import { fetchMacroTargets, saveMacroTarget } from "./api";
import {
  MACRO_PERIODS,
  buildMacroTargetSaveBody,
  type MacroPeriodKey,
} from "./macroScore";
import {
  effectiveDateLabel,
  goalPeriodLabel,
  periodStartFromChallenge,
  sortMacroTargetHistory,
} from "./macroEffective";
import type { MacroTargetRecord } from "./types";

type Draft = {
  /** "" = sin tramo: la meta rige solo por «Vigente desde». */
  period: "" | MacroPeriodKey;
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

function toNum(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function emptyDraft(): Draft {
  return {
    period: "",
    calories: "",
    protein: "",
    carbs: "",
    fats: "",
    effective_from: todayIso(),
    note: "",
  };
}

/**
 * Metas por fecha vía GET/POST /api/p90/panel/participants/{id}/macro-targets.
 * El tramo (1–30 / 31–60 / 61–90) es un atajo opcional: sin tramo la meta
 * rige desde «Vigente desde» y el backend resuelve la más reciente ≤ fecha.
 */
export function MacroTargetsEditor({
  clientId,
  challengeStart,
  onSaved,
}: {
  clientId: number;
  /** Día 1 del desafío: al elegir tramo se autocompleta su fecha de inicio. */
  challengeStart?: string | null;
  onSaved?: () => void;
}) {
  const [items, setItems] = useState<MacroTargetRecord[]>([]);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
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
        setItems(res.items);
      })
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "No fue posible cargar las metas por fecha");
        setItems([]);
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [clientId]);

  function setField(field: keyof Draft, value: string) {
    setDraft((prev) => ({ ...prev, [field]: value }));
    setOk(false);
  }

  function changePeriod(value: string) {
    setDraft((prev) => {
      const period = value as Draft["period"];
      const suggested = period ? periodStartFromChallenge(challengeStart, period) : "";
      return {
        ...prev,
        period,
        effective_from: suggested || prev.effective_from,
      };
    });
    setOk(false);
  }

  async function save() {
    if (saving || !canEdit) return;
    setSaving(true);
    setError("");
    setOk(false);
    const body = buildMacroTargetSaveBody({
      period: draft.period || null,
      calories: toNum(draft.calories),
      protein: toNum(draft.protein),
      carbs: toNum(draft.carbs),
      fats: toNum(draft.fats),
      effective_from: draft.effective_from.trim() || null,
      note: draft.note.trim() || null,
    });
    if (!body) {
      setError("Indica «Vigente desde», calorías y proteína para guardar la meta.");
      setSaving(false);
      return;
    }
    try {
      // Un solo POST por guardado: evita el doble ingreso de metas.
      const saved = await saveMacroTarget(clientId, body);
      const row = (saved && "item" in saved ? saved.item : saved) as MacroTargetRecord | undefined;
      if (row && row.effective_from) {
        setItems((prev) => [...prev.filter((item) => item.id !== row.id), row]);
      } else {
        const refreshed = await fetchMacroTargets(clientId);
        setItems(refreshed.items);
      }
      setDraft((prev) => ({ ...emptyDraft(), effective_from: prev.effective_from }));
      setOk(true);
      onSaved?.();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "No fue posible guardar la meta");
    } finally {
      setSaving(false);
    }
  }

  const history = sortMacroTargetHistory(items);

  return (
    <section className="macro-period-targets">
      <header>
        <div>
          <span className="eyebrow">METAS POR FECHA</span>
          <h4>Objetivos de macros por fecha de vigencia</h4>
          <p>
            Guarda la meta desde el día que empieza a regir. El tramo 1–30 / 31–60 / 61–90 es
            opcional: si lo eliges, se autocompleta la fecha de inicio del tramo y puedes
            ajustarla. El historial conserva las metas anteriores.
          </p>
        </div>
      </header>
      {loading ? <p className="wp-habit-hint">Cargando metas…</p> : null}
      {!loading && !canEdit ? (
        <p className="wp-readonly-note">Solo lectura: no puedes editar las metas de este alumno.</p>
      ) : null}
      {!loading && canEdit ? (
        <div className="macro-target-form">
          <div className="macro-period-head">
            <label>
              Vigente desde
              <input
                type="date"
                value={draft.effective_from}
                onChange={(e) => setField("effective_from", e.target.value)}
                disabled={saving}
                aria-label="Vigente desde"
                required
              />
            </label>
            <label>
              Tramo (opcional)
              <select
                value={draft.period}
                onChange={(e) => changePeriod(e.target.value)}
                disabled={saving}
                aria-label="Tramo (opcional)"
              >
                <option value="">Sin tramo · solo fecha</option>
                {MACRO_PERIODS.map((meta) => (
                  <option key={meta.period} value={meta.period}>
                    {meta.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="form-grid four">
            {FIELDS.map((item) => (
              <label key={item.key}>
                {item.label} ({item.unit})
                <input
                  type="number"
                  value={draft[item.key]}
                  onChange={(e) => setField(item.key, e.target.value)}
                  disabled={saving}
                />
              </label>
            ))}
          </div>
          <label>
            Nota (opcional)
            <input
              type="text"
              value={draft.note}
              onChange={(e) => setField("note", e.target.value)}
              disabled={saving}
            />
          </label>
        </div>
      ) : null}
      {error ? (
        <p className="upload-error" role="alert">
          {error}
        </p>
      ) : null}
      {ok ? <p className="wp-sent">Meta guardada</p> : null}
      {canEdit ? (
        <button
          type="button"
          className="primary"
          disabled={loading || saving}
          onClick={() => void save()}
        >
          {saving ? "Guardando…" : "Guardar meta"}
        </button>
      ) : null}
      <MacroTargetHistory items={history} loading={loading} />
    </section>
  );
}

/** Historial de metas guardadas (tramos anteriores y metas solo por fecha). */
export function MacroTargetHistory({
  clientId,
  items: providedItems,
  loading: providedLoading,
  title = "Historial de metas",
}: {
  clientId?: number;
  items?: MacroTargetRecord[];
  loading?: boolean;
  title?: string;
}) {
  const hasProvidedItems = providedItems !== undefined;
  const [fetched, setFetched] = useState<MacroTargetRecord[]>([]);
  const [fetching, setFetching] = useState(clientId != null && !hasProvidedItems);
  const [error, setError] = useState("");

  useEffect(() => {
    if (hasProvidedItems) return;
    if (clientId == null) {
      setFetched([]);
      setFetching(false);
      return;
    }
    const ac = new AbortController();
    setFetching(true);
    setError("");
    fetchMacroTargets(clientId, ac.signal)
      .then((res) => setFetched(res.items))
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setError("No fue posible cargar el historial de metas");
        setFetched([]);
      })
      .finally(() => setFetching(false));
    return () => ac.abort();
  }, [clientId, hasProvidedItems]);

  const items = hasProvidedItems ? providedItems : fetched;
  const loading = hasProvidedItems ? providedLoading ?? false : fetching;
  const history = sortMacroTargetHistory(items);

  return (
    <section className="macro-target-history" aria-label={title}>
      <header>
        <span className="eyebrow">HISTORIAL</span>
        <h4>{title}</h4>
      </header>
      {loading ? <p className="wp-habit-hint">Cargando historial…</p> : null}
      {error ? <p className="wp-readonly-note">{error}</p> : null}
      {!loading && history.length === 0 ? (
        <p className="wp-habit-hint">Sin metas anteriores registradas.</p>
      ) : null}
      {history.length > 0 ? (
        <ul className="macro-target-history-list">
          {history.map((row, index) => (
            <li key={`${row.id ?? row.period ?? "meta"}-${row.effective_from ?? index}`}>
              <div>
                <b>{goalPeriodLabel(row)}</b>
                {row.period ? (
                  <small>Vigente desde {effectiveDateLabel(row.effective_from)}</small>
                ) : null}
              </div>
              <span>
                {row.calories ?? "—"} kcal · {row.protein ?? "—"} g proteína
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
