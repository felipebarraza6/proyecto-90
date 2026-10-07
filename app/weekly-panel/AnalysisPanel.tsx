import { formatDateShort, formatDateTime } from "./format";
import { RetryError, SkeletonTable } from "./ui";
import type { AnalysisResponse } from "./types";

function severityClass(severity: string): string {
  if (severity === "high") return "high";
  if (severity === "medium") return "medium";
  return "info";
}

function evidenceLine(alert: NonNullable<AnalysisResponse["alerts"]>[number]): string {
  const ev = alert.evidence || {};
  const parts: string[] = [];
  if (ev.avg != null) parts.push(`promedio ${ev.avg}${ev.unit ? ` ${ev.unit}` : ""}`);
  if (ev.target != null) parts.push(`objetivo ${ev.target}${ev.unit ? ` ${ev.unit}` : ""}`);
  if (alert.affected_count != null && alert.base_count != null) {
    parts.push(`${alert.affected_count} de ${alert.base_count} días`);
  }
  return parts.join(" · ");
}

export function AnalysisPanel({
  data,
  loading,
  error,
  onRetry,
}: {
  data: AnalysisResponse | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}) {
  const coverage = data?.coverage;
  const days = coverage?.days_with_data;
  const due = coverage?.due_days;
  const isError = Boolean(error) || data?.status === "error";
  const insufficient = data?.status === "insufficient";

  return (
    <section className="wp-analysis" aria-labelledby="wp-analysis-title">
      <header>
        <span className="eyebrow">
          {data?.summary_engine === "llm" ? "ANÁLISIS SEMANAL · IA" : "ANÁLISIS SEMANAL · REGLAS"}
        </span>
        <h2 id="wp-analysis-title">
          Alertas y consejo
          {data?.partial && data.status !== "insufficient" ? (
            <span className="wp-partial">Parcial · semana en curso</span>
          ) : null}
        </h2>
      </header>
      {loading && !data ? <SkeletonTable rows={3} /> : null}
      {isError ? (
        <RetryError
          message={
            data?.error_message ||
            error ||
            "No fue posible generar el análisis."
          }
          onRetry={onRetry}
        />
      ) : null}
      {data?.last_ok_generated_at && isError ? (
        <p className="wp-analysis-meta">
          Último análisis correcto: {formatDateTime(data.last_ok_generated_at)}
        </p>
      ) : null}
      {data && !loading ? (
        <>
          {days != null && due != null ? (
            <p className="wp-analysis-meta">
              Cobertura: {days} de {due} días con registro
            </p>
          ) : null}
          {insufficient ? (
            <p className="wp-insufficient">
              {data.summary_text ||
                `Todavía no hay registros suficientes: ${days ?? 0} de ${due ?? 0} días con registro`}
            </p>
          ) : data.summary_text ? (
            <p className="wp-summary-text">{data.summary_text}</p>
          ) : null}
          {data.advice?.length ? (
            <>
              <h3 className="wp-advice-title">Sugerencias para el equipo</h3>
              <ul className="wp-advice">
                {data.advice.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </>
          ) : null}
          <ul className="wp-alerts">
            {(data.alerts || []).map((alert) => (
              <li key={alert.code} className={`wp-alert ${severityClass(alert.severity)}`}>
                <h3>{alert.title}</h3>
                <p>{evidenceLine(alert)}</p>
                {alert.affected_days?.length ? (
                  <small>
                    Días: {alert.affected_days.map((d) => formatDateShort(d)).join(", ")}
                  </small>
                ) : null}
                {alert.observation ? <p className="wp-obs">{alert.observation}</p> : null}
              </li>
            ))}
          </ul>
          {data.generated_at ? (
            <p className="wp-analysis-meta">
              Análisis del {formatDateTime(data.generated_at)}
            </p>
          ) : null}
          <p className="wp-disclaimer">
            {data.disclaimer ||
              "Requiere revisión profesional. No modifica planes ni se envía al alumno."}
          </p>
        </>
      ) : null}
    </section>
  );
}
