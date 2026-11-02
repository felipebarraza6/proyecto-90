export type StageLabel = "0–30" | "30–60" | "60–90" | "Total";
export type StageNote = "En curso" | "Completado" | "Aún no" | "0–hoy";

export type StageAdherence = {
  day30: number | null;
  day60: number | null;
  day90: number | null;
  total: number | null;
};

export type StageRow = {
  label: StageLabel;
  value: string;
  note: StageNote;
};

const STAGE_BOUNDS: Array<{ label: Exclude<StageLabel, "Total">; start: number; end: number; key: keyof StageAdherence }> = [
  { label: "0–30", start: 1, end: 30, key: "day30" },
  { label: "30–60", start: 31, end: 60, key: "day60" },
  { label: "60–90", start: 61, end: 90, key: "day90" },
];

function formatPct(value: number | null): string {
  if (value == null || !Number.isFinite(value)) return "—";
  return `${Math.round(value)}%`;
}

export function missingWeightNotice(
  currentDay: number,
  weightsByDay: Record<number, number | null | undefined>,
  milestoneDays: number[],
): string | null {
  const vigente = milestoneDays.filter((day) => day <= currentDay).sort((a, b) => b - a)[0];
  if (vigente == null) return null;
  const weight = weightsByDay[vigente];
  if (weight == null) return `Registra tu peso del día ${vigente}`;
  return null;
}

export function stageRows(currentDay: number, adherence: StageAdherence): StageRow[] {
  const stages: StageRow[] = STAGE_BOUNDS.map((stage) => {
    const pct = adherence[stage.key];
    if (currentDay < stage.start) return { label: stage.label, value: "—", note: "Aún no" };
    if (currentDay > stage.end) return { label: stage.label, value: formatPct(pct), note: "Completado" };
    return { label: stage.label, value: formatPct(pct), note: "En curso" };
  });
  return [...stages, { label: "Total", value: formatPct(adherence.total), note: "0–hoy" }];
}
