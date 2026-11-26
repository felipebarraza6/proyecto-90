import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { homeTrainingCopy, trainingEmptyCopy } from "../app/home-training-copy.ts";
import { primaryAssignControl, primaryAssignMessage } from "../app/primary-assign.ts";

const guide = {
  content_json: JSON.stringify({
    title: "Guía base",
    overview: [],
    days: [{ title: "D1", nodes: [{ type: "exercise", name: "Sentadilla" }] }],
    reference: [],
  }),
};

describe("homeTrainingCopy", () => {
  it("reconoce la rutina por programa o guía aunque no haya workouts", () => {
    const byProgram = homeTrainingCopy({ program: { name: "Fuerza 90" }, guide: undefined, workouts: [] });
    assert.equal(byProgram.headline, "Fuerza 90");
    assert.equal(byProgram.action, "Abrir mi entrenamiento");
    assert.notEqual(byProgram.headline, "Tu ruta está en preparación");

    const byGuide = homeTrainingCopy({ program: null, guide, workouts: [] });
    assert.equal(byGuide.headline, "Guía base");
    assert.equal(byGuide.action, "Abrir mi entrenamiento");
  });

  it("prioriza el primer workout y conserva el nombre del programa", () => {
    const copy = homeTrainingCopy({
      program: { name: "Fuerza 90" },
      workouts: [{ name: "Día 1 · Empuje" }],
    });
    assert.equal(copy.headline, "Día 1 · Empuje");
    assert.equal(copy.detail, "Fuerza 90");
  });

  it("sin rutina sigue en preparación", () => {
    const copy = homeTrainingCopy({ program: null, guide: null, workouts: [] });
    assert.equal(copy.headline, "Tu ruta está en preparación");
    assert.equal(copy.detail, "El equipo te asignará un programa.");
    assert.equal(copy.action, "Ver estado");
  });

  it("copy de revisión solo si el payload trae el estado y no hay rutina visible", () => {
    const pending = homeTrainingCopy({ trainingApprovalStatus: "pending" });
    assert.equal(pending.headline, "Tu programa está en revisión por tu coach");
    const visible = homeTrainingCopy({
      program: { name: "Fuerza 90" },
      trainingApprovalStatus: "pending",
    });
    assert.equal(visible.headline, "Fuerza 90");
  });
});

describe("trainingEmptyCopy", () => {
  it("con programa muestra el nombre, no 'sin asignar'", () => {
    const copy = trainingEmptyCopy({ program: { name: "Fuerza 90" } });
    assert.equal(copy.title, "Fuerza 90");
    assert.match(copy.copy, /preparando/);
  });

  it("sin programa ni estado usa el copy de no asignado", () => {
    const copy = trainingEmptyCopy({});
    assert.equal(copy.title, "Entrenamiento pendiente");
    assert.equal(copy.copy, "El equipo todavía no te asigna un programa.");
  });

  it("estado pendiente cambia el copy de Entrenamiento", () => {
    const copy = trainingEmptyCopy({ trainingApprovalStatus: "pending" });
    assert.equal(copy.title, "Tu programa está en revisión por tu coach");
    assert.match(copy.emptyCopy, /revisión/);
  });
});

describe("primaryAssignControl", () => {
  it("deshabilita sin elección y cuando la misma rutina ya está aprobada", () => {
    assert.equal(primaryAssignControl("", "10", "approved").disabled, true);
    assert.equal(primaryAssignControl("10", "10", "approved").disabled, true);
    assert.equal(primaryAssignControl("10", "10", "pending").disabled, false);
    assert.equal(primaryAssignControl("11", "10", "approved").label, "Cambiar principal");
    assert.equal(primaryAssignControl("11", "", "pending").label, "Asignar principal");
  });

  it("el mensaje refleja la auto-aprobación de la asignación principal", () => {
    assert.equal(primaryAssignMessage("approved", "Fuerza 90"), "Fuerza 90 quedó asignada y aprobada.");
    assert.equal(primaryAssignMessage("pending", "Fuerza 90"), "Fuerza 90 quedó asignada.");
  });
});
