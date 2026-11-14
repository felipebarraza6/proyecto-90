"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { dayStructure, editorText, parseGuideContent, type DayBlock, type DayExercise, type GuideNode } from "./guide-content";

type Row = Record<string, unknown>;
type Act = (payload: Row) => Promise<unknown>;

export function GuideEditor({ guideRow, exercises, act }: { guideRow: Row; exercises: Row[]; act: Act }) {
  const guide = useMemo(() => parseGuideContent(guideRow), [guideRow]);
  const programId = String(guideRow.program_id || guide?.programId || "");
  const days = guide?.days || [];
  const [tab, setTab] = useState("overview");
  useEffect(() => { setTab("overview"); }, [programId]);
  if (!guide) return null;
  const overviewText = editorText(guide.overview);
  const referenceText = editorText(guide.reference);
  const dayIndex = tab.startsWith("day-") ? Number(tab.slice(4)) : -1;
  const day = dayIndex >= 0 ? days[dayIndex] : undefined;
  return (
    <section className="guide-editor">
      <div className="guide-editor-heading">
        <div>
          <span className="eyebrow">EDITOR DE RUTINA</span>
          <h2>Guía, días y progresión</h2>
          <p>Guía general y Progresión se editan completas. En cada día, las indicaciones van antes de los bloques.</p>
        </div>
      </div>
      <div className="guide-day-tabs" role="tablist" aria-label="Secciones de la rutina">
        <button type="button" className={tab === "overview" ? "active" : ""} onClick={() => setTab("overview")}><span>Texto</span><b>Guía general</b></button>
        {days.map((item, index) => (
          <button type="button" key={`${index}-${item.title}`} className={tab === `day-${index}` ? "active" : ""} onClick={() => setTab(`day-${index}`)}>
            <span>Día {index + 1}</span>
            <b>{String(item.title || `Entrenamiento ${index + 1}`).replace(/^[^—]+—\s*/, "")}</b>
          </button>
        ))}
        <button type="button" className={tab === "reference" ? "active" : ""} onClick={() => setTab("reference")}><span>Texto</span><b>Progresión</b></button>
      </div>
      {tab === "overview" && (
        <SectionEditor
          label="Guía general"
          hint="Un salto de línea sigue en el párrafo. Una línea en blanco separa párrafos. #, ## y ### son títulos. Las listas empiezan con «- » o «1. »."
          source={overviewText}
          onSave={(text, expected) => act({ action: "program.guide.section.save", programId, section: "overview", text, expected })}
        />
      )}
      {tab === "reference" && (
        <SectionEditor
          label="Progresión"
          hint="Todo el texto de progresión se guarda junto. Las listas y los títulos usan el mismo formato que la guía general."
          source={referenceText}
          onSave={(text, expected) => act({ action: "program.guide.section.save", programId, section: "reference", text, expected })}
        />
      )}
      {day && dayIndex >= 0 && <DayEditor programId={programId} dayIndex={dayIndex} nodes={day.nodes || []} exercises={exercises} act={act} />}
    </section>
  );
}

function SectionEditor({ label, hint, source, onSave }: { label: string; hint: string; source: string; onSave: (text: string, expected: string) => Promise<unknown> }) {
  const [value, setValue] = useState(source);
  const [busy, setBusy] = useState(false);
  useEffect(() => { setValue(source); }, [source]);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!value.trim() || value === source) return;
    setBusy(true);
    try { await onSave(value, source); } catch { /* act muestra el error */ } finally { setBusy(false); }
  }
  return (
    <form className="guide-section-editor" onSubmit={submit}>
      <label>
        {label}
        <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={12} aria-label={label} />
      </label>
      <p>{hint}</p>
      <button className="primary" disabled={busy || !value.trim() || value === source}>{busy ? "Guardando…" : "Guardar sección"}</button>
    </form>
  );
}

