import { useEffect, useState } from "react";
import { PanelApiError, fetchMyWeek, fetchMyWeeks } from "./api";
import { PanelStatsProvider } from "./PanelStatsContext";
import { StudentFacts } from "./StudentFacts";
import { StudentWeekTable } from "./StudentWeekTable";
import { studentSelfUnavailable } from "./studentSelfWeek";
import type { PanelConfig, StudentWeekResponse, WeekOption } from "./types";
import { WeekSelector } from "./WeekSelector";

/**
 * Ficha semanal del alumno de la sesión. Solo /me/weeks y /me/week.
 * Sin IA, comentarios, editores ni cambio de alumno.
 */
export function StudentSelfWeek({
  config,
}: {
  config: PanelConfig | null;
}) {
  const [hidden, setHidden] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [weeks, setWeeks] = useState<WeekOption[]>([]);
  const [current, setCurrent] = useState("");
  const [weekStart, setWeekStart] = useState("");
  const [data, setData] = useState<StudentWeekResponse | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    setLoading(true);
    setError("");
    fetchMyWeeks(ac.signal)
      .then((list) => {
        const options = list.weeks || [];
        setWeeks(options);
        setCurrent(list.current || "");
        const preferred =
          options.find((week) => week.is_current)?.start ||
          (options.some((week) => week.start === list.current) ? list.current : "") ||
          options[options.length - 1]?.start ||
          "";
        setWeekStart(preferred);
        if (!preferred) {
          setData(null);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        if (err instanceof PanelApiError && studentSelfUnavailable(err.status)) {
          setHidden(true);
          return;
        }
        setError(err instanceof Error ? err.message : "No fue posible cargar tus semanas");
        setLoading(false);
      });
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!weekStart) return;
    const ac = new AbortController();
    setLoading(true);
    setError("");
    fetchMyWeek(weekStart, ac.signal)
      .then((payload) => {
        setData(payload);
      })
      .catch((err: unknown) => {
        if ((err as Error).name === "AbortError") return;
        setData(null);
        if (err instanceof PanelApiError && studentSelfUnavailable(err.status)) {
          setHidden(true);
          return;
        }
        setError(err instanceof Error ? err.message : "No fue posible cargar la ficha");
      })
      .finally(() => {
        if (!ac.signal.aborted) setLoading(false);
      });
    return () => ac.abort();
  }, [weekStart]);

  if (hidden) return null;

  const selected = weeks.find((week) => week.start === weekStart);
  const body = (
    <section className="wp-insights" aria-label="Tu ficha semanal">
      <div>
        <span className="eyebrow">FICHA SEMANAL</span>
        <h3>Tu ficha semanal</h3>
      </div>
      {weeks.length > 0 ? (
        <WeekSelector
          weeks={weeks}
          current={current}
          weekStart={weekStart || null}
          isCurrent={selected?.is_current}
          label={selected?.label}
          onChange={setWeekStart}
        />
      ) : null}
      {loading ? <p className="wp-insights-note">Cargando tu ficha semanal…</p> : null}
      {error ? <p className="wp-insights-note">{error}</p> : null}
      {!loading && !error && weeks.length === 0 ? (
        <p className="wp-insights-note">Todavía no hay semanas de tu desafío.</p>
      ) : null}
      {data && !error ? (
        <>
          <StudentFacts
            data={data}
            showRoutine
            showNutrition
            weekClosed={selected?.is_closed}
          />
          <StudentWeekTable data={data} />
        </>
      ) : null}
    </section>
  );

  if (!config) return body;
  return <PanelStatsProvider config={config}>{body}</PanelStatsProvider>;
}
