import { isRenderableGuide, parseGuideContent, type Row } from "./guide-content.ts";

export type HomeTrainingCopy = {
  headline: string;
  detail: string;
  action: string;
};

export type TrainingEmptyCopy = {
  title: string;
  copy: string;
  emptyTitle: string;
  emptyCopy: string;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

/** `pending` solo cuenta si el payload lo trae. El bootstrap del alumno hoy no lo envía. */
export function isTrainingApprovalPending(status: unknown): boolean {
  const value = text(status).toLowerCase();
  return value === "pending" || value === "in_review" || value === "review";
}

function guideTitle(guide?: Row | null): string {
  if (!guide || !isRenderableGuide(guide)) return "";
  return text(parseGuideContent(guide)?.title);
}

function firstWorkoutName(workouts?: { name?: unknown; title?: unknown }[]): string {
  const first = workouts?.[0];
  if (!first) return "";
  return text(first.name || first.title);
}

/**
 * Inicio usa el mismo criterio que Entrenamiento: programa, guía renderizable o workouts.
 * Sin ninguno de esos datos, "en preparación". El copy de revisión solo aplica si llega un estado.
 */
export function homeTrainingCopy(input: {
  program?: { name?: unknown } | null;
  guide?: Row | null;
  workouts?: { name?: unknown; title?: unknown }[];
  trainingApprovalStatus?: unknown;
}): HomeTrainingCopy {
  const programName = text(input.program?.name);
  const title = guideTitle(input.guide);
  const workoutName = firstWorkoutName(input.workouts);
  const hasRoutine = Boolean(programName || title || workoutName);
  if (!hasRoutine && isTrainingApprovalPending(input.trainingApprovalStatus)) {
    return {
      headline: "Tu programa está en revisión por tu coach",
      detail: "Cuando tu coach termine la revisión vas a ver la rutina aquí.",
      action: "Ver estado",
    };
  }
  if (workoutName) {
    return {
      headline: workoutName,
      detail: programName || "Tu rutina asignada.",
      action: "Abrir mi entrenamiento",
    };
  }
  if (programName || title) {
    return {
      headline: programName || title,
      detail: programName && title && programName !== title ? title : "Tu rutina ya está asignada.",
      action: "Abrir mi entrenamiento",
    };
  }
  return {
    headline: "Tu ruta está en preparación",
    detail: "El equipo te asignará un programa.",
    action: "Ver estado",
  };
}

export function trainingEmptyCopy(input: {
  program?: { name?: unknown } | null;
  trainingApprovalStatus?: unknown;
}): TrainingEmptyCopy {
  const programName = text(input.program?.name);
  if (!programName && isTrainingApprovalPending(input.trainingApprovalStatus)) {
    return {
      title: "Tu programa está en revisión por tu coach",
      copy: "Tu coach está revisando la rutina. Te avisaremos cuando quede disponible.",
      emptyTitle: "En revisión",
      emptyCopy: "Tu programa está en revisión por tu coach.",
    };
  }
  if (programName) {
    return {
      title: programName,
      copy: "Tu rutina se está preparando.",
      emptyTitle: "Estamos preparando tu ruta",
      emptyCopy: "Te avisaremos cuando los días de esta rutina estén listos.",
    };
  }
  return {
    title: "Entrenamiento pendiente",
    copy: "El equipo todavía no te asigna un programa.",
    emptyTitle: "Estamos preparando tu ruta",
    emptyCopy: "Te avisaremos cuando tu programa esté asignado.",
  };
}