function DayEditor({ programId, dayIndex, nodes, exercises, act }: { programId: string; dayIndex: number; nodes: GuideNode[]; exercises: Row[]; act: Act }) {
  const structure = useMemo(() => dayStructure(nodes), [nodes]);
  const [busy, setBusy] = useState("");
  async function run(key: string, payload: Row) {
    setBusy(key);
    try { await act(payload); return true; } catch { return false; } finally { setBusy(""); }
  }
  return (
    <div className="guide-day-editor">
      <section className="guide-indications">
        <div className="guide-editor-heading">
          <span className="eyebrow">ANTES DE LOS BLOQUES</span>
          <h3>Indicaciones del día</h3>
          <p>Cada indicación se agrega, edita o elimina completa. Un salto de línea no la parte.</p>
        </div>
        {structure.indications.filter((item) => item.text.trim()).length === 0 && <p className="empty-copy">Este día no tiene indicaciones antes de los bloques.</p>}
        {structure.indications.filter((item) => item.text.trim()).map((item) => (
          <IndicationCard
            key={`${dayIndex}-${item.index}-${item.text}`}
            item={item}
            busy={busy === `ind-${item.index}`}
            onSave={(text) => run(`ind-${item.index}`, { action: "program.guide.indication.update", programId, section: "days", dayIndex, index: item.index, text, expected: item.text })}
            onRemove={() => {
              if (!confirm("¿Eliminar esta indicación del día?")) return;
              return run(`ind-${item.index}`, { action: "program.guide.indication.remove", programId, section: "days", dayIndex, index: item.index, expected: item.text });
            }}
          />
        ))}
        <IndicationAdd busy={busy === "ind-add"} onAdd={(text) => run("ind-add", { action: "program.guide.indication.add", programId, section: "days", dayIndex, text })} />
      </section>
      <section className="guide-blocks">
        <div className="guide-editor-heading">
          <span className="eyebrow">BLOQUES</span>
          <h3>Bloques del día</h3>
          <p>Puedes agregar, renombrar, reordenar y eliminar bloques, y mover o sumar ejercicios dentro de cada uno.</p>
        </div>
        {structure.blocks.length === 0 && <p className="empty-copy">Este día todavía no tiene bloques.</p>}
        {structure.blocks.map((block) => (
          <BlockCard
            key={`${dayIndex}-${block.index}-${block.title}`}
            block={block}
            blockCount={structure.blocks.length}
            blocks={structure.blocks}
            exercises={exercises}
            busy={busy}
            onRename={(title) => run(`block-${block.index}`, { action: "program.guide.block.rename", programId, dayIndex, blockIndex: block.index, title, expected: block.title })}
            onReorder={(toIndex) => run(`block-${block.index}`, { action: "program.guide.block.reorder", programId, dayIndex, fromIndex: block.index, toIndex })}
            onRemove={() => {
              if (!confirm(`¿Eliminar el bloque «${block.title}»?\n\nSe quitan sus ejercicios de este día. No se borran de la biblioteca.`)) return;
              return run(`block-${block.index}`, { action: "program.guide.block.remove", programId, dayIndex, blockIndex: block.index, expected: block.title });
            }}
            onNoteSave={(note, text) => run(`note-${note.nodeIndex}`, { action: "program.guide.text.update", programId, section: "days", dayIndex, index: note.nodeIndex, text, expected: note.text })}
            onNoteRemove={(note) => {
              if (!confirm("¿Retirar esta nota del bloque?")) return;
              return run(`note-${note.nodeIndex}`, { action: "program.guide.text.remove", programId, section: "days", dayIndex, index: note.nodeIndex, expected: note.text });
            }}
            onExerciseSave={(item, name, prescription) => run(item.locator, { action: "program.guide.exercise.update", programId, dayIndex, locator: item.locator, name, prescription })}
            onExerciseRemove={(item) => {
              if (!confirm(`¿Retirar ${item.name || "este ejercicio"} de este día?`)) return;
              return run(item.locator, { action: "program.guide.exercise.remove", programId, dayIndex, locator: item.locator });
            }}
            onExerciseMove={(item, toBlock, toIndex) => run(item.locator, {
              action: "program.guide.exercise.move",
              programId,
              dayIndex,
              fromBlock: block.index,
              toBlock,
              fromIndex: item.rowIndex,
              ...(toIndex == null ? {} : { toIndex }),
            })}
            onExerciseAdd={(exerciseId, prescription) => run(`add-${block.index}`, { action: "program.guide.exercise.add", programId, dayIndex, blockIndex: block.index, exerciseId, ...(prescription ? { prescription } : {}) })}
          />
        ))}
        <BlockAdd busy={busy === "block-add"} onAdd={(title) => run("block-add", { action: "program.guide.block.add", programId, dayIndex, title })} />
      </section>
    </div>
  );
}

