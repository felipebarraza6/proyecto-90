import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { looksLikeMeters, normalizeHeightInputCm } from "../app/height.ts";
import { chooseWeekAdherence } from "../app/panel-week-adherence.ts";
import { weekStartWeekdayLabel } from "../app/timezone.ts";
import { PANEL_CONFIG_DEFAULTS } from "../app/weekly-panel/panelConfig.ts";
import { alignPctDisplay, chipAriaLabel, formatPct } from "../app/weekly-panel/format.ts";
import { trainingProgressDisplay } from "../app/weekly-panel/trainingProgress.ts";

describe("auditoría gaps 2026-10-12 (arreglado)", () => {
  it("formatPct / align usan defaults 80/70 del contrato", () => {
    assert.equal(PANEL_CONFIG_DEFAULTS.thresholds.green_gt, 80);
    assert.equal(PANEL_CONFIG_DEFAULTS.thresholds.yellow_gte, 70);
    assert.equal(alignPctDisplay(70.4, 0, { color: "red" }), 69);
    assert.equal(formatPct(70.4, 0, { color: "red" }), "69 %");
  });

  it("chipAriaLabel incluye decimales y color alineado", () => {
    const aria = chipAriaLabel(
      { date: "2026-10-06", pct: 70.4, label: "Riesgo", color: "red" },
      0,
      PANEL_CONFIG_DEFAULTS.thresholds,
    );
    assert.match(aria, /69 %/);
  });

  it("altura: [3,10) se interpreta como metros", () => {
    assert.equal(looksLikeMeters(5), true);
    assert.equal(looksLikeMeters(170), false);
    assert.equal(normalizeHeightInputCm("1,75", { min: 100, max: 230 }).cm, 175);
    const r = normalizeHeightInputCm("5", { min: 100, max: 230 });
    assert.equal(r.cm, null);
    assert.equal(r.convertedFromMeters, true);
  });

  it("trainingProgress planned=0 → sin sesiones planificadas", () => {
    assert.equal(
      trainingProgressDisplay({ done: 0, planned: 0, partial: true }).primary,
      "Sin sesiones planificadas",
    );
  });

  it("participantes: % del panel (override) gana al histórico", () => {
    const withPanel = chooseWeekAdherence({ pct: 71.4, weekLabel: "6–12 oct" }, 72);
    assert.equal(withPanel.pct, 71.4);
    assert.equal(formatPct(withPanel.pct, 1), "71,4 %");
    assert.equal(withPanel.isWeeklyPanel, true);
    const hist = chooseWeekAdherence(null, 50);
    assert.equal(hist.isWeeklyPanel, false);
  });

  it("week_start_weekday etiqueta en español", () => {
    assert.equal(weekStartWeekdayLabel(0), "lunes");
    assert.equal(weekStartWeekdayLabel(6), "domingo");
  });

  it("defaults de leyenda macros vienen del contrato (no 90/80 literales sueltos)", () => {
    assert.equal(PANEL_CONFIG_DEFAULTS.macro_ranges.protein.min, 0.9);
    assert.equal(PANEL_CONFIG_DEFAULTS.macro_ranges.calories.min, 0.85);
    assert.equal(PANEL_CONFIG_DEFAULTS.macro_ranges.calories.max, 1.05);
    assert.equal(PANEL_CONFIG_DEFAULTS.default_sessions_per_week, 4);
    assert.equal(PANEL_CONFIG_DEFAULTS.thresholds.green_gt, 80);
  });
});
