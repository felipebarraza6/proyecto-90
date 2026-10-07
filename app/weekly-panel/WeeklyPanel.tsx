import { useEffect, useRef, useState } from "react";
import { fetchWeek, fetchWeeks } from "./api";
import { PanelLegend } from "./Legend";
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
}: {
  viewerId: string;
  role: string;
  specialty?: string;
  config: PanelConfig;
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
  const weekGen = useRef(0);

  const showRoutine = role !== "professional" || specialty !== "nutrition";
  const showNutrition = role !== "professional" || specialty === "nutrition";

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
      </div>
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
      <PanelLegend greenGt={config.thresholds.green_gt} yellowGte={config.thresholds.yellow_gte} />
      {selectedClientId != null && weekStart ? (
        <StudentDrawer
          key={selectedClientId}
          clientId={selectedClientId}
          weekStart={weekStart}
          weeks={weeks}
          currentWeek={currentWeek}
          rows={weekData?.rows || []}
          staffUserId={viewerId}
          canComment={config.can_comment}
          showRoutine={showRoutine}
          showNutrition={showNutrition}
          isMobile={mobile}
          onWeekChange={setWeekStart}
          onSelectClient={setSelectedClientId}
          onClose={() => setSelectedClientId(null)}
        />
      ) : null}
    </div>
  );
}