function IndicationCard({ item, busy, onSave, onRemove }: { item: { text: string }; busy: boolean; onSave: (text: string) => Promise<unknown>; onRemove: () => Promise<unknown> | void }) {
  const [value, setValue] = useState(item.text);
  useEffect(() => { setValue(item.text); }, [item.text]);
  return (
    <form className="guide-indication-card" onSubmit={(event) => { event.preventDefault(); if (value.trim() && value !== item.text) void onSave(value); }}>
      <label>
        Indicación
        <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={5} aria-label="Texto de la indicación" />
      </label>
      <div className="guide-card-actions">
        <button className="secondary" disabled={busy || !value.trim() || value === item.text}>{busy ? "Guardando…" : "Guardar indicación"}</button>
        <button type="button" className="danger-link" disabled={busy} onClick={() => void onRemove()}>Eliminar indicación</button>
      </div>
    </form>
  );
}

function IndicationAdd({ busy, onAdd }: { busy: boolean; onAdd: (text: string) => Promise<boolean> }) {
  const [value, setValue] = useState("");
  return (
    <form className="guide-indication-card" onSubmit={(event) => { event.preventDefault(); if (!value.trim()) return; void onAdd(value).then((saved) => { if (saved) setValue(""); }); }}>
      <label>
        Nueva indicación
        <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={4} placeholder={"Antes de empezar\n\n- Mantener el abdomen\n- Respirar"} aria-label="Nueva indicación" />
      </label>
      <button className="primary" disabled={busy || !value.trim()}>{busy ? "Agregando…" : "＋ Agregar indicación"}</button>
    </form>
  );
}

