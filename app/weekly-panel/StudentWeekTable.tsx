import { formatPct, habitDisplay, WEEKDAYS_SHORT } from "./format";
import { HabitMark, PercentChip } from "./ui";
import type { MacroCell, StudentWeekResponse, TableRow } from "./types";

const ROW_LABELS: Record<string, string> = {
  daily_total: "Adherencia diaria · total",
  training: "Entrenamientos",
  water: "Consumo de agua",
  macros: "Macros",
  calories: "Calorías",
  protein: "Proteínas",
  carbs: "Carbohidratos",
  fats: "Grasas",
};

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

function waterLabel(row: TableRow): string {
  if (row.key !== "water") return ROW_LABELS.water;
  const ml = row.goal_ml;
  if (ml == null) return ROW_LABELS.water;
  return `${ROW_LABELS.water} (${ml} ml)`;
}

function renderCell(row: TableRow, cell: TableRow["cells"][number], date: string) {
  if (row.key === "daily_total") {
    const total = cell as Extract<TableRow, { key: "daily_total" }>["cells"][number];
    return <PercentChip pct={total.pct} color={total.color} label={total.label} date={date} />;
  }
  if (row.key === "calories" || row.key === "protein" || row.key === "carbs" || row.key === "fats") {
    return <MacroMark cell={cell as MacroCell} />;
  }
  const habit = cell as { status: string };
  return <HabitMark status={habit.status} />;
}

function MacroMark({ cell }: { cell: MacroCell }) {
  if (cell.value == null && (cell.status === "missing" || cell.status === "not_started" || cell.status === "future" || cell.status === "today" || cell.status === "not_applicable" || cell.status === "out_of_challenge")) {
    return <HabitMark status={String(cell.status)} />;
  }
  if (cell.value == null) {
    return <HabitMark status={String(cell.status || "missing")} />;
  }
  const range = cell.in_range == null ? "" : cell.in_range ? "in-range" : "out-range";
  const pct = formatPct(cell.pct);
  const display = habitDisplay(cell.status);
  return (
    <span className={`wp-macro-cell ${range}`}>
      <b>
        {cell.value}
        {cell.pct != null ? <i> · {pct}</i> : null}
      </b>
      <small>{cell.in_range == null ? display.text : cell.in_range ? "En rango" : "Fuera de rango"}</small>
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
              const label = key === "water" ? waterLabel(row) : ROW_LABELS[key] || key;
              return (
                <tr key={key} className={key === "daily_total" ? "wp-total-row" : undefined}>
                  <th scope="row">{label}</th>
                  {row.cells.map((cell, idx) => (
                    <td key={days[idx]?.date || idx}>
                      {renderCell(row, cell, days[idx]?.date || "")}
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
