import { isRenderableGuide, type Row } from "./guide-content.ts";

export type WorkoutDay = {
  id: string;
  month?: unknown;
  week?: unknown;
  name: string;
  exercises: Row[];
};

export function filterWorkoutsForProgram(workouts: Row[], programId?: unknown): Row[] {
  if (programId == null || programId === "") return workouts;
  const withProgram = workouts.filter((w) => w.program_id != null && w.program_id !== "");
  if (withProgram.length === 0) return workouts;
  return workouts.filter((w) => String(w.program_id) === String(programId));
}

export function buildWorkoutDays(workouts: Row[], workoutExercises: Row[]): WorkoutDay[] {
  return workouts.map((w) => ({
    id: String(w.id),
    month: w.month,
    week: w.week,
    name: String(w.name || w.title || "Sesión"),
    exercises: workoutExercises.filter((x) => String(x.workout_id) === String(w.id)),
  }));
}

export function exercisePrescription(exercise: Row): string {
  const sets = exercise.sets != null && exercise.sets !== "" ? String(exercise.sets) : "";
  const reps =
    exercise.reps != null && exercise.reps !== ""
      ? String(exercise.reps)
      : exercise.duration != null && exercise.duration !== ""
        ? String(exercise.duration)
        : "";
  const rest =
    exercise.rest_seconds != null && exercise.rest_seconds !== ""
      ? `${String(exercise.rest_seconds)}s descanso`
      : "";
  const volume = sets && reps ? `${sets} × ${reps}` : reps || sets;
  return [volume, rest].filter(Boolean).join(" · ");
}

export type TrainingView =
  | { kind: "guide"; primaryGuideRow?: Row; emergencyGuideRow?: Row }
  | { kind: "workouts"; days: WorkoutDay[] }
  | { kind: "empty" };

export function resolveTrainingView(args: {
  guideRow?: Row;
  emergencyGuideRow?: Row;
  workouts: Row[];
  workoutExercises: Row[];
  programId?: unknown;
}): TrainingView {
  const primary = isRenderableGuide(args.guideRow);
  const emergency = isRenderableGuide(args.emergencyGuideRow);
  if (primary || emergency) {
    return {
      kind: "guide",
      primaryGuideRow: primary ? args.guideRow : undefined,
      emergencyGuideRow: emergency ? args.emergencyGuideRow : undefined,
    };
  }
  const days = buildWorkoutDays(
    filterWorkoutsForProgram(args.workouts, args.programId),
    args.workoutExercises,
  );
  return days.length ? { kind: "workouts", days } : { kind: "empty" };
}
