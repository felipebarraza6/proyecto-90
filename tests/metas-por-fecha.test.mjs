import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  effectiveDateLabel,
  goalPeriodLabel,
  periodStartFromChallenge,
  sortMacroTargetHistory,
} from "../app/weekly-panel/macroEffective.ts";
import { buildMacroTargetSaveBody } from "../app/weekly-panel/macroScore.ts";

const editor = readFileSync(
  new URL("../app/weekly-panel/MacroTargetsEditor.tsx", import.meta.url),
  "utf8",
);
const types = readFileSync(
  new URL("../app/weekly-panel/types.ts", import.meta.url),
  "utf8",
);

describe("goalPeriodLabel", () => {
  it("con tramo muestra los días del tramo", () => {
    assert.equal(goalPeriodLabel({ period: "1-30", effective_from: "2026-10-01" }), "Días 1–30");
    assert.equal(goalPeriodLabel({ period: "31-60", effective_from: null }), "Días 31–60");
    assert.equal(goalPeriodLabel({ period: "61-90", effective_from: null }), "Días 61–90");
  });

  it("sin tramo usa la fecha de vigencia", () => {
    assert.equal(
      goalPeriodLabel({ period: "", effective_from: "2026-11-12" }),
      "Desde 12 nov 2026",
    );
    assert.equal(
      goalPeriodLabel({ period: null, effective_from: "2026-01-05T00:00:00Z" }),
      "Desde 5 ene 2026",
    );
  });

  it("con fecha inválida no inventa un tramo", () => {
    assert.equal(goalPeriodLabel({ period: null, effective_from: "no-es-fecha" }), "Sin fecha");
    assert.equal(goalPeriodLabel({ period: "", effective_from: "" }), "Sin fecha");
    assert.equal(goalPeriodLabel(null), "Sin fecha");
  });
});

describe("effectiveDateLabel", () => {
  it("formatea ISO como día mes corto año", () => {
    assert.equal(effectiveDateLabel("2026-11-12"), "12 nov 2026");
    assert.equal(effectiveDateLabel("2026-01-01"), "1 ene 2026");
  });

  it("tolera ausencia o fechas imposibles", () => {
    assert.equal(effectiveDateLabel(null), "Sin fecha");
    assert.equal(effectiveDateLabel("2026-02-31"), "Sin fecha");
  });
});

describe("periodStartFromChallenge", () => {
  it("autocompleta el inicio del tramo desde el día 1", () => {
    assert.equal(periodStartFromChallenge("2026-10-01", "1-30"), "2026-10-01");
    assert.equal(periodStartFromChallenge("2026-10-01", "31-60"), "2026-10-31");
    assert.equal(periodStartFromChallenge("2026-10-01", "61-90"), "2026-11-30");
  });

  it("sin inicio o sin tramo no sugiere fecha", () => {
    assert.equal(periodStartFromChallenge(null, "1-30"), "");
    assert.equal(periodStartFromChallenge("2026-10-01", ""), "");
  });
});

describe("editor: meta solo con fecha", () => {
  it("construye el payload sin period cuando no se elige tramo", () => {
    const body = buildMacroTargetSaveBody({
      period: "",
      calories: 2000,
      protein: 150,
      carbs: 200,
      fats: 60,
      effective_from: "2026-11-12",
    });
    assert.ok(body);
    assert.equal("period" in body, false);
    assert.equal(body.effective_from, "2026-11-12");
    assert.equal(body.calories, 2000);
    assert.equal(body.protein, 150);
  });

  it("si hay tramo lo incluye, sin duplicar el submit", () => {
    const body = buildMacroTargetSaveBody({
      period: "31-60",
      calories: 2100,
      protein: 160,
      effective_from: "2026-10-31",
    });
    assert.ok(body);
    assert.equal(body.period, "31-60");
    // Regresión: un solo POST por guardado (antes se enviaban 3 bodies).
    assert.equal((editor.match(/saveMacroTarget\(/g) || []).length, 1);
    assert.doesNotMatch(editor, /for \(const body of bodies\)/);
  });

  it("period es opcional en el tipo del body", () => {
    assert.match(types, /period\?: MacroPeriodKey \| null;/);
  });

  it("no exige tramo para guardar: valida fecha, calorías y proteína", () => {
    assert.match(editor, /period: draft\.period \|\| null/);
    assert.match(editor, /Indica «Vigente desde», calorías y proteína/);
  });
});

describe("historial de metas", () => {
  it("items sin tramo se muestran con «Desde»", () => {
    const labels = [
      { period: "1-30", effective_from: "2026-10-01" },
      { period: "", effective_from: "2026-11-12" },
    ].map(goalPeriodLabel);
    assert.deepEqual(labels, ["Días 1–30", "Desde 12 nov 2026"]);
    assert.match(editor, /goalPeriodLabel\(row\)/);
    assert.match(editor, /HISTORIAL/);
  });

  it("ordena de más reciente a más antiguo y deja las inválidas al final", () => {
    const sorted = sortMacroTargetHistory([
      { id: 1, period: "", effective_from: "2026-10-01", calories: 1, protein: 1, carbs: null, fats: null },
      { id: 2, period: "31-60", effective_from: "2026-11-12", calories: 2, protein: 2, carbs: null, fats: null },
      { id: 3, period: "", effective_from: null, calories: 3, protein: 3, carbs: null, fats: null },
    ]);
    assert.deepEqual(
      sorted.map((row) => row.id),
      [2, 1, 3],
    );
  });
});
