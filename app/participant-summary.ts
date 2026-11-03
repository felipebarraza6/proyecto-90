import { adherenceStagesOf, stageRows, type StageRow } from "./milestone-status.ts";

type Row = Record<string, unknown>;

function finite(value: unknown): number | null {
  if (value == null || value === "") return null;
  const num = Number(value);
  return Number.isFinite(num) ? num : null;
}

export function formatWeightTrail(person: Row): { text: string; delta: string } {
  const nums = [person.weight, person.weight_day_30, person.weight_day_60, person.weight_day_90].map(finite);
  const text = `${nums.map((num) => (num == null ? "—" : String(num))).join(" → ")} kg`;
  const start = nums[0];
  const later = nums.slice(1).filter((num): num is number => num != null);
  const last = later.length ? later[later.length - 1] : null;
  const delta = start == null || last == null ? "—" : `${last - start} kg`;
  return { text, delta };
}

function stageCell(row: StageRow): string {
  if (row.label === "Total") return `Total ${row.value}`;
  if (row.note === "en espera") return `${row.label} en espera`;
  if (row.note === "en curso") return `${row.label} ${row.value}`;
  if (row.note === "Aún no") return `${row.label} —`;
  if (row.note === "En curso" && row.value === "—") return `${row.label} En curso`;
  return `${row.label} ${row.value}`;
}

export function formatStageLine(person: Row): string {
  const rows = stageRows(finite(person.adherence_elapsed_days) ?? 0, {
    day30: finite(person.adherence_day_30),
    day60: finite(person.adherence_day_60),
    day90: finite(person.adherence_day_90),
    total: finite(person.adherence),
  }, adherenceStagesOf(person));
  return rows.map(stageCell).join(" · ");
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}

function csvNum(value: unknown): string {
  const num = finite(value);
  return num == null ? "" : String(num);
}

export function participantSummaryCsv(people: Row[]): string {
  const header = "nombre,email,dia,peso_0,peso_30,peso_60,peso_90,delta_kg,adherencia_0_30,adherencia_30_60,adherencia_60_90,adherencia_total";
  const lines = people.map((person) => {
    const name = `${String(person.first_name || "")} ${String(person.last_name || "")}`.trim();
    const trail = formatWeightTrail(person);
    const delta = trail.delta === "—" ? "" : trail.delta.replace(" kg", "");
    return [
      csvEscape(name),
      csvEscape(String(person.email || "")),
      csvNum(person.adherence_elapsed_days),
      csvNum(person.weight),
      csvNum(person.weight_day_30),
      csvNum(person.weight_day_60),
      csvNum(person.weight_day_90),
      delta,
      csvNum(person.adherence_day_30),
      csvNum(person.adherence_day_60),
      csvNum(person.adherence_day_90),
      csvNum(person.adherence),
    ].join(",");
  });
  return [header, ...lines].join("\n");
}
