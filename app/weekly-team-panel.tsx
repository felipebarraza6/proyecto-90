"use client";

import { useEffect, useState } from "react";
import { apiUrl, authHeaders } from "../src/api";

type PanelConfig = {
  panel_enabled: boolean;
  show_summary_cards: boolean;
  show_email_in_table: boolean;
};

type PanelWeekOption = { start: string; end: string; label: string };
type PanelWeeksResponse = { current: string; weeks: PanelWeekOption[] };
type PanelDay = { date: string; state: string; pct: number | null; color: string; label: string };
type PanelRow = {
  client_id: string | number;
  name: string;
  email?: string;
  days: PanelDay[];
  weekly: { pct: number | null; color: string };
  status: string[];
};
type PanelWeekResponse = {
  week: { start: string; end: string; label: string; is_current: boolean };
  summary: { participants: number; weekly_avg: number | null; at_risk: number; missing_report: number };
  rows: PanelRow[];
  empty_reason: "no_participants" | "no_match_filter" | null;
};
type PanelFilter = "all" | "risk" | "missing";

class PanelRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function getPanelData<T>(path: string, signal: AbortSignal): Promise<T> {
  const response = await fetch(apiUrl(path), {
    headers: authHeaders(),
    cache: "no-store",
    signal,
  });
  const payload = await response.json().catch(() => null) as { error?: string; detail?: string } | null;
  if (!response.ok) {
    throw new PanelRequestError(response.status, payload?.error || payload?.detail || `Error ${response.status}`);
  }
  return payload as T;
}

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function formatPercent(value: number | null): string {
  return value == null ? "Sin datos" : `${value}%`;
}

function weekErrorMessage(error: unknown): string {
  if (error instanceof PanelRequestError && error.status === 403) {
    return "Tu cuenta no tiene permiso para ver el panel semanal.";
  }
  return error instanceof Error ? error.message : "No fue posible cargar el panel semanal.";
}

function statusLabel(status: string): string {
  if (status === "at_risk") return "En riesgo · panel semanal";
  if (status === "missing_report") return "Falta reportar · panel semanal";
  if (status === "no_due_days") return "Sin días evaluables";
  return status.replaceAll("_", " ");
}

function colorClass(color: string): string {
  return ["green", "yellow", "red", "neutral"].includes(color) ? `weekly-color-${color}` : "weekly-color-neutral";
}

function dayHeading(date: string): string {
  const parsed = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(parsed.getTime())
    ? date
    : parsed.toLocaleDateString("es-CL", { weekday: "short", day: "numeric", timeZone: "UTC" });
}

