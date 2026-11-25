import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { participantDeleteMessage } from "../app/confirm-dialog-logic.ts";

const dialog = readFileSync(new URL("../app/confirm-dialog.tsx", import.meta.url), "utf8");
const restored = readFileSync(new URL("../app/restored-panels.tsx", import.meta.url), "utf8");

describe("mensaje de eliminación de participante", () => {
  it("incluye el nombre y la advertencia de irreversibilidad", () => {
    const message = participantDeleteMessage("Ana Pérez");

    assert.ok(message.includes("Ana Pérez"));
    assert.ok(message.includes("todos sus datos"));
    assert.ok(message.includes("no se puede deshacer"));
  });

  it("usa un genérico cuando el nombre viene vacío", () => {
    const message = participantDeleteMessage("   ");

    assert.ok(message.includes("este participante"));
    assert.ok(message.includes("no se puede deshacer"));
  });
});

describe("ConfirmDialog: diálogo accesible con cancelar por defecto", () => {
  it("se anuncia como diálogo modal con título asociado", () => {
    assert.ok(dialog.includes('role="dialog"'));
    assert.ok(dialog.includes('aria-modal="true"'));
    assert.ok(dialog.includes("aria-labelledby={titleId}"));
    assert.ok(dialog.includes("id={titleId}"));
  });

  it("Escape cancela y solo el clic en el backdrop externo cancela", () => {
    assert.ok(dialog.includes('event.key!=="Escape"'));
    assert.ok(dialog.includes('document.addEventListener("keydown",handleKeyDown)'));
    assert.ok(
      dialog.includes(
        "onMouseDown={event=>{if(event.target===event.currentTarget)onCancel()}}",
      ),
    );
  });

  it("el foco inicial está en Cancelar", () => {
    assert.ok(dialog.includes("const cancelRef=useRef<HTMLButtonElement>(null)"));
    assert.ok(dialog.includes("cancelRef.current?.focus()"));
    assert.ok(dialog.includes("ref={cancelRef}"));
    assert.ok(dialog.includes('cancelLabel="Cancelar"'));
  });

  it("solo el botón destructivo llama a onConfirm", () => {
    const calls = dialog.match(/onConfirm\(\)/g) || [];
    const confirmButton = dialog.slice(
      dialog.indexOf('className="danger-link confirm-action"'),
    );

    assert.equal(calls.length, 1);
    assert.ok(confirmButton.includes("onConfirm()"));
    assert.ok(confirmButton.includes('busy?"Eliminando…":confirmLabel'));
    assert.ok(confirmButton.includes("disabled={busy}"));
  });

  it("no renderiza nada cuando open es false", () => {
    assert.ok(dialog.includes("if(!open)return null"));
  });
});

describe("Participantes: la eliminación pasa por ConfirmDialog", () => {
  it("el botón Eliminar abre el diálogo y ya no usa confirm()", () => {
    assert.ok(
      restored.includes(
        '<button className="danger-link" onClick={()=>setPendingDelete(p)}>Eliminar</button>',
      ),
    );
    assert.ok(
      restored.includes("const [pendingDelete,setPendingDelete]=useState<Row|null>(null)"),
    );

    const flat = restored.replace(/\s+/g, " ");
    assert.ok(!/confirm\s*\([^]{0,400}participant\.delete/.test(flat));
  });

  it("el borrado se ejecuta dentro de onConfirm del ConfirmDialog", () => {
    const dialogStart = restored.indexOf("<ConfirmDialog");
    assert.ok(dialogStart > -1);

    const dialogEnd = restored.indexOf("/>", dialogStart);
    assert.ok(dialogEnd > dialogStart);

    const dialogSource = restored.slice(dialogStart, dialogEnd);
    assert.ok(dialogSource.includes("onConfirm={()=>{void deleteParticipant()}}"));
    assert.ok(dialogSource.includes("participantDeleteMessage(nameOf(pendingDelete))"));
    assert.ok(dialogSource.includes('title="Eliminar participante"'));
    assert.ok(dialogSource.includes("busy={deleting}"));

    const handlerStart = restored.indexOf("async function deleteParticipant");
    const handlerEnd = restored.indexOf("return <><div className=\"admin-title\"", handlerStart);
    assert.ok(handlerStart > -1 && handlerEnd > handlerStart);

    const handler = restored.slice(handlerStart, handlerEnd);
    assert.ok(handler.includes('await act({action:"participant.delete",id:pendingDelete.id})'));
    assert.ok(handler.includes("finally{setDeleting(false);setPendingDelete(null)}"));
    assert.equal((restored.match(/action:"participant\.delete"/g) || []).length, 1);
  });
});
