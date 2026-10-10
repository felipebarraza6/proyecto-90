import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  alignPctDisplay,
  formatGoalPctLabel,
  formatPct,
} from "../app/weekly-panel/format.ts";

describe("alignPctDisplay / formatGoalPctLabel", () => {
  it("no muestra 90% en rojo cuando está bajo el mínimo 90%", () => {
    // 128/143 ≈ 89.51 → Math.round daría 90; debe bajar a 89
    const n = alignPctDisplay(89.51, 0, {
      inRange: false,
      minRatio: 0.9,
      maxRatio: null,
    });
    assert.equal(n, 89);
    assert.equal(
      formatGoalPctLabel(89.51, {
        inRange: false,
        minRatio: 0.9,
        maxRatio: null,
        decimals: 0,
      }),
      "89% del objetivo",
    );
  });

  it("mantiene 90% verde cuando está en rango", () => {
    const label = formatGoalPctLabel(90.2, {
      inRange: true,
      minRatio: 0.9,
      maxRatio: 1.1,
      decimals: 0,
    });
    assert.equal(label, "90% del objetivo");
  });

  it("alinea % del semáforo rojo con umbral amarillo", () => {
    const shown = formatPct(70.4, 0, {
      color: "red",
      greenGt: 80,
      yellowGte: 70,
    });
    assert.equal(shown, "69 %");
  });

  it("acepta display_pct opcional del backend", () => {
    assert.equal(
      formatGoalPctLabel(90, {
        inRange: false,
        minRatio: 0.9,
        displayPct: 89,
        decimals: 0,
      }),
      "89% del objetivo",
    );
  });
});
