import { useEffect, useMemo, useRef, useState } from "react";
import { fetchAnalysis, fetchStudentWeek } from "./api";
import { AnalysisPanel } from "./AnalysisPanel";
import { CommentsThread } from "./CommentsThread";
import { FeedbackBox } from "./FeedbackBox";
import { HabitPlanEditor } from "./HabitPlanEditor";
import { StudentFacts } from "./StudentFacts";
import { StudentWeekTable } from "./StudentWeekTable";
import { RetryError, SkeletonTable } from "./ui";
import { WeekSelector } from "./WeekSelector";
import type {
  AnalysisResponse,
  CommentItem,
  PanelRow,
  StudentWeekResponse,
  WeekOption,
} from "./types";

export function StudentDrawer({
  clientId,
  weekStart,
  weeks,
  currentWeek,
  rows,
  staffUserId,
  role,
  specialty,
  canComment,
  showRoutine,
  showNutrition,
  isMobile,
  onWeekChange,
  onSelectClient,
  onClose,
}: {
  clientId: number;
  weekStart: string;
  weeks: WeekOption[];
  currentWeek?: string;
  rows: PanelRow[];
  staffUserId: string;
  role: string;
  specialty?: string;
  canComment: boolean;
  showRoutine: boolean;
  showNutrition: boolean;
  isMobile: boolean;
  onWeekChange: (start: string) => void;
  onSelectClient: (id: number) => void;
  onClose: () => void;
}) {
  const [data, setData] = useState<StudentWeekResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResponse | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(true);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [posted, setPosted] = useState<CommentItem[]>([]);
  const [reload, setReload] = useState(0);
  const [analysisReload, setAnalysisReload] = useState(0);
  const analysisRefresh = useRef(false);
  const studentGen = useRef(0);
  const analysisGen = useRef(0);
  const [scope, setScope] = useState(`${clientId}:${weekStart}`);
  if (scope !== `${clientId}:${weekStart}`) {
    setScope(`${clientId}:${weekStart}`);
    setData(null);
    setError("");
    setAnalysis(null);
    setAnalysisError(null);
    setPosted([]);
    setLoading(true);
    setAnalysisLoading(true);
  }

  const index = rows.findIndex((row) => row.client_id === clientId);
  const prev = index > 0 ? rows[index - 1] : null;
  const next = index >= 0 && index < rows.length - 1 ? rows[index + 1] : null;

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [onClose]);

  useEffect(() => {
    const ac = new AbortController();
    const gen = ++studentGen.current;
    const requestClient = clientId;
    const requestWeek = weekStart;
    setLoading(true);
    setError("");
    setData(null);
    fetchStudentWeek(requestClient, requestWeek, ac.signal)
      .then((res) => {
        if (gen !== studentGen.current) return;
        setData(res);
      })
      .catch((err: unknown) => {
        if (gen !== studentGen.current || (err as Error).name === "AbortError") return;
        setError(err instanceof Error ? err.message : "No fue posible cargar la ficha");
      })
      .finally(() => {
        if (gen === studentGen.current) setLoading(false);
      });
    return () => ac.abort();
  }, [clientId, weekStart, reload]);

  useEffect(() => {
    const ac = new AbortController();
    const gen = ++analysisGen.current;
    const requestClient = clientId;
    const requestWeek = weekStart;
    setAnalysisLoading(true);
    setAnalysisError(null);
    const refresh = analysisRefresh.current;
    analysisRefresh.current = false;
    fetchAnalysis(requestClient, requestWeek, refresh, ac.signal)
      .then((res) => {
        if (gen !== analysisGen.current) return;
        setAnalysis(res);
        if (res.status === "error") {
          setAnalysisError(res.error_message || "El análisis no está disponible");
        }
      })
      .catch((err: unknown) => {
        if (gen !== analysisGen.current || (err as Error).name === "AbortError") return;
        setAnalysisError(err instanceof Error ? err.message : "No fue posible cargar el análisis");
      })
      .finally(() => {
        if (gen === analysisGen.current) setAnalysisLoading(false);
      });
    return () => ac.abort();
  }, [clientId, weekStart, analysisReload]);

  const title = useMemo(
    () => data?.profile.name || rows.find((r) => r.client_id === clientId)?.name || "Alumno",
    [data, rows, clientId],
  );
  const canEditHabits =
    role === "admin" || (role === "professional" && specialty === "coach");

  return (
    <div className={`wp-drawer-backdrop ${isMobile ? "mobile" : ""}`}>
      <button type="button" className="wp-drawer-scrim" aria-label="Cerrar ficha" onClick={onClose} />
      <aside
        className={`wp-drawer ${isMobile ? "full" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="wp-drawer-title"
      >
        <header className="wp-drawer-head">
          <button type="button" className="back" onClick={onClose}>
            ← Cerrar
          </button>
          <h2 id="wp-drawer-title">{title}</h2>
          <div className="wp-drawer-nav">
            <button
              type="button"
              className="secondary"
              disabled={!prev}
              onClick={() => prev && onSelectClient(prev.client_id)}
            >
              ‹ Anterior
            </button>
            <button
              type="button"
              className="secondary"
              disabled={!next}
              onClick={() => next && onSelectClient(next.client_id)}
            >
              Siguiente ›
            </button>
          </div>
        </header>
        <div className="wp-drawer-body">
          <WeekSelector
            weeks={weeks}
            current={currentWeek}
            weekStart={weekStart}
            onChange={onWeekChange}
          />
          {loading ? <SkeletonTable rows={8} /> : null}
          {error ? (
            <RetryError message={error} onRetry={() => setReload((n) => n + 1)} />
          ) : null}
          {data ? (
            <>
              <StudentFacts data={data} showRoutine={showRoutine} showNutrition={showNutrition} />
              {canEditHabits ? (
                <HabitPlanEditor
                  clientId={clientId}
                  weekStart={weekStart}
                  challengeStart={data.profile.challenge_start}
                  onSaved={() => {
                    analysisRefresh.current = true;
                    setReload((n) => n + 1);
                    setAnalysisReload((n) => n + 1);
                  }}
                />
              ) : null}
              <StudentWeekTable data={data} />
            </>
          ) : null}
          <AnalysisPanel
            data={analysis}
            loading={analysisLoading}
            error={analysisError}
            onRetry={() => {
              analysisRefresh.current = true;
              setAnalysisReload((n) => n + 1);
            }}
          />
          {canComment ? (
            <FeedbackBox
              key={`${staffUserId}-${clientId}`}
              clientId={clientId}
              weekStart={weekStart}
              staffUserId={staffUserId}
              onPosted={(item) => setPosted((prevItems) => [item, ...prevItems])}
            />
          ) : (
            <p className="wp-readonly-note">Tu rol puede leer comentarios, no escribirlos.</p>
          )}
          <CommentsThread
            key={`thread-${clientId}`}
            clientId={clientId}
            extraItems={posted}
            onDeleted={(id) => setPosted((prevItems) => prevItems.filter((x) => x.id !== id))}
          />
        </div>
      </aside>
    </div>
  );
}