// Release: mantenerlo visible a roles autorizados aunque panel_enabled=false; hoy es metadata y /weeks y /week no lo aplican. El permiso del endpoint es la seguridad efectiva; no usar panel_enabled como kill-switch.
export function WeeklyTeamPanel() {
  const [config, setConfig] = useState<PanelConfig | null>(null);
  const [weeks, setWeeks] = useState<PanelWeekOption[]>([]);
  const [selectedWeek, setSelectedWeek] = useState("");
  const [filter, setFilter] = useState<PanelFilter>("all");
  const [panel, setPanel] = useState<PanelWeekResponse | null>(null);
  const [initialLoading, setInitialLoading] = useState(true);
  const [weekLoading, setWeekLoading] = useState(false);
  const [error, setError] = useState("");
  const [loadVersion, setLoadVersion] = useState(0);
  const [weekVersion, setWeekVersion] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setInitialLoading(true);
    setError("");
    setConfig(null);
    setPanel(null);
    setSelectedWeek("");
    Promise.all([
      getPanelData<PanelConfig>("/api/p90/panel/config", controller.signal),
      getPanelData<PanelWeeksResponse>("/api/p90/panel/weeks", controller.signal),
    ]).then(([nextConfig, weeksResponse]) => {
      if (!active) return;
      const validWeeks = Array.isArray(weeksResponse.weeks)
        ? weeksResponse.weeks.filter((week) => isValidIsoDate(week.start))
        : [];
      setConfig(nextConfig);
      setWeeks(validWeeks);
      const currentWeek = validWeeks.find((week) => week.start === weeksResponse.current);
      setSelectedWeek(currentWeek?.start || validWeeks.at(-1)?.start || "");
    }).catch((reason: unknown) => {
      if (active && !(reason instanceof DOMException && reason.name === "AbortError")) {
        setError(weekErrorMessage(reason));
      }
    }).finally(() => {
      if (active) setInitialLoading(false);
    });
    return () => {
      active = false;
      controller.abort();
    };
  }, [loadVersion]);

  useEffect(() => {
    if (!config || !weeks.some((week) => week.start === selectedWeek) || !isValidIsoDate(selectedWeek)) return;
    const controller = new AbortController();
    let active = true;
    const params = new URLSearchParams({ week_start: selectedWeek, filter });
    setWeekLoading(true);
    setPanel(null);
    setError("");
    getPanelData<PanelWeekResponse>(`/api/p90/panel/week?${params.toString()}`, controller.signal)
      .then((response) => {
        if (active) setPanel(response);
      })
      .catch((reason: unknown) => {
        if (active && !(reason instanceof DOMException && reason.name === "AbortError")) {
          setError(weekErrorMessage(reason));
        }
      })
      .finally(() => {
        if (active) setWeekLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [config, filter, selectedWeek, weekVersion, weeks]);

  const columns = panel?.week.start && isValidIsoDate(panel.week.start)
    ? Array.from({ length: 7 }, (_, index) => {
        const date = new Date(`${panel.week.start}T00:00:00Z`);
        date.setUTCDate(date.getUTCDate() + index);
        return date.toISOString().slice(0, 10);
      })
    : [];
  const summary = panel?.summary;

  return (
    <section className="weekly-team-panel" aria-labelledby="weekly-team-title">
      <header className="weekly-team-heading">
        <div>
          <span className="eyebrow">RESUMEN SEMANAL · CÁLCULO DEL BACKEND</span>
          <h2 id="weekly-team-title">Panel semanal del equipo</h2>
          <p>Semáforo y alertas calculados por las reglas del panel semanal.</p>
        </div>
        {!initialLoading && config && <span className="weekly-team-source">API semanal</span>}
      </header>

      {initialLoading ? (
        <p className="weekly-panel-message" role="status">Cargando configuración y semanas disponibles…</p>
      ) : error && !config ? (
        <div className="weekly-panel-message error" role="alert">
          <span>{error}</span>
          <button className="secondary" onClick={() => setLoadVersion((version) => version + 1)}>Reintentar</button>
        </div>
      ) : (
        <>
          <div className="weekly-panel-controls">
            <label>
              Semana
              <select
                value={selectedWeek}
                onChange={(event) => {
                  setSelectedWeek(event.target.value);
                  setFilter("all");
                }}
                disabled={weeks.length === 0}
              >
                {weeks.map((week) => (
                  <option key={week.start} value={week.start}>{week.label}</option>
                ))}
              </select>
            </label>
            <div className="weekly-panel-filters" aria-label="Filtrar participantes">
              {([
                ["all", "Todos"],
                ["risk", "En riesgo · backend"],
                ["missing", "Falta reportar · backend"],
              ] as const).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  className={filter === value ? "active" : ""}
                  aria-pressed={filter === value}
                  onClick={() => setFilter(value)}
                >
                  {label}
                  {summary && <b>{value === "all" ? summary.participants : value === "risk" ? summary.at_risk : summary.missing_report}</b>}
                </button>
              ))}
            </div>
          </div>

          {error && <p className="weekly-panel-message error" role="alert">{error}<button className="secondary" onClick={() => setWeekVersion((version) => version + 1)}>Reintentar</button></p>}
          {weekLoading && <p className="weekly-panel-message" role="status">Cargando resumen de la semana…</p>}
          {!weekLoading && !error && weeks.length === 0 && (
            <p className="weekly-panel-message">Aún no hay semanas disponibles para mostrar.</p>
          )}
          {!weekLoading && !error && panel && (
            <>
              {config?.show_summary_cards && summary && (
                <div className="weekly-panel-summary">
                  <article><small>Participantes</small><b>{summary.participants}</b><span>Incluidos en la semana</span></article>
                  <article><small>Promedio semanal</small><b>{formatPercent(summary.weekly_avg)}</b><span>Promedio del panel</span></article>
                  <article className="risk"><small>En riesgo</small><b>{summary.at_risk}</b><span>Según umbral semanal del backend</span></article>
                  <article className="missing"><small>Falta reportar</small><b>{summary.missing_report}</b><span>Según el panel semanal del backend</span></article>
                </div>
              )}

              {panel.rows.length === 0 ? (
                <p className="weekly-panel-message">
                  {panel.empty_reason === "no_participants"
                    ? "No hay participantes elegibles para esta semana."
                    : panel.empty_reason === "no_match_filter"
                      ? "No hay participantes que coincidan con este filtro en la semana seleccionada."
                      : "No hay filas para mostrar en esta semana."}
                </p>
              ) : (
                <div className="weekly-team-table-wrap">
                  <table className="weekly-team-table">
                    <thead>
                      <tr>
                        <th>Participante</th>
                        {columns.map((date) => <th key={date}>{dayHeading(date)}</th>)}
                        <th>Promedio semanal</th>
                        <th>Estado del panel</th>
                      </tr>
                    </thead>
                    <tbody>
                      {panel.rows.map((row) => (
                        <tr key={row.client_id}>
                          <td>
                            <b>{row.name || "Participante"}</b>
                            {config?.show_email_in_table && row.email && <small>{row.email}</small>}
                          </td>
                          {columns.map((date) => {
                            const day = row.days.find((item) => item.date === date);
                            return (
                              <td key={date}>
                                {day ? (
                                  <span className={`weekly-day-value ${colorClass(day.color)}`} title={`${day.label}${day.pct == null ? "" : ` · ${formatPercent(day.pct)}`}`}>
                                    <small>{day.label}</small>
                                    <b>{day.pct == null ? "—" : formatPercent(day.pct)}</b>
                                  </span>
                                ) : <span className="weekly-day-value weekly-color-neutral">—</span>}
                              </td>
                            );
                          })}
                          <td><b className={`weekly-average ${colorClass(row.weekly.color)}`}>{formatPercent(row.weekly.pct)}</b></td>
                          <td>
                            <div className="weekly-status-list">
                              {row.status.length
                                ? row.status.map((status) => <span key={status} className={status === "at_risk" ? "risk" : status === "missing_report" ? "missing" : "neutral"}>{statusLabel(status)}</span>)
                                : <span className="neutral">Sin alertas del panel semanal</span>}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              <p className="weekly-panel-note">
                “En riesgo” se determina con el umbral semanal configurado en backend. “Falta reportar” usa sus días pendientes; estas alertas no equivalen a las reglas locales de 3 incumplimientos o 48 horas.
              </p>
            </>
          )}
        </>
      )}
    </section>
  );
}
