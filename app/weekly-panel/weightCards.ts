export type ParticipantWeightSource = {
  weight: number | null;
  milestones: Record<number, number | null>;
  latest: number | null;
};

export type ResolvedWeightCards = {
  initial: number | null;
  milestones: { day: number; kg: number | null }[];
  latest: number | null;
  /** True cuando la fila de Participantes pisa el bloque que manda el panel. */
  correctedFromParticipant: boolean;
};

export function participantWeightFromRow(
  person: Record<string, unknown> | null | undefined,
  milestoneDays: number[],
): ParticipantWeightSource | null {
  if (!person) return null;
  const milestones: Record<number, number | null> = {};
  for (const day of milestoneDays) {
    const raw = person[`weight_day_${day}`];
    const num = Number(raw);
    milestones[day] = raw == null || raw === "" || !Number.isFinite(num) ? null : num;
  }
  const weightRaw = person.weight;
  const weightNum = Number(weightRaw);
  const latestRaw = person.latest_weight;
  const latestNum = Number(latestRaw);
  return {
    weight: weightRaw == null || weightRaw === "" || !Number.isFinite(weightNum) ? null : weightNum,
    milestones,
    latest: latestRaw == null || latestRaw === "" || !Number.isFinite(latestNum) ? null : latestNum,
  };
}

function finiteOrNull(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  return value;
}

/**
 * Participantes guarda el peso inicial en el perfil y cada hito en su campo.
 * El panel, si el único control es el del día 30, repite ese kilo en Inicial.
 * Con la fila de Participantes en memoria se muestran esos campos.
 * Sin esa fila no se inventa un inicial ni se rellenan hitos vacíos.
 */
export function resolveStudentWeightCards(input: {
  milestoneDays: number[];
  panelInitialKg: number | null;
  panelMilestones: { day: number; kg: number | null }[];
  panelLatestKg: number | null;
  participant?: ParticipantWeightSource | null;
}): ResolvedWeightCards {
  const participant = input.participant ?? null;
  if (!participant) {
    return {
      initial: finiteOrNull(input.panelInitialKg),
      milestones: input.milestoneDays.map((day) => ({
        day,
        kg: finiteOrNull(input.panelMilestones.find((row) => row.day === day)?.kg ?? null),
      })),
      latest: finiteOrNull(input.panelLatestKg),
      correctedFromParticipant: false,
    };
  }
  return {
    initial: finiteOrNull(participant.weight),
    milestones: input.milestoneDays.map((day) => ({
      day,
      kg: finiteOrNull(participant.milestones[day] ?? null),
    })),
    latest: finiteOrNull(participant.latest),
    correctedFromParticipant: true,
  };
}
