import { formatHeightCm } from "../height";
import {
  formatDateLong,
  formatDateShort,
  formatKg,
  formatMlAsLiters,
  formatPct,
  WEEKDAYS_SHORT,
} from "./format";
import { usePanelStats } from "./PanelStatsContext";
import { trainingProgressDisplay } from "./trainingProgress";
import { StatusBadges } from "./ui";
import type { StudentWeekResponse, WeightMilestone, WeightPoint } from "./types";
import { resolveStudentWeightCards, type ParticipantWeightSource } from "./weightCards";

function sourceLabel(source?: string | null, type?: string | null): string {
  if (type === "checkpoint" || source === "checkpoint") return "hito";
  if (source === "profile") return "perfil";
  if (type === "control" || source === "measurement" || source === "participant") return "control";
  if (type === "initial" && source && source !== "profile") return "control";
  if (!source) return "";
  // Códigos técnicos del backend → español corto; desconocidos se ocultan.
  if (/^[a-z_]+$/i.test(source)) return "";
  return source;
}

function WeightMini({
  title,
  point,
  pendingHint,
  emptyLatest,
}: {
  title: string;
  point?: WeightPoint | WeightMilestone | null;
  pendingHint?: string | null;
  emptyLatest?: boolean;
}) {
  const kg = point?.kg ?? null;
  const date = point?.date ?? null;
  const source = point?.source ?? null;
  const type = point && "type" in point ? point.type : undefined;

  if (emptyLatest) {
    return (
      <div className="wp-weight-col">
        <dt>{title}</dt>
        <dd>Sin control posterior</dd>
      </div>
    );
  }

  if (kg == null) {
    return (
      <div className="wp-weight-col">
        <dt>{title}</dt>
        <dd>
          Pendiente
          {pendingHint ? <small>se registra el {pendingHint}</small> : <small>—</small>}
        </dd>
      </div>
    );
  }

  return (
    <div className="wp-weight-col">
      <dt>{title}</dt>
      <dd>
        {formatKg(kg)}
        <small>
          {[date ? formatDateShort(date) : null, sourceLabel(source, type)].filter(Boolean).join(" · ")}
        </small>
      </dd>
    </div>
  );
}

function restDaysLabel(days: number[]): string {
  if (!days.length) return "Sin días de descanso definidos";
  return days
    .slice()
    .sort((a, b) => a - b)
    .map((d) => WEEKDAYS_SHORT[d] || String(d))
    .join(", ");
}

