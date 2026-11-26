import { useEffect, useState } from "react";
import { approvalAfterAssign } from "./training-approval";
import { primaryAssignControl, primaryAssignMessage } from "./primary-assign";

type ProgramOption = { id: string; name: string };

export function PrimaryRoutineAssign({
  programs,
  programId,
  programName,
  approvalStatus,
  onAssign,
}: {
  programs: ProgramOption[];
  programId: string;
  programName: string;
  approvalStatus: string;
  onAssign: (programId: string) => Promise<{ trainingApprovalStatus?: unknown } | undefined | null | void>;
}) {
  const [choice, setChoice] = useState(programId);
  const [feedback, setFeedback] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setChoice(programId);
    setFeedback("");
    setError("");
  }, [programId, approvalStatus]);
  const control = primaryAssignControl(choice, programId, approvalStatus);
  const current = programName.trim() || "Sin asignar";
  const approved = approvalStatus === "approved" && Boolean(programId);
  return (
    <div className="primary-routine-assign">
      <p className="primary-routine-current">
        Rutina actual: <b>{current}</b>
        {programId ? <span>{approved ? " · Aprobada" : " · Pendiente de aprobación"}</span> : null}
      </p>
      <div className="coach-program-assignment">
        <label>
          Rutina principal
          <select value={choice} onChange={(event) => setChoice(event.target.value)}>
            <option value="">Selecciona una rutina…</option>
            {programs.map((program) => (
              <option key={program.id} value={program.id}>{program.name}</option>
            ))}
          </select>
        </label>
        <button
          className="primary"
          type="button"
          disabled={control.disabled || busy}
          onClick={async () => {
            setBusy(true);
            setError("");
            setFeedback("");
            try {
              const json = await onAssign(choice);
              const next = approvalAfterAssign(approvalStatus, {
                kind: "primary",
                trainingApprovalStatus: json?.trainingApprovalStatus,
              });
              const picked = programs.find((program) => program.id === choice)?.name || programName;
              setFeedback(primaryAssignMessage(next, picked));
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "No se pudo asignar la rutina.");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Asignando…" : control.label}
        </button>
      </div>
      {feedback ? <p className="assign-note">{feedback}</p> : null}
      {error ? <p className="assign-note error">{error}</p> : null}
    </div>
  );
}
