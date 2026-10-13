import { formatGoalPctLabel, formatMlAsLiters, formatPct, habitDisplay, WEEKDAYS_SHORT } from "./format";
import { usePanelStats } from "./PanelStatsContext";
import { HabitMark, PercentChip } from "./ui";
import type { HabitCell, MacroCell, MacroRanges, StudentWeekResponse, TableRow } from "./types";

const ROW_LABELS: Record<string, string> = {
  daily_total: "Adherencia diaria · total",
  training: "Entrenamientos",
  water: "Consumo de agua",
  macros: "Macros · % del día",
  calories: "Calorías",
  protein: "Proteínas",
  carbs: "Carbohidratos",
  fats: "Grasas",
};

const MACRO_UNITS: Record<string, string> = {
  calories: "kcal",
  protein: "g",
  carbs: "g",
  fats: "g",
};

const NUM = new Intl.NumberFormat("es-CL", { maximumFractionDigits: 0 });

const ROW_ORDER = [
  "daily_total",
  "training",
  "water",
  "macros",
  "calories",
  "protein",
  "carbs",
  "fats",
];

function rowLabel(row: TableRow): { title: string; sub?: string } {
  if (row.key === "water") {
    const ml = row.goal_ml;
    return {
      title: ROW_LABELS.water,
      sub: ml == null ? undefined : `Meta ${formatMlAsLiters(ml)} / día`,
    };
  }
  if (row.key === "calories" || row.key === "protein" || row.key === "carbs" || row.key === "fats") {
    const target = row.target;
    return {
      title: ROW_LABELS[row.key],
      sub: target == null ? "Sin objetivo vigente" : `Objetivo ${NUM.format(target)} ${MACRO_UNITS[row.key]}`,
    };
  }
  return { title: ROW_LABELS[row.key] || row.key };
}

function renderCell(row: TableRow, cell: TableRow["cells"][number], date: string, dayState: string) {
  if (row.key === "daily_total") {
    const total = cell as Extract<TableRow, { key: "daily_total" }>["cells"][number];
    return <PercentChip pct={total.pct} color={total.color} label={total.label} date={date} />;
  }
  const pending = (status: string) =>
    dayState === "today" && (status === "missing" || status === "not_required");
  if (row.key === "calories" || row.key === "protein" || row.key === "carbs" || row.key === "fats") {
    const macro = cell as MacroCell;
    if (macro.value == null && pending(String(macro.status))) return <HabitMark status="today" />;
    return <MacroMark cell={macro} metric={row.key} />;
  }
  const habit = cell as HabitCell;
  if (row.key === "macros") {
    if (habit.pct != null && Number.isFinite(Number(habit.pct))) {
      return (
        <span className="wp-macro-day-pct" title={habit.label || undefined}>
          <b>{formatPct(habit.pct, 0)}</b>
        </span>
      );
    }
    if (pending(String(habit.status))) return <HabitMark status="today" />;
    return <HabitMark status={habit.status} />;
  }
  if (pending(String(habit.status))) return <HabitMark status="today" />;
  // Sin plan de descansos, un día sin registro de entrenamiento no penaliza
  // (backend: not_required). Se muestra como "Sin reportar", igual que el mock.
  if (row.key === "training" && habit.status === "not_required") {
    return <HabitMark status="not_reported" />;
  }
  return <HabitMark status={habit.status} />;
}

function MacroMark({
  cell,
  metric,
}: {
  cell: MacroCell;
  metric: keyof MacroRanges;
}) {
  const { macro_ranges } = usePanelStats();
  if (cell.value == null && (cell.status === "missing" || cell.status === "not_started" || cell.status === "future" || cell.status === "today" || cell.status === "not_applicable" || cell.status === "out_of_challenge")) {
    return <HabitMark status={String(cell.status)} />;
  }
  if (cell.value == null) {
    return <HabitMark status={String(cell.status || "missing")} />;
  }
  const range = cell.in_range == null ? "" : cell.in_range ? "in-range" : "out-range";
  const bounds = macro_ranges?.[metric];
  const extra = cell as MacroCell & { display_pct?: number | null; pct_display?: number | null };
  const label =
    formatGoalPctLabel(cell.pct, {
      inRange: cell.in_range,
      minRatio: bounds?.min ?? null,
      maxRatio: bounds?.max ?? null,
      decimals: 0,
      displayPct: extra.display_pct,
      pctDisplay: extra.pct_display,
    }) || habitDisplay(cell.status).text;
  return (
    <span className={`wp-macro-cell ${range}`}>
      <b>{NUM.format(cell.value)}</b>
      <small>{label}</small>
    </span>
  );
}

export function StudentWeekTable({ data }: { data: StudentWeekResponse }) {
  const days = data.table.days;
  const byKey = new Map(data.table.rows.map((row) => [row.key, row]));
  const totalRow = data.table.rows.find(
    (row): row is Extract<TableRow, { key: "daily_total" }> => row.key === "daily_total",
  );
  const noData = !totalRow || totalRow.cells.every((cell) => cell.pct == null);

  return (
    <div className="wp-student-table-wrap">
      {noData ? (
        <p className="wp-inline-empty">Sin registros en la semana</p>
      ) : null}
      <div className="wp-student-table-scroll">
        <table className="wp-student-table">
          <thead>
            <tr>
              <th>Indicador</th>
              {days.map((day, i) => (
                <th key={day.date}>
                  {WEEKDAYS_SHORT[day.weekday] || WEEKDAYS_SHORT[i]}
                  <small>{day.date.slice(8, 10)}</small>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROW_ORDER.map((key) => {
              const row = byKey.get(key as TableRow["key"]);
              if (!row) return null;
              const label = rowLabel(row);
              return (
                <tr key={key} className={key === "daily_total" ? "wp-total-row" : undefined}>
                  <th scope="row">
                    {label.title}
                    {label.sub ? <small className="wp-row-sub">{label.sub}</small> : null}
                  </th>
                  {row.cells.map((cell, idx) => (
                    <td key={days[idx]?.date || idx}>
                      {renderCell(row, cell, days[idx]?.date || "", days[idx]?.state || "")}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
