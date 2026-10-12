import type { HabitStatus, SemaforoColor } from "./types";

/** Alineado a PANEL_CONFIG_DEFAULTS (sin import, para tests Node ESM). */
const FALLBACK_GREEN_GT = 80;
const FALLBACK_YELLOW_GTE = 70;
const FALLBACK_PCT_DECIMALS = 1;
const FALLBACK_TZ = "America/Santiago";

export const WEEKDAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

const DATE_ONLY: Intl.DateTimeFormatOptions = {
  day: "numeric",
  month: "short",
  timeZone: "UTC",
};

const DATE_NUM: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  timeZone: "UTC",
};

export function parseISODate(iso: string): Date {
  return new Date(`${String(iso).slice(0, 10)}T12:00:00Z`);
}

export function formatDayShort(iso: string): string {
  const d = parseISODate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const weekday = WEEKDAYS_SHORT[d.getUTCDay() === 0 ? 6 : d.getUTCDay() - 1];
  const rest = d.toLocaleDateString("es-CL", DATE_ONLY).replace(".", "");
  return `${weekday} ${rest}`;
}

export function formatDateShort(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseISODate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CL", DATE_NUM);
}

export function formatDateLong(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = parseISODate(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("es-CL", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatDateTime(
  iso: string | null | undefined,
  timezone?: string | null,
): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const tz = (timezone && String(timezone).trim()) || FALLBACK_TZ;
  return d.toLocaleString("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: tz,
  });
}

/**
 * Redondea un % (escala 0–100) para que el número mostrado no contradiga
 * el semáforo o el cumplimiento cerca del umbral.
 * Ej.: 89,51 % fuera de rango con mínimo 90 % → muestra 89, no 90.
 */
export function alignPctDisplay(
  value: number,
  decimals: number,
  align?: {
    color?: string;
    greenGt?: number;
    yellowGte?: number;
    inRange?: boolean | null;
    minRatio?: number | null;
    maxRatio?: number | null;
  },
): number {
  const places = Math.max(0, Math.min(2, Math.round(Number(decimals) || 0)));
  const factor = 10 ** places;
  const step = 1 / factor;
  let n = Number(value);
  if (!Number.isFinite(n)) return n;

  const roundNearest = () => Math.round(n * factor) / factor;

  if (align?.inRange != null) {
    const minPct = align.minRatio == null ? null : align.minRatio * 100;
    const maxPct = align.maxRatio == null ? null : align.maxRatio * 100;
    if (align.inRange === false) {
      if (minPct != null && n < minPct + 1e-9) {
        n = Math.floor(n * factor + 1e-9) / factor;
        if (n >= minPct) n = Math.max(0, minPct - step);
        return n;
      }
      if (maxPct != null && n > maxPct - 1e-9) {
        n = Math.ceil(n * factor - 1e-9) / factor;
        if (n <= maxPct) n = maxPct + step;
        return n;
      }
      return roundNearest();
    }
    // in range: no mostrar un entero/decimal que caiga fuera del rango
    n = roundNearest();
    if (minPct != null && n < minPct) n = minPct;
    if (maxPct != null && n > maxPct) n = maxPct;
    return n;
  }

  const color = align?.color;
  const greenGt = align?.greenGt ?? FALLBACK_GREEN_GT;
  const yellowGte = align?.yellowGte ?? FALLBACK_YELLOW_GTE;
  if (color === "red") {
    n = Math.floor(n * factor + 1e-9) / factor;
    if (n >= yellowGte) n = Math.max(0, yellowGte - step);
    return n;
  }
  if (color === "yellow") {
    n = roundNearest();
    if (n < yellowGte) n = yellowGte;
    if (n > greenGt) n = greenGt;
    return n;
  }
  if (color === "green") {
    n = roundNearest();
    // Verde es estrictamente > green_gt en el panel.
    if (n <= greenGt && value > greenGt) n = Math.ceil(value * factor - 1e-9) / factor;
    if (n <= greenGt && value > greenGt) n = greenGt + step;
    return n;
  }
  return roundNearest();
}

export function formatPct(
  value: number | null | undefined,
  decimals: number = FALLBACK_PCT_DECIMALS,
  align?: Parameters<typeof alignPctDisplay>[2],
): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const max = Math.max(0, Math.min(2, Math.round(Number(decimals) || 0)));
  const n = alignPctDisplay(Number(value), max, align);
  const formatted = new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: Number.isInteger(n) && max > 0 ? 0 : Math.min(max, 1),
    maximumFractionDigits: max,
  }).format(n);
  return `${formatted} %`;
}

