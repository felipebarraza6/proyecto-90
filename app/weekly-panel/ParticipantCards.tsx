import { formatPct } from "./format";
import { usePanelStats } from "./PanelStatsContext";
import { MiniDayChips, StatusBadges } from "./ui";
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

export function ParticipantCards({
  rows,
  showEmail,
  onOpen,
}: {
  rows: PanelRow[];
  showEmail: boolean;
  onOpen: (clientId: number) => void;
}) {
  const { percent_decimals } = usePanelStats();
  return (
    <ul className="wp-cards">
      {rows.map((row) => (
        <li key={row.client_id}>
          <button type="button" className="wp-card" onClick={() => onOpen(row.client_id)}>
            <header>
              <span className="avatar">{initials(row.name)}</span>
              <span>
                <b>{row.name || row.email}</b>
                {showEmail ? <small>{row.email}</small> : null}
              </span>
              <strong className={`wp-week-pct ${row.weekly.color}`}>
                {formatPct(row.weekly.pct, percent_decimals)}
              </strong>
            </header>
            <MiniDayChips days={row.days} />
            <StatusBadges status={row.status} />
          </button>
        </li>
      ))}
    </ul>
  );
}
