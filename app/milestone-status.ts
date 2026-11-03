export type StageLabel = "0–30" | "30–60" | "60–90" | "Total";
export type StageNote = "En curso" | "Completado" | "Aún no" | "0–hoy" | "en curso" | "en espera";

export type AdherenceStageStatus = "done" | "current" | "locked";

export type AdherenceStageInput = {
  day?: unknown;
  start?: unknown;
  end?: unknown;
  pct?: unknown;
  status?: unknown;
};

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

const STAGE_DAYS = [30, 60, 90] as const;

function finiteNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

function stageStatus(value: unknown): AdherenceStageStatus | null {
  if (value === "done" || value === "current" || value === "locked") return value;
  return null;
}

/** Stages from `adherence_stages`, or from `adherence_day_N_partial` when the array is absent. */
export function adherenceStagesOf(person: Record<string, unknown>): AdherenceStageInput[] | null {
  const raw = person.adherence_stages;
  if (Array.isArray(raw) && raw.length > 0) return raw as AdherenceStageInput[];
  const partialDay = STAGE_DAYS.find((day) => person[`adherence_day_${day}_partial`] === true);
  if (partialDay == null) return null;
  return STAGE_DAYS.map((day) => ({
    day,
    end: day,
    pct: person[`adherence_day_${day}`],
    status: day === partialDay ? "current" : day < partialDay ? "done" : "locked",
  }));
}

export function stageForMilestone(stages: AdherenceStageInput[] | null | undefined, day: number): AdherenceStageInput | undefined {
  if (!stages) return undefined;
  return stages.find((stage) => Number(stage.day) === day || Number(stage.end) === day);
}

/** Adherence text for one milestone day. Legacy `%` / `—` when the new fields are missing. */
export function formatMilestoneAdherence(
  person: Record<string, unknown>,
  day: number,
  currentDay?: number,
): string {
  const stage = stageForMilestone(adherenceStagesOf(person), day);
  const status = stageStatus(stage?.status);
  const pct = finiteNumber(stage && stage.pct != null && stage.pct !== "" ? stage.pct : person[`adherence_day_${day}`]);
  if (status === "locked") return "en espera";
  if (status === "current" || person[`adherence_day_${day}_partial`] === true) {
    return pct == null ? "en curso" : `${Math.round(pct)}% en curso`;
  }
  if (status === "done") return formatPct(pct);
  const unlocked = day === 0 || (currentDay != null && currentDay >= day);
  if (unlocked && pct != null) return `${Math.round(pct)}%`;
  return "—";
}

export function stageRows(
  currentDay: number,
  adherence: StageAdherence,
  stages?: AdherenceStageInput[] | null,
): StageRow[] {
  const rows: StageRow[] = STAGE_BOUNDS.map((stage) => {
    const fromApi = stageForMilestone(stages, stage.end);
    const status = stageStatus(fromApi?.status);
    const pct = fromApi && fromApi.pct != null && fromApi.pct !== ""
      ? finiteNumber(fromApi.pct)
      : adherence[stage.key];
    if (status === "locked") return { label: stage.label, value: "en espera", note: "en espera" };
    if (status === "current") {
      return { label: stage.label, value: formatPct(pct), note: "en curso" };
    }
    if (status === "done") return { label: stage.label, value: formatPct(pct), note: "Completado" };
    if (currentDay < stage.start) return { label: stage.label, value: "—", note: "Aún no" };
    if (currentDay > stage.end) return { label: stage.label, value: formatPct(pct), note: "Completado" };
    return { label: stage.label, value: formatPct(pct), note: "En curso" };
  });
  return [...rows, { label: "Total", value: formatPct(adherence.total), note: "0–hoy" }];
}
