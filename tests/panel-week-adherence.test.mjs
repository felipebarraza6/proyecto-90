import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildPanelWeekPctIndex,
  chooseWeekAdherence,
  loadPanelWeekAdherence,
  orderedWeekStarts,
  panelConfigCanEdit,
  panelTotalPctOf,
  personClientId,
  semaforoFromPct,
  weekHasPctData,
} from "../app/panel-week-adherence.ts";
import { formatPct } from "../app/weekly-panel/format.ts";

describe("panel week adherence (Participantes)", () => {
  it("orderedWeekStarts pone current primero", () => {
    assert.deepEqual(
      orderedWeekStarts({
        current: "2026-10-06",
        weeks: [
          { start: "2026-09-29", end: "2026-10-05", label: "ant" },
          { start: "2026-10-06", end: "2026-10-12", label: "act" },
        ],
      }),
      ["2026-10-06", "2026-09-29"],
    );
  });

  it("buildPanelWeekPctIndex indexa weekly.pct por client_id", () => {
    const week = {
      week: { start: "2026-10-06", end: "2026-10-12", label: "6–12 oct", is_current: true },
      generated_at: "",
      summary: { participants: 1, weekly_avg: 71.4, at_risk: 0, missing_report: 0 },
      rows: [
        {
          client_id: 42,
          name: "Ana",
          email: "a@x",
          days: [],
          weekly: { pct: 71.4, color: "yellow" },
          status: [],
        },
      ],
      empty_reason: null,
    };
    const index = buildPanelWeekPctIndex(week);
    assert.equal(index.weekLabel, "6–12 oct");
    assert.equal(index.byClientId.get("42"), 71.4);
    assert.equal(weekHasPctData(week), true);
  });

  it("chooseWeekAdherence usa panel (71,4) y no redondea a histórico 72", () => {
    const choice = chooseWeekAdherence({ pct: 71.4, weekLabel: "6–12 oct" }, 72);
    assert.equal(choice.pct, 71.4);
    assert.equal(choice.isWeeklyPanel, true);
    assert.match(choice.label, /6–12 oct/);
    assert.equal(formatPct(choice.pct, 1), "71,4 %");
  });

  it("histórico solo si el panel falló (null)", () => {
    const choice = chooseWeekAdherence(null, 72);
    assert.equal(choice.isWeeklyPanel, false);
    assert.match(choice.label, /histórica/);
    assert.equal(choice.pct, 72);
  });

  it("personClientId matchea id / client_id", () => {
    assert.equal(personClientId({ id: 7 }), "7");
    assert.equal(personClientId({ client_id: 9, id: 1 }), "9");
  });

  it("loadPanelWeekAdherence elige current con datos; si no, la siguiente", async () => {
    const empty = {
      week: { start: "2026-10-06", end: "2026-10-12", label: "act", is_current: true },
      generated_at: "",
      summary: { participants: 0, weekly_avg: null, at_risk: 0, missing_report: 0 },
      rows: [],
      empty_reason: "no_participants",
    };
    const prior = {
      week: { start: "2026-09-29", end: "2026-10-05", label: "ant", is_current: false },
      generated_at: "",
      summary: { participants: 1, weekly_avg: 80, at_risk: 0, missing_report: 0 },
      rows: [
        {
          client_id: 1,
          name: "A",
          email: "a",
          days: [],
          weekly: { pct: 80, color: "green" },
          status: [],
        },
      ],
      empty_reason: null,
    };
    const index = await loadPanelWeekAdherence(
      async () => ({
        current: "2026-10-06",
        weeks: [
          { start: "2026-10-06", end: "2026-10-12", label: "act" },
          { start: "2026-09-29", end: "2026-10-05", label: "ant" },
        ],
      }),
      async (start) => (start === "2026-10-06" ? empty : prior),
    );
    assert.equal(index?.weekStart, "2026-09-29");
    assert.equal(index?.byClientId.get("1"), 80);
  });

  it("loadPanelWeekAdherence → null si el fetch falla", async () => {
    const index = await loadPanelWeekAdherence(
      async () => {
        throw new Error("network");
      },
      async () => {
        throw new Error("network");
      },
    );
    assert.equal(index, null);
  });
});

describe("panelConfigCanEdit (sin probe PATCH)", () => {
  it("admin edita si GET no manda can_edit", () => {
    assert.equal(panelConfigCanEdit("admin", {}), true);
    assert.equal(panelConfigCanEdit("professional", {}), false);
  });

  it("GET can_edit manda sobre el rol", () => {
    assert.equal(panelConfigCanEdit("professional", { can_edit: true }), true);
    assert.equal(panelConfigCanEdit("admin", { can_edit: false }), false);
  });
});

describe("panel_total_pct (columna TOTAL del panel semanal)", () => {
  const thresholds = { green_gt: 80, yellow_gte: 70 };

  it("panelTotalPctOf lee el float o null si falta / no es finito", () => {
    assert.equal(panelTotalPctOf({ panel_total_pct: 85.5 }), 85.5);
    assert.equal(panelTotalPctOf({ panel_total_pct: null }), null);
    assert.equal(panelTotalPctOf({}), null);
    assert.equal(panelTotalPctOf({ panel_total_pct: Number.NaN }), null);
  });

  it("semaforoFromPct usa los umbrales del panel; null → neutral", () => {
    assert.equal(semaforoFromPct(null, thresholds), "neutral");
    assert.equal(semaforoFromPct(undefined, thresholds), "neutral");
    assert.equal(semaforoFromPct(81, thresholds), "green");
    assert.equal(semaforoFromPct(80, thresholds), "yellow");
    assert.equal(semaforoFromPct(70, thresholds), "yellow");
    assert.equal(semaforoFromPct(69.9, thresholds), "red");
  });

  it("TOTAL se formatea como SEMANA (formatPct + color); null → guion", () => {
    assert.equal(formatPct(null, 1), "—");
    const pct = panelTotalPctOf({ panel_total_pct: 71.4 });
    const color = semaforoFromPct(pct, thresholds);
    assert.equal(color, "yellow");
    assert.equal(
      formatPct(pct, 1, {
        color,
        greenGt: thresholds.green_gt,
        yellowGte: thresholds.yellow_gte,
      }),
      "71,4 %",
    );
  });
});
