import {
  formatDateLong,
  formatDateShort,
  formatKg,
  formatMlAsLiters,
  formatPct,
} from "./format";
import { StatusBadges } from "./ui";
import type { StudentWeekResponse } from "./types";

function weightLine(
  point: StudentWeekResponse["profile"]["weight"]["initial"],
  fallback: string,
): string {
  if (!point || point.kg == null) return fallback;
  const date = point.date ? ` · ${formatDateShort(point.date)}` : "";
  return `${formatKg(point.kg)}${date}`;
}

export function StudentFacts({
  data,
  showRoutine,
  showNutrition,
}: {
  data: StudentWeekResponse;
  showRoutine: boolean;
  showNutrition: boolean;
}) {
  const { profile, weekly, training_progress: progress } = data;
  const changed = profile.nutrition_targets.changed_in_week || [];
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
          <b>{formatPct(weekly.pct)}</b>
          <StatusBadges status={weekly.status} />
        </div>
      </header>
      <dl className="wp-facts-grid">
        <div>
          <dt>Peso inicial</dt>
          <dd>{weightLine(profile.weight.initial, "No informado")}</dd>
        </div>
        <div>
          <dt>Último peso</dt>
          <dd>{weightLine(profile.weight.latest, "No informado")}</dd>
        </div>
        <div>
          <dt>Estatura</dt>
          <dd>{profile.height_cm != null ? `${profile.height_cm} cm` : "No informada"}</dd>
        </div>
        <div>
          <dt>Objetivo</dt>
          <dd>{profile.goal || "—"}</dd>
        </div>
        <div>
          <dt>Inicio del desafío</dt>
          <dd>
            {formatDateLong(profile.challenge_start)}
            {profile.challenge_day != null ? (
              <small>
                día {profile.challenge_day} / semana {profile.challenge_week ?? "—"} del desafío
              </small>
            ) : (
              <small>Aún no inicia</small>
            )}
          </dd>
        </div>
        <div>
          <dt>Entrenamientos</dt>
          <dd>
            {progress.done} de {progress.planned ?? "—"}
            {progress.partial ? <small>Avance parcial (semana en curso)</small> : null}
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
            {profile.nutrition_targets.approved_by
              ? ` · ${profile.nutrition_targets.approved_by}`
              : ""}
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
