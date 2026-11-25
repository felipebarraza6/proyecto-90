import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { reviewerMutationBlocked } from "../app/staff-guards.ts";

const functional = readFileSync(new URL("../app/functional-app.tsx", import.meta.url), "utf8");
const restored = readFileSync(new URL("../app/restored-panels.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("UI de revisor: solo lectura explícita", () => {
  it("reviewerMutationBlocked solo bloquea al rol reviewer", () => {
    assert.equal(reviewerMutationBlocked("reviewer"), true);
    assert.equal(reviewerMutationBlocked("admin"), false);
    assert.equal(reviewerMutationBlocked("professional"), false);
    assert.equal(reviewerMutationBlocked("participant"), false);
  });

  it("AdminArea propaga readOnly y oculta creación/asignación de participantes", () => {
    assert.ok(functional.includes("const readOnly=reviewerMutationBlocked(data.viewer.role);"));
    assert.ok(functional.includes("canCreate={!readOnly}"));
    assert.ok(functional.includes("canAssignProgram={!readOnly}"));
    assert.ok(functional.includes("{!readOnly&&<button className=\"primary\" onClick={()=>open(\"participant\")}>＋ Crear participante</button>}"));
  });

  it("Resumen sin listado duplicado y acciones mutantes ocultas al revisor", () => {
    assert.ok(!functional.includes("<PeopleTable"));
    assert.ok(!functional.includes("people.slice(0,6)"));
    assert.ok(!functional.includes("Editar ›"));
    assert.ok(functional.includes("canEditCells={!readOnly}"));
    assert.ok(functional.includes("canMarkContact={!readOnly}"));
  });

  it("Profesionales y programas ocultan acciones mutantes al revisor", () => {
    assert.ok(functional.includes("action={readOnly?undefined:<div className=\"inline-actions\">"));
    assert.ok(functional.includes("{!readOnly&&<div className=\"team-actions\">"));
    assert.ok(functional.includes("admin={!readOnly}"));
    assert.ok(functional.includes("{!readOnly&&<GuideEditor"));
    assert.ok(functional.includes("canPauseMacros={!readOnly}"));
    assert.ok(functional.includes("canDeleteNotes={!readOnly}"));
    assert.ok(functional.includes("action={readOnly?undefined:<button className=\"primary\" onClick={()=>open(\"program\")}>＋ Crear rutina</button>}"));
  });

  it("Sesiones oculta crear, gestionar, editar y eliminar al revisor", () => {
    assert.ok(restored.includes("readOnly?:boolean"));
    assert.ok(restored.includes("{!readOnly&&<button className=\"primary\" onClick={()=>open(\"session\")}>＋ Nueva sesión</button>}"));
    assert.ok(restored.includes("{!readOnly&&<button className=\"primary\" onClick={()=>open(\"meeting-review\",x)}>Gestionar</button>}"));
    assert.ok(restored.includes("{!readOnly&&<><button className=\"row-action\" onClick={()=>open(\"session\",x)}>Editar</button>"));
  });

  it("mantiene el CSS como segunda barrera del shell revisor", () => {
    assert.ok(css.includes(".reviewer-shell button.primary"));
    assert.ok(css.includes(".reviewer-shell .row-action"));
  });
});