/** Texto «N% del objetivo» alineado con in_range / umbrales de macros. */
export function formatGoalPctLabel(
  pct: number | null | undefined,
  options?: {
    inRange?: boolean | null;
    minRatio?: number | null;
    maxRatio?: number | null;
    decimals?: number;
    /** Campos opcionales futuros del backend. */
    displayPct?: number | null;
    pctDisplay?: number | null;
  },
): string | null {
  const preferred = options?.displayPct ?? options?.pctDisplay;
  const raw = preferred != null ? preferred : pct;
  if (raw == null || !Number.isFinite(Number(raw))) return null;
  const decimals = options?.decimals ?? 0;
  const n = alignPctDisplay(Number(raw), decimals, {
    inRange: options?.inRange,
    minRatio: options?.minRatio,
    maxRatio: options?.maxRatio,
  });
  const formatted = new Intl.NumberFormat("es-CL", {
    maximumFractionDigits: decimals,
    minimumFractionDigits: 0,
  }).format(n);
  return `${formatted}% del objetivo`;
}

export function formatKg(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  return `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 1 }).format(Number(value))} kg`;
}

export function formatMlAsLiters(ml: number | null | undefined): string {
  if (ml == null || Number.isNaN(Number(ml))) return "—";
  const liters = Number(ml) / 1000;
  return `${new Intl.NumberFormat("es-CL", { maximumFractionDigits: 2 }).format(liters)} L`;
}

export function colorClass(color: SemaforoColor | string | undefined): string {
  if (color === "green" || color === "yellow" || color === "red" || color === "neutral") {
    return color;
  }
  return "neutral";
}

export type HabitDisplay = { icon: string; text: string; kind: string };

const HABIT_DISPLAY: Record<string, HabitDisplay> = {
  met: { icon: "✓", text: "Cumplió", kind: "met" },
  missed: { icon: "✗", text: "No cumplió", kind: "missed" },
  missing: { icon: "—", text: "Sin reportar", kind: "missing" },
  rest: { icon: "D", text: "Descanso", kind: "rest" },
  not_required: { icon: "—", text: "No aplica", kind: "na" },
  not_reported: { icon: "—", text: "Sin reportar", kind: "missing" },
  not_applicable: { icon: "—", text: "No aplica", kind: "na" },
  not_started: { icon: "◌", text: "No iniciado", kind: "wait" },
  future: { icon: "◌", text: "Día futuro", kind: "wait" },
  today: { icon: "●", text: "Hoy", kind: "today" },
  out_of_challenge: { icon: "—", text: "Fuera del desafío", kind: "na" },
  due: { icon: "○", text: "Exigible", kind: "missing" },
};

export function habitDisplay(status: HabitStatus | string | undefined): HabitDisplay {
  if (!status) return { icon: "—", text: "—", kind: "na" };
  return HABIT_DISPLAY[status] || { icon: "·", text: String(status), kind: "wait" };
}

export function statusLabel(code: string): string {
  if (code === "missing_report") return "Falta reportar";
  if (code === "at_risk") return "En riesgo";
  if (code === "no_due_days") return "Sin datos aún";
  return code;
}

export function studentStatusLabels(status: string[]): { code: string; label: string }[] {
  if (!status.length) return [{ code: "ok", label: "Sin alerta" }];
  if (status.length === 1 && status[0] === "no_due_days") {
    return [{ code: "no_due_days", label: "Sin datos aún" }];
  }
  const badges = status
    .filter((code) => code === "missing_report" || code === "at_risk")
    .map((code) => ({ code, label: statusLabel(code) }));
  if (!badges.length) return [{ code: "ok", label: "Sin alerta" }];
  return badges;
}

export function chipAriaLabel(
  day: {
    date: string;
    pct: number | null;
    label: string;
    color?: string;
  },
  decimals: number = FALLBACK_PCT_DECIMALS,
  thresholds: { green_gt: number; yellow_gte: number } = {
    green_gt: FALLBACK_GREEN_GT,
    yellow_gte: FALLBACK_YELLOW_GTE,
  },
): string {
  const head = formatDayShort(day.date);
  const pct = formatPct(day.pct, decimals, {
    color: day.color,
    greenGt: thresholds.green_gt,
    yellowGte: thresholds.yellow_gte,
  });
  return `${head}: ${pct}, ${day.label}`;
}

export function draftStorageKey(staffUserId: string, clientId: number): string {
  return `p90_draft_${staffUserId}_${clientId}`;
}
