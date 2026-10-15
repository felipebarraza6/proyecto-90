import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { trainingProgressDisplay } from "../app/weekly-panel/trainingProgress.ts";

describe("trainingProgressDisplay", () => {
  it("muestra plan cumplido cuando done >= planned (nunca parcial)", () => {
    const d = trainingProgressDisplay(
      { done: 5, planned: 3, partial: true },
      { weekClosed: false },
    );
    assert.equal(d.primary, "Plan cumplido · 5 de 3 entrenamientos");
    assert.equal(d.note, "Meta superada");
  });

  it("muestra plan cumplido exacto sin nota de excedido", () => {
    const d = trainingProgressDisplay({ done: 3, planned: 3, partial: true });
    assert.equal(d.primary, "Plan cumplido · 3 de 3 entrenamientos");
    assert.equal(d.note, undefined);
  });

  it("muestra avance parcial solo si aún no cumple", () => {
    const d = trainingProgressDisplay(
      { done: 1, planned: 3, partial: true },
      { weekClosed: false },
    );
    assert.equal(d.primary, "1 de 3 entrenamientos");
    assert.equal(d.note, "Avance parcial (semana en curso)");
  });

  it("no muestra parcial si la semana está cerrada", () => {
    const d = trainingProgressDisplay(
      { done: 1, planned: 3, partial: true },
      { weekClosed: true },
    );
    assert.equal(d.primary, "1 de 3 entrenamientos");
    assert.equal(d.note, undefined);
  });

  it("incluye % semanal como 3 de 4 entrenamientos · 75 %", () => {
    const d = trainingProgressDisplay({ done: 3, planned: 4, pct: 75 });
    assert.equal(d.primary, "3 de 4 entrenamientos · 75 %");
  });
});
