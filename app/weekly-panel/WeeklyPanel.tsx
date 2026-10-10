import { useEffect, useRef, useState } from "react";
import { fetchPanelConfig, fetchWeek, fetchWeeks } from "./api";
import { PanelLegend } from "./Legend";
import { PanelConfigView } from "./PanelConfigView";
import { PanelStatsProvider } from "./PanelStatsContext";
import { ParticipantCards } from "./ParticipantCards";
import { StatusFilters } from "./StatusFilters";
import { StudentDrawer } from "./StudentDrawer";
import { SummaryCards } from "./SummaryCards";
import { useIsMobile } from "./useIsMobile";
import { usePanelWeek } from "./usePanelWeek";
import { EmptyNote, RetryError, SkeletonTable } from "./ui";
import { WeekSelector } from "./WeekSelector";
import { WeeklyTable } from "./WeeklyTable";
import type { PanelConfig, WeekOption, WeekResponse } from "./types";

export function WeeklyPanel({
  viewerId,
  role,
  specialty,
  config,
  onConfigChange,
}: {
  viewerId: string;
  role: string;
  specialty?: string;
  config: PanelConfig;
  onConfigChange?: (next: PanelConfig) => void;
}) {
  const { weekStart, filter, selectedClientId, setWeekStart, setFilter, setSelectedClientId } =
    usePanelWeek();
  const mobile = useIsMobile();
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [currentWeek, setCurrentWeek] = useState<string>("");
  const [weekData, setWeekData] = useState<WeekResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weeksError, setWeeksError] = useState("");
  const [reload, setReload] = useState(0);
  const [showConfig, setShowConfig] = useState(false);
  const weekGen = useRef(0);

  // Marce 07-10: admin, coach y nutri ven la ficha completa (rutina y macros).
  const showRoutine = true;
  const showNutrition = true;
  const isAdmin = role === "admin";
  // Cerrada si el backend lo marca, o si no es la semana en curso (compat. sin is_closed).
  const weekClosed =
    Boolean(weekData?.week.is_closed) || weekData?.week.is_current === false;

  useEffect(() => {
    const ac = new AbortController();
    setWeeksError("");
    fetchWeeks(ac.signal)
      .then((res) => {
        setWeeks(res.weeks);
        setCurrentWeek(res.current);
        if (!weekStart && res.current) setWeekStart(res.current);
      })
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setWeeksError(err instanceof Error ? err.message : "No fue posible cargar las semanas");
      });
    return () => ac.abort();
    // weekStart/setWeekStart omitted: only seed once when empty
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!weekStart) return;
    const ac = new AbortController();
    const gen = ++weekGen.current;
    setLoading(true);
    setError("");
    setWeekData(null);
    fetchWeek(weekStart, filter, ac.signal)
      .then((res) => {
        if (gen !== weekGen.current) return;
        setWeekData(res);
      })
      .catch((err: unknown) => {
        if (gen !== weekGen.current || (err as Error).name === "AbortError") return;
        setWeekData(null);
        setError(err instanceof Error ? err.message : "No fue posible cargar la semana");
      })
      .finally(() => {
        if (gen === weekGen.current) setLoading(false);
      });
    return () => ac.abort();
  }, [weekStart, filter, reload]);

  const emptyTitle =
    weekData?.empty_reason === "no_match_filter"
      ? "No hay alumnos para este filtro en la semana seleccionada"
      : "Ningún alumno había iniciado en esta semana";
  const emptyCopy =
    weekData?.empty_reason === "no_match_filter"
      ? "Prueba con Todos o elige otra semana."
      : "Los alumnos aparecen desde el lunes de la semana en que inicia su desafío.";

  return (
    <PanelStatsProvider config={config}>
    <div className="wp-page">
      <div className="admin-title">
        <div>
          <span className="eyebrow">ADHERENCIA Y SEGUIMIENTO</span>
          <h1>Panel semanal</h1>
          <p>
            Una semana, un vistazo por alumno y la ficha completa sin cambiar de pestaña. Los
            porcentajes y colores salen del servidor.
          </p>
        </div>
        {isAdmin ? (
          <button
            type="button"
            className="secondary"
            onClick={() => setShowConfig((v) => !v)}
            aria-expanded={showConfig}
          >
            {showConfig ? "Volver al panel" : "Reglas de adherencia"}
          </button>
        ) : null}
      </div>
      {showConfig && isAdmin ? (
        <PanelConfigView
          config={config}
          onSaved={async (next) => {
            onConfigChange?.(next);
            try {
              const fresh = await fetchPanelConfig();
              onConfigChange?.(fresh);
            } catch {
              /* Se conserva la respuesta del PATCH. */
            }
            setReload((n) => n + 1);
          }}
        />
      ) : null}
      {!showConfig ? (
        <>
      {weeksError ? (
        <RetryError message={weeksError} onRetry={() => window.location.reload()} />
      ) : (
        <WeekSelector
          weeks={weeks}
          current={currentWeek}
          weekStart={weekStart}
          isCurrent={weekData?.week.is_current}
          label={weekData?.week.label}
          onChange={setWeekStart}
        />
      )}
      {weekData && config.show_summary_cards ? (
        <SummaryCards
          summary={weekData.summary}
          filter={filter}
          onFilter={setFilter}
        />
      ) : null}
      {weekData ? (
        <StatusFilters filter={filter} summary={weekData.summary} onFilter={setFilter} />
      ) : null}
      {loading ? <SkeletonTable rows={8} /> : null}
      {error ? <RetryError message={error} onRetry={() => setReload((n) => n + 1)} /> : null}
      {!loading && !error && weekData && weekData.rows.length === 0 ? (
        <EmptyNote title={emptyTitle} copy={emptyCopy} />
      ) : null}
      {!loading && !error && weekData && weekData.rows.length > 0 ? (
        mobile ? (
          <ParticipantCards
            rows={weekData.rows}
            showEmail={config.show_email_in_table}
            onOpen={setSelectedClientId}
          />
        ) : (
          <WeeklyTable
            rows={weekData.rows}
            showEmail={config.show_email_in_table}
            onOpen={setSelectedClientId}
          />
        )
      ) : null}
      <PanelLegend
        greenGt={config.thresholds.green_gt}
        yellowGte={config.thresholds.yellow_gte}
        config={config}
      />
      {selectedClientId != null && weekStart ? (
        <StudentDrawer
          key={selectedClientId}
          clientId={selectedClientId}
          weekStart={weekStart}
          weeks={weeks}
          currentWeek={currentWeek}
          rows={weekData?.rows || []}
          staffUserId={viewerId}
          role={role}
          specialty={specialty}
          canComment={config.can_comment}
          showRoutine={showRoutine}
          showNutrition={showNutrition}
          isMobile={mobile}
          weekClosed={weekClosed}
          defaultSessionsPerWeek={config.default_sessions_per_week}
          defaultWaterGoalMl={config.default_water_goal_ml}
          onWeekChange={setWeekStart}
          onSelectClient={setSelectedClientId}
          onClose={() => setSelectedClientId(null)}
        />
      ) : null}
        </>
      ) : null}
    </div>
    </PanelStatsProvider>
  );
}
