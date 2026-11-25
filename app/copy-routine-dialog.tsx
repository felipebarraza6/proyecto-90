"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import { copiedRoutineName } from "./copy-routine";

/**
 * Diálogo para duplicar una rutina con nombre editable.
 * El foco parte en el input, Escape y el backdrop cancelan.
 */
export function CopyRoutineDialog({ originalName, onCopy, onClose }: { originalName: string; onCopy: (name: string) => Promise<unknown>; onClose: () => void }) {
  const [name, setName] = useState(() => copiedRoutineName(originalName));
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const finalName = name.trim();
    if (!finalName || saving) return;
    setSaving(true);
    try {
      await onCopy(finalName);
    } catch {
      /* act muestra el error global; cerramos igual para no dejar el diálogo colgado. */
    } finally {
      setSaving(false);
      onClose();
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="editor-modal copy-routine-dialog" role="dialog" aria-modal="true" aria-labelledby="copy-routine-title">
        <div className="modal-head">
          <div>
            <span className="eyebrow">DUPLICAR RUTINA</span>
            <h2 id="copy-routine-title">Copiar rutina</h2>
          </div>
          <button type="button" className="modal-close" aria-label="Cerrar" onClick={onClose}>×</button>
        </div>
        <form onSubmit={submit}>
          <p className="modal-context">Se copian la guía, los días, los ejercicios y la progresión. La copia queda seleccionada al terminar.</p>
          <label>
            Nombre de la copia
            <input ref={inputRef} name="name" value={name} onChange={(event) => setName(event.target.value)} aria-label="Nombre de la copia" required />
          </label>
          <div className="editor-actions">
            <button type="button" className="secondary" onClick={onClose}>Cancelar</button>
            <button type="submit" className="primary" disabled={saving || !name.trim()}>{saving ? "Copiando…" : "Copiar"}</button>
          </div>
        </form>
      </section>
    </div>
  );
}
