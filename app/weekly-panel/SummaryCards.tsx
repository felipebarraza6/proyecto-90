import { formatPct } from "./format";
import type { PanelFilter, WeekResponse } from "./types";

export function SummaryCards({
  summary,
  filter,
  onFilter,
}: {
  summary: WeekResponse["summary"];
  filter: PanelFilter;
  onFilter: (filter: PanelFilter) => void;
}) {
  const cards: {
    key: PanelFilter | "avg";
    filter: PanelFilter;
    label: string;
    value: string;
    note: string;
    tone: string;
  }[] = [
    {
      key: "all",
      filter: "all",
      label: "Participantes",
      value: String(summary.participants),
      note: "Incluidos en la semana",
      tone: "",
    },
    {
      key: "avg",
      filter: "all",
      label: "Adherencia semanal",
      value: formatPct(summary.weekly_avg),
      note: "Promedio por alumno con dato",
      tone: "",
    },
    {
      key: "risk",
      filter: "risk",
      label: "En riesgo",
      value: String(summary.at_risk),
      note: "Semanal bajo el umbral",
      tone: "red",
    },
    {
      key: "missing",
      filter: "missing",
      label: "Falta reportar",
      value: String(summary.missing_report),
      note: "Días exigibles sin registro",
      tone: "yellow",
    },
  ];

  return (
    <section className="wp-summary" aria-label="Resumen de la semana">
      {cards.map((card) => (
        <button
          key={card.label}
          type="button"
          className={`wp-summary-card ${card.tone} ${filter === card.filter && card.key !== "avg" ? "active" : ""}`}
          onClick={() => onFilter(card.filter)}
        >
          <span>{card.label}</span>
          <strong>{card.value}</strong>
          <small>{card.note}</small>
        </button>
      ))}
    </section>
  );
}
