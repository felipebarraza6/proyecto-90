import { formatPct, WEEKDAYS_SHORT } from "./format";
import { usePanelStats } from "./PanelStatsContext";
import { PercentChip, StatusBadges } from "./ui";
import type { PanelRow } from "./types";

function initials(name: string): string {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase())
      .join("") || "90"
  );
}

export function WeeklyTable({
  rows,
  showEmail,
  onOpen,
}: {
  rows: PanelRow[];
  showEmail: boolean;
  onOpen: (clientId: number) => void;
}) {
  const { percent_decimals, thresholds } = usePanelStats();
  return (
    <div className="table-card wp-table-wrap">
      <table className="wp-table">
        <thead>
          <tr>
            <th>Alumno</th>
            {WEEKDAYS_SHORT.map((d) => (
              <th key={d}>{d}</th>
            ))}
            <th>Semana</th>
            <th>Estado</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.client_id}
              role="button"
              tabIndex={0}
              onClick={() => onOpen(row.client_id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  onOpen(row.client_id);
                }
              }}
            >
              <td>
                <div className="person">
                  <span className="avatar">{initials(row.name)}</span>
                  <div>
                    <button
                      type="button"
                      className="wp-name-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpen(row.client_id);
                      }}
                    >
                      {row.name || row.email}
                    </button>
                    {showEmail ? <small>{row.email}</small> : null}
                  </div>
                </div>
              </td>
              {row.days.map((day) => (
                <td key={day.date}>
                  <PercentChip
                    pct={day.pct}
                    color={day.color}
                    label={day.label}
                    date={day.date}
                    onOpen={() => onOpen(row.client_id)}
                  />
                </td>
              ))}
              <td>
                <button
                  type="button"
                  className={`wp-week-pct ${row.weekly.color}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onOpen(row.client_id);
                  }}
                >
                  {formatPct(row.weekly.pct, percent_decimals, { color: String(row.weekly.color), greenGt: thresholds.green_gt, yellowGte: thresholds.yellow_gte })}
                </button>
              </td>
              <td>
                <StatusBadges status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
