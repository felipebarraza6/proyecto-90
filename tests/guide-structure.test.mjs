import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  dayStructure,
  editorText,
  headingLevel,
  isBlockHeading,
  listPresentation,
} from "../app/guide-content.ts";
import { AppActionError } from "../app/api-error.ts";
import { deleteAssignedConfirmMessage, isAssignedDeleteConflict } from "../app/program-delete.ts";
import { approvalAfterAssign } from "../app/training-approval.ts";

describe("editorText", () => {
  it("arma guía general con títulos, párrafos unidos y lista", () => {
    const text = editorText([
      { type: "heading", level: 2, text: "Guía general" },
      { type: "paragraph", text: "Duración: 40 minutos" },
      { type: "paragraph", text: "Frecuencia: 4 días" },
      { type: "list", ordered: false, items: ["Progresar cada semana"], text: "• Progresar cada semana" },
    ]);
    assert.equal(text, "## Guía general\n\nDuración: 40 minutos\nFrecuencia: 4 días\n\n- Progresar cada semana");
  });

  it("respeta el salto dentro del párrafo y la línea en blanco entre párrafos", () => {
    const text = editorText([
      { type: "paragraph", text: "Línea uno" },
      { type: "paragraph", text: "Línea dos\nSigue en el mismo" },
      { type: "paragraph", text: "Otro párrafo" },
    ]);
    assert.equal(text, "Línea uno\n\nLínea dos\nSigue en el mismo\n\nOtro párrafo");
  });

  it("numera listas y omite tablas y ejercicios", () => {
    const text = editorText([
      { type: "paragraph", text: "Antes" },
      { type: "table", headers: ["Ejercicio"], rows: [{ cells: ["1. Sentadilla"], exerciseName: "Sentadilla" }] },
      { type: "exercise", name: "Plancha", prescription: "30 s" },
      { type: "paragraph", text: "Después" },
      { type: "list", ordered: true, items: ["Uno", "Dos"] },
    ]);
    assert.equal(text, "Antes\nDespués\n\n1. Uno\n2. Dos");
  });

  it("usa # según el nivel y trata un título sin nivel como ##", () => {
    assert.equal(editorText([{ type: "heading", level: 1, text: "Uno" }]), "# Uno");
    assert.equal(editorText([{ type: "heading", text: "Dos" }]), "## Dos");
    assert.equal(editorText([{ type: "heading", level: 3, text: "Tres" }]), "### Tres");
    assert.equal(headingLevel({ type: "heading" }), 2);
    assert.equal(isBlockHeading({ type: "heading", level: 3, text: "Nota" }), false);
    assert.equal(isBlockHeading({ type: "heading", text: "Bloque A" }), true);
  });
});

describe("dayStructure", () => {
  const nodes = [
    { type: "paragraph", text: "Indicación del día.", indicationId: "ind-1" },
    { type: "list", ordered: false, items: ["Respirar"], indicationId: "ind-1" },
    { type: "paragraph", text: "Otra nota" },
    { type: "heading", level: 2, text: "Calentamiento" },
    { type: "paragraph", text: "30 segundos cada uno:" },
    { type: "paragraph", text: "Marcha activa en el lugar." },
    { type: "heading", level: 2, text: "Bloque A" },
    { type: "paragraph", text: "3 series." },
    { type: "heading", level: 3, text: "Detalle" },
    {
      type: "table",
      headers: ["Ejercicio", "Prescripción"],
      rows: [
        { cells: ["1. Sentadilla", "3 × 10"], exerciseName: "Sentadilla" },
        { cells: ["2. Plancha", "30 s"], exerciseName: "Plancha" },
      ],
    },
  ];

  it("agrupa indicaciones antes del primer bloque y no parte la que comparte id", () => {
    const day = dayStructure(nodes);
    assert.equal(day.indications.length, 2);
    assert.equal(day.indications[0].text, "Indicación del día.\n\n- Respirar");
    assert.equal(day.indications[1].text, "Otra nota");
    assert.equal(day.indications[0].index, 0);
    assert.equal(day.indications[1].index, 1);
  });

  it("separa bloques por título 1 o 2 y deja el nivel 3 dentro", () => {
    const day = dayStructure(nodes);
    assert.deepEqual(day.blocks.map((block) => block.title), ["Calentamiento", "Bloque A"]);
    assert.equal(day.blocks[0].notes[0].text, "30 segundos cada uno:");
    assert.equal(day.blocks[0].exercises[0].name, "Marcha activa en el lugar.");
    assert.equal(day.blocks[0].exercises[0].movable, false);
    assert.equal(day.blocks[1].notes.map((note) => note.text).join("|"), "3 series.|Detalle");
    assert.equal(day.blocks[1].exercises.length, 2);
    assert.equal(day.blocks[1].exercises[0].locator, "row:9:0");
    assert.equal(day.blocks[1].exercises[0].movable, true);
    assert.equal(day.blocks[1].exercises[1].rowIndex, 1);
  });
});

describe("listPresentation", () => {
  it("usa items y, si faltan, el texto visible", () => {
    assert.deepEqual(listPresentation({ type: "list", ordered: true, items: ["Uno", "Dos"] }), { ordered: true, items: ["Uno", "Dos"] });
    assert.deepEqual(listPresentation({ type: "list", ordered: false, text: "• Mantener\n• Respirar" }), { ordered: false, items: ["Mantener", "Respirar"] });
    assert.equal(listPresentation({ type: "paragraph", text: "hola" }), null);
  });
});

describe("eliminar rutina", () => {
  it("pide segunda confirmación con los nombres y distingue emergencia", () => {
    const message = deleteAssignedConfirmMessage([
      { name: "Ana Pérez", email: "ana@example.com", kind: "primary" },
      { name: "", email: "casa@example.com", kind: "emergency" },
    ]);
    assert.match(message, /Ana Pérez \(principal\)/);
    assert.match(message, /casa@example.com \(emergencia\)/);
    assert.doesNotMatch(message, /ana@example.com/);
    const conflict = new AppActionError("confirma", 409, { needsConfirmation: true, students: [] });
    assert.equal(isAssignedDeleteConflict(conflict), true);
    assert.equal(isAssignedDeleteConflict(new AppActionError("otra", 400, {})), false);
    assert.equal(isAssignedDeleteConflict(new Error("confirma")), false);
  });
});

describe("approvalAfterAssign", () => {
  it("la rutina principal queda aprobada con la respuesta y la emergencia no la cambia", () => {
    assert.equal(approvalAfterAssign("pending", { kind: "primary", trainingApprovalStatus: "approved" }), "approved");
    assert.equal(approvalAfterAssign("approved", { kind: "emergency", trainingApprovalStatus: "approved" }), "approved");
    assert.equal(approvalAfterAssign("pending", { kind: "emergency", trainingApprovalStatus: "approved" }), "pending");
  });
});