function BlockCard({
  block, blockCount, blocks, exercises, busy, onRename, onReorder, onRemove, onNoteSave, onNoteRemove, onExerciseSave, onExerciseRemove, onExerciseMove, onExerciseAdd,
}: {
  block: DayBlock;
  blockCount: number;
  blocks: DayBlock[];
  exercises: Row[];
  busy: string;
  onRename: (title: string) => Promise<unknown>;
  onReorder: (toIndex: number) => Promise<unknown>;
  onRemove: () => Promise<unknown> | void;
  onNoteSave: (note: { nodeIndex: number; text: string }, text: string) => Promise<unknown>;
  onNoteRemove: (note: { nodeIndex: number; text: string }) => Promise<unknown> | void;
  onExerciseSave: (item: DayExercise, name: string, prescription: string) => Promise<unknown>;
  onExerciseRemove: (item: DayExercise) => Promise<unknown> | void;
  onExerciseMove: (item: DayExercise, toBlock: number, toIndex?: number) => Promise<unknown>;
  onExerciseAdd: (exerciseId: string, prescription: string) => Promise<boolean>;
}) {
  const [title, setTitle] = useState(block.title);
  const [target, setTarget] = useState("");
  useEffect(() => { setTitle(block.title); }, [block.title]);
  const tableRows = block.exercises.filter((item) => item.movable && item.rowIndex != null);
  const rowCount = tableRows.length;
  return (
    <article className="guide-block-card">
      <form className="guide-block-head" onSubmit={(event) => { event.preventDefault(); if (title.trim() && title !== block.title) void onRename(title.trim()); }}>
        <label>
          Nombre del bloque
          <input value={title} onChange={(event) => setTitle(event.target.value)} aria-label={`Nombre del bloque ${block.title}`} />
        </label>
        <div className="guide-card-actions">
          <button className="secondary" disabled={busy === `block-${block.index}` || !title.trim() || title === block.title}>Renombrar</button>
          <button type="button" className="secondary" disabled={block.index === 0 || Boolean(busy)} onClick={() => void onReorder(block.index - 1)}>Subir bloque</button>
          <button type="button" className="secondary" disabled={block.index >= blockCount - 1 || Boolean(busy)} onClick={() => void onReorder(block.index + 1)}>Bajar bloque</button>
          <button type="button" className="danger-link" disabled={Boolean(busy)} onClick={() => void onRemove()}>Eliminar bloque</button>
        </div>
      </form>
      {block.notes.length > 0 && (
        <div className="guide-block-notes">
          {block.notes.map((note) => <NoteRow key={note.nodeIndex} note={note} busy={busy === `note-${note.nodeIndex}`} onSave={(text) => onNoteSave(note, text)} onRemove={() => onNoteRemove(note)} />)}
        </div>
      )}
      <div className="guide-edit-list">
        {block.exercises.length === 0 && <p className="empty-copy">Este bloque no tiene ejercicios.</p>}
        {block.exercises.map((item, number) => (
          <ExerciseRow
            key={item.locator}
            item={item}
            number={number + 1}
            busy={busy === item.locator}
            rowCount={rowCount}
            onSave={(name, prescription) => onExerciseSave(item, name, prescription)}
            onRemove={() => onExerciseRemove(item)}
            onShift={(direction) => { if (item.rowIndex == null) return; return onExerciseMove(item, block.index, item.rowIndex + direction); }}
          />
        ))}
      </div>
      {block.exercises.some((item) => item.movable) && (
        <MoveRows block={block} blocks={blocks} target={target} setTarget={setTarget} busy={Boolean(busy)} onMove={onExerciseMove} />
      )}
      <AddExercise exercises={exercises} busy={busy === `add-${block.index}`} onAdd={onExerciseAdd} />
    </article>
  );
}

function MoveRows({ block, blocks, target, setTarget, busy, onMove }: { block: DayBlock; blocks: DayBlock[]; target: string; setTarget: (value: string) => void; busy: boolean; onMove: (item: DayExercise, toBlock: number, toIndex?: number) => Promise<unknown> }) {
  const [fromLocator, setFromLocator] = useState("");
  const rows = block.exercises.filter((item) => item.movable && item.rowIndex != null);
  if (rows.length === 0 || blocks.length < 2) return null;
  const selected = rows.find((item) => item.locator === fromLocator) || rows[0];
  return (
    <div className="guide-move-row">
      <label>
        Ejercicio
        <select value={selected.locator} onChange={(event) => setFromLocator(event.target.value)} aria-label="Ejercicio a mover">
          {rows.map((item) => <option value={item.locator} key={item.locator}>{item.name || "Ejercicio"}</option>)}
        </select>
      </label>
      <label>
        Llevar a otro bloque
        <select value={target} onChange={(event) => setTarget(event.target.value)} aria-label="Bloque de destino">
          <option value="">Elegir bloque…</option>
          {blocks.filter((item) => item.index !== block.index).map((item) => <option value={String(item.index)} key={item.index}>{item.title || `Bloque ${item.index + 1}`}</option>)}
        </select>
      </label>
      <button type="button" className="secondary" disabled={busy || target === ""} onClick={() => void onMove(selected, Number(target))}>Mover ejercicio</button>
    </div>
  );
}