export function StudentFacts({
  data,
  showRoutine,
  showNutrition,
  weekClosed,
  participantWeight = null,
}: {
  data: StudentWeekResponse;
  showRoutine: boolean;
  showNutrition: boolean;
  weekClosed?: boolean;
  /** Fila de Participantes ya cargada. Null: se muestra el bloque del panel tal cual. */
  participantWeight?: ParticipantWeightSource | null;
}) {
  const { profile, weekly, training_progress: progress } = data;
  const { percent_decimals, milestone_days, challenge_length_days, thresholds } = usePanelStats();
  const trainingLabel = trainingProgressDisplay(progress, { weekClosed });
  const changed = profile.nutrition_targets.changed_in_week || [];
  const weight = profile.weight || { initial: null, milestones: [], latest: null };
  const panelMilestones = (weight.milestones || []).map((item) => ({ day: item.day, kg: item.kg }));
  const resolved = resolveStudentWeightCards({
    milestoneDays: milestone_days,
    panelInitialKg: weight.initial?.kg ?? null,
    panelMilestones,
    panelLatestKg: weight.latest?.kg ?? null,
    participant: participantWeight,
  });
  const milestones = milestone_days.map((day) => {
    const found = (weight.milestones || []).find((item) => item.day === day);
    const kg = resolved.milestones.find((item) => item.day === day)?.kg ?? null;
    const base =
      found || {
        day,
        kg: null,
        date: null,
        expected_date: null,
        source: null,
        label: `Día ${day}`,
      };
    if (!resolved.correctedFromParticipant) return { ...base, kg };
    return {
      ...base,
      kg,
      date: kg != null && found?.kg === kg ? found.date : null,
      source: kg != null && found?.kg === kg ? found.source : kg != null ? "checkpoint" : null,
    };
  });
  const initialPoint: WeightPoint = resolved.correctedFromParticipant
    ? {
        kg: resolved.initial,
        date: resolved.initial != null && weight.initial?.kg === resolved.initial ? weight.initial?.date ?? null : null,
        source: "profile",
        type: "initial",
        label: "Peso inicial",
      }
    : weight.initial;
  const latestPoint: WeightPoint = resolved.correctedFromParticipant
    ? {
        kg: resolved.latest,
        date: resolved.latest != null && weight.latest?.kg === resolved.latest ? weight.latest?.date ?? null : null,
        source: weight.latest?.source ?? "checkpoint",
        type: weight.latest?.type ?? "control",
        label: "Último peso",
      }
    : weight.latest;
  const rest = profile.habit_plan.rest_weekdays || [];

  return (
    <div className="wp-facts">
      <header className="wp-facts-head">
        <div>
          <span className="eyebrow">FICHA DEL ALUMNO</span>
          <h2>{profile.name || profile.email}</h2>
          <p>{profile.email}</p>
        </div>
        <div className={`wp-week-pct large ${weekly.color}`}>
          <small>Adherencia semanal</small>
          <b>{formatPct(weekly.pct, percent_decimals, { color: String(weekly.color), greenGt: thresholds.green_gt, yellowGte: thresholds.yellow_gte })}</b>
          <StatusBadges status={weekly.status} />
        </div>
      </header>
      <dl className="wp-facts-grid">
        <div className="wp-weight-card">
          <dt>Peso</dt>
          <dd className="wp-weight-cols">
            <WeightMini title="Inicial" point={initialPoint} />
            {milestones.map((item) => (
              <WeightMini
                key={item.day}
                title={item.label || `Día ${item.day}`}
                point={item}
                pendingHint={item.expected_date ? formatDateShort(item.expected_date) : null}
              />
            ))}
            <WeightMini title="Último" point={latestPoint} emptyLatest={!latestPoint || latestPoint.kg == null} />
          </dd>
        </div>
        <div>
          <dt>Estatura</dt>
          <dd>{formatHeightCm(profile.height_cm, "No informada")}</dd>
        </div>
        <div>
          <dt>Objetivo</dt>
          <dd>{(profile.goal || profile.objective || "").trim() || "—"}</dd>
        </div>
        <div>
          <dt>Inicio del desafío</dt>
          <dd>
            {formatDateLong(profile.challenge_start)}
            {profile.challenge_day != null ? (
              <small>
                día {profile.challenge_day}/{challenge_length_days} · semana{" "}
                {profile.challenge_week ?? "—"} del desafío
              </small>
            ) : (
              <small>Aún no inicia</small>
            )}
          </dd>
        </div>
        <div>
          <dt>Entrenamientos</dt>
          <dd>
            {trainingLabel.primary}
            {trainingLabel.note ? <small>{trainingLabel.note}</small> : null}
          </dd>
        </div>
        {showRoutine ? (
          <div>
            <dt>Rutina / bloque</dt>
            <dd>
              {profile.routine.program || "Sin rutina"}
              <small>
                {[profile.routine.level, profile.routine.location, profile.routine.block ? `bloque ${profile.routine.block}` : null]
                  .filter(Boolean)
                  .join(" · ") || "—"}
              </small>
            </dd>
          </div>
        ) : null}
        <div>
          <dt>Agua</dt>
          <dd>Meta {formatMlAsLiters(profile.habit_plan.water_goal_ml)} / día</dd>
        </div>
        <div>
          <dt>Descansos</dt>
          <dd>{restDaysLabel(rest)}</dd>
        </div>
      </dl>
      {showNutrition ? (
        <div className="wp-nutrition-targets">
          <span className="eyebrow">METAS NUTRICIONALES</span>
          <div className="wp-macro-targets">
            <span>
              <small>kcal</small>
              <b>{profile.nutrition_targets.calories ?? "—"}</b>
            </span>
            <span>
              <small>Proteínas</small>
              <b>{profile.nutrition_targets.protein != null ? `${profile.nutrition_targets.protein} g` : "—"}</b>
            </span>
            <span>
              <small>Carbohidratos</small>
              <b>{profile.nutrition_targets.carbs != null ? `${profile.nutrition_targets.carbs} g` : "—"}</b>
            </span>
            <span>
              <small>Grasas</small>
              <b>{profile.nutrition_targets.fats != null ? `${profile.nutrition_targets.fats} g` : "—"}</b>
            </span>
          </div>
          <p>
            {profile.nutrition_targets.effective_from
              ? `Vigente desde ${formatDateShort(profile.nutrition_targets.effective_from)}`
              : "Sin meta vigente"}
          </p>
          {changed.length > 0 ? (
            <p className="wp-changed">
              Cambió el {changed.map((d) => formatDateShort(d)).join(", ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
