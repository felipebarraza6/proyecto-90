import type { PanelFilter, WeekResponse } from "./types";

export function StatusFilters({
  filter,
  summary,
  onFilter,
}: {
  filter: PanelFilter;
  summary: WeekResponse["summary"];
  onFilter: (filter: PanelFilter) => void;
}) {
  const items: { id: PanelFilter; label: string; count: number }[] = [
    { id: "all", label: "Todos", count: summary.participants },
    { id: "risk", label: "En riesgo", count: summary.at_risk },
    { id: "missing", label: "Falta reportar", count: summary.missing_report },
  ];
  return (
    <div className="wp-filters filters" role="group" aria-label="Filtro de estado">
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          className={filter === item.id ? "active" : ""}
          aria-pressed={filter === item.id}
          onClick={() => onFilter(item.id)}
        >
          {item.label} <b>{item.count}</b>
        </button>
      ))}
    </div>
  );
}
