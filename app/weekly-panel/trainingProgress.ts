/**
 * Texto de avance de entrenamientos en la ficha.
 * Si done >= planned, nunca se muestra como «parcial».
 */
export type TrainingProgressInput = {
  done: number;
  planned: number | null;
  partial?: boolean | null;
};

export type TrainingProgressDisplay = {
  primary: string;
  note?: string;
};

export function trainingProgressDisplay(
  progress: TrainingProgressInput,
  options?: { weekClosed?: boolean },
): TrainingProgressDisplay {
  const done = Number(progress.done) || 0;
  const plannedRaw = progress.planned;
  const planned =
    plannedRaw == null || !Number.isFinite(Number(plannedRaw)) ? null : Number(plannedRaw);
  const weekClosed = Boolean(options?.weekClosed);

  if (planned != null && planned > 0 && done >= planned) {
    return {
      primary: `Plan cumplido · ${done} de ${planned}`,
      note: done > planned ? "Meta superada" : undefined,
    };
  }

  const primary = `${done} de ${planned ?? "—"}`;
  if (progress.partial && !weekClosed) {
    return { primary, note: "Avance parcial (semana en curso)" };
  }
  return { primary };
}
