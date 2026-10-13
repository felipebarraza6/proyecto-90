import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_MACRO_WEIGHTS,
  calorieCompliancePct,
  carryForwardMacroPeriods,
  formatMacroDayPct,
  macroDayPct,
  macroWeightsTotal,
  proteinCompliancePct,
  readMacroPeriods,
  symmetricCompliancePct,
} from "../app/weekly-panel/macroScore.ts";
import {
  normalizeMacroWeights,
  normalizePanelConfig,
  PANEL_CONFIG_DEFAULTS,
} from "../app/weekly-panel/panelConfig.ts";

const ranges85_105 = {
  calories: { min: 0.85, max: 1.05 },
  protein: { min: 0.9, max: null },
  carbs: { min: 0.9, max: 1.1 },
  fats: { min: 0.9, max: 1.1 },
};

describe("macroScore (spec Marce)", () => {
  it("defaults de pesos 40/40/10/10, calorías 85–105, sesiones 4 y messaging_coach off", () => {
    const cfg = normalizePanelConfig({});
    assert.deepEqual(cfg.macro_weights, DEFAULT_MACRO_WEIGHTS);
    assert.equal(macroWeightsTotal(cfg.macro_weights), 100);
    assert.equal(cfg.messaging_coach_enabled, false);
    assert.equal(PANEL_CONFIG_DEFAULTS.messaging_coach_enabled, false);
    assert.equal(cfg.macro_ranges.calories.min, 0.85);
    assert.equal(cfg.macro_ranges.calories.max, 1.05);
    assert.equal(cfg.default_sessions_per_week, 4);
  });

  it("normalizeMacroWeights tolera payload ausente o parcial", () => {
    assert.deepEqual(normalizeMacroWeights(null), DEFAULT_MACRO_WEIGHTS);
    assert.equal(normalizeMacroWeights({ calories: 50 }).calories, 50);
    assert.equal(normalizeMacroWeights({ calories: 50 }).protein, 40);
    assert.equal(normalizeMacroWeights({ calories: -1 }).calories, 40);
  });

  it("calorías: 100 − desviación dentro del rango; 0 fuera (límites inclusivos)", () => {
    const r = ranges85_105.calories;
    assert.equal(calorieCompliancePct(100, 100, r), 100);
    assert.equal(calorieCompliancePct(104, 100, r), 96);
    assert.equal(calorieCompliancePct(105, 100, r), 95);
    assert.equal(calorieCompliancePct(106, 100, r), 0);
    assert.equal(calorieCompliancePct(90, 100, r), 90);
    assert.equal(calorieCompliancePct(85, 100, r), 85);
    assert.equal(calorieCompliancePct(84, 100, r), 0);
  });

  it("proteína: 0 bajo el mínimo; % alcanzado hasta la meta; 100 en o sobre meta", () => {
    const r = ranges85_105.protein;
    assert.equal(proteinCompliancePct(89, 100, r), 0);
    assert.equal(proteinCompliancePct(90, 100, r), 90);
    assert.equal(proteinCompliancePct(95, 100, r), 95);
    assert.equal(proteinCompliancePct(100, 100, r), 100);
    assert.equal(proteinCompliancePct(110, 100, r), 100);
  });

  it("carbos/grasas: descuento simétrico sin corte duro", () => {
    assert.equal(symmetricCompliancePct(100, 100), 100);
    assert.equal(symmetricCompliancePct(110, 100), 90);
    assert.equal(symmetricCompliancePct(90, 100), 90);
    assert.equal(symmetricCompliancePct(80, 100), 80);
    assert.equal(symmetricCompliancePct(200, 100), 0);
  });

  it("día de macros ponderado 40/40/10/10 (ejemplo ~94 %)", () => {
    // Cal 100→100, Prot 95→95, Carbs 90→90, Fats 90→90
    // 100*0.4 + 95*0.4 + 90*0.1 + 90*0.1 = 40+38+9+9 = 96
    const pct = macroDayPct(
      { calories: 100, protein: 95, carbs: 90, fats: 90 },
      { calories: 100, protein: 100, carbs: 100, fats: 100 },
      ranges85_105,
      DEFAULT_MACRO_WEIGHTS,
    );
    assert.equal(pct, 96);
    assert.equal(formatMacroDayPct(pct, 0), "96 %");
  });

  it("tramos vacíos arrastran el anterior", () => {
    const carried = carryForwardMacroPeriods([
      { calories: 2000, protein: 150, carbs: 200, fats: 60, effective_from: "2026-10-01" },
      { calories: null, protein: null, carbs: null, fats: null, effective_from: null },
      { calories: 1800, protein: null, carbs: null, fats: null, effective_from: "2026-11-15" },
    ]);
    assert.equal(carried[1].calories, 2000);
    assert.equal(carried[1].protein, 150);
    assert.equal(carried[1].effective_from, "2026-10-01");
    assert.equal(carried[2].calories, 1800);
    assert.equal(carried[2].protein, 150);
    assert.equal(carried[2].effective_from, "2026-11-15");
  });

  it("readMacroPeriods cae al plan actual si no hay macro_periods", () => {
    const rows = readMacroPeriods({
      calories: 2200,
      protein: 160,
      carbs: 210,
      fats: 70,
      effective_from: "2026-10-01",
    });
    assert.equal(rows.length, 3);
    assert.equal(rows[0].period, "1-30");
    assert.equal(rows[0].calories, 2200);
    assert.equal(rows[1].calories, null);
  });
});
