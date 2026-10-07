import type { HabitStatus, SemaforoColor } from "./types";

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

const DATE_TIME: Intl.DateTimeFormatOptions = {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "America/Santiago",
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

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("es-CL", DATE_TIME);
}

export function formatPct(value: number | null | undefined): string {
  if (value == null || Number.isNaN(Number(value))) return "—";
  const n = Number(value);
  const formatted = new Intl.NumberFormat("es-CL", {
    minimumFractionDigits: Number.isInteger(n) ? 0 : 1,
    maximumFractionDigits: 1,
  }).format(n);
  return `${formatted} %`;
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
  missing: { icon: "○", text: "Sin reportar", kind: "missing" },
  rest: { icon: "D", text: "Descanso", kind: "rest" },
  not_required: { icon: "—", text: "No aplica", kind: "na" },
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

export function chipAriaLabel(day: {
  date: string;
  pct: number | null;
  label: string;
}): string {
  const head = formatDayShort(day.date);
  const pct = formatPct(day.pct);
  return `${head}: ${pct}, ${day.label}`;
}

export function draftStorageKey(staffUserId: string, clientId: number): string {
  return `p90_draft_${staffUserId}_${clientId}`;
}