function NoteRow({ note, busy, onSave, onRemove }: { note: { text: string; kind: string }; busy: boolean; onSave: (text: string) => Promise<unknown>; onRemove: () => Promise<unknown> | void }) {
  const [value, setValue] = useState(note.text);
  useEffect(() => { setValue(note.text); }, [note.text]);
  return (
    <form className="guide-note-row" onSubmit={(event) => { event.preventDefault(); if (value.trim() && value !== note.text) void onSave(value); }}>
      <label>
        {note.kind === "heading" ? "Título interno" : "Nota del bloque"}
        <textarea value={value} onChange={(event) => setValue(event.target.value)} rows={2} aria-label={note.kind === "heading" ? "Título interno del bloque" : "Nota del bloque"} />
      </label>
      <div className="guide-card-actions">
        <button className="secondary" disabled={busy || !value.trim() || value === note.text}>{busy ? "Guardando…" : "Guardar nota"}</button>
        <button type="button" className="danger-link" disabled={busy} onClick={() => void onRemove()}>Retirar nota</button>
      </div>
    </form>
  );
}

function ExerciseRow({ item, number, busy, rowCount, onSave, onRemove, onShift }: { item: DayExercise; number: number; busy: boolean; rowCount: number; onSave: (name: string, prescription: string) => Promise<unknown>; onRemove: () => Promise<unknown> | void; onShift: (direction: -1 | 1) => Promise<unknown> | void }) {
  const [name, setName] = useState(item.name);
  const [prescription, setPrescription] = useState(item.prescription);
  useEffect(() => { setName(item.name); setPrescription(item.prescription); }, [item.name, item.prescription]);
  return (
    <article>
      <span className="guide-edit-number">{number}</span>
      <label>Ejercicio<input value={name} onChange={(event) => setName(event.target.value)} /></label>
      <label>Series, repeticiones o tiempo<input value={prescription} onChange={(event) => setPrescription(event.target.value)} placeholder="Ej. 3 × 10 · 60 s descanso" /></label>
      <div className="guide-row-actions">
        <button type="button" className="secondary" disabled={busy || !name.trim()} onClick={() => void onSave(name, prescription)}>{busy ? "Guardando…" : "Guardar"}</button>
        <button type="button" className="danger-link" disabled={busy} onClick={() => void onRemove()}>Retirar</button>
        {item.movable && item.rowIndex != null && (
          <>
            <button type="button" className="secondary" disabled={busy || item.rowIndex === 0} onClick={() => void onShift(-1)}>Subir</button>
            <button type="button" className="secondary" disabled={busy || item.rowIndex >= rowCount - 1} onClick={() => void onShift(1)}>Bajar</button>
          </>
        )}
      </div>
    </article>
  );
}

function AddExercise({ exercises, busy, onAdd }: { exercises: Row[]; busy: boolean; onAdd: (exerciseId: string, prescription: string) => Promise<boolean> }) {
  return (
    <form className="guide-add-exercise" onSubmit={(event) => {
      event.preventDefault();
      const formElement = event.currentTarget;
      const form = new FormData(formElement);
      const exerciseId = String(form.get("exerciseId") || "");
      if (!exerciseId) return;
      void onAdd(exerciseId, String(form.get("prescription") || "")).then((saved) => { if (saved) formElement.reset(); });
    }}>
      <label>Ejercicio de la biblioteca
        <select name="exerciseId" required defaultValue="">
          <option value="" disabled>Selecciona un ejercicio…</option>
          {exercises.map((exercise) => <option value={String(exercise.id)} key={String(exercise.id)}>{String(exercise.name)}</option>)}
        </select>
      </label>
      <label>Indicación<input name="prescription" placeholder="3 × 10 · 60 s descanso" /></label>
      <button className="primary" disabled={busy}>{busy ? "Agregando…" : "＋ Agregar al bloque"}</button>
    </form>
  );
}

function BlockAdd({ busy, onAdd }: { busy: boolean; onAdd: (title: string) => Promise<boolean> }) {
  const [title, setTitle] = useState("");
  return (
    <form className="guide-block-add" onSubmit={(event) => { event.preventDefault(); const next = title.trim(); if (!next) return; void onAdd(next).then((saved) => { if (saved) setTitle(""); }); }}>
      <label>Nuevo bloque<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Ej. Accesorio" aria-label="Nombre del bloque nuevo" /></label>
      <button className="primary" disabled={busy || !title.trim()}>{busy ? "Agregando…" : "＋ Agregar bloque"}</button>
    </form>
  );
}

