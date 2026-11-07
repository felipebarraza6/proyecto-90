import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  adherenceStreaks,
  monthAdherenceSummary,
} from "../app/weekly-panel/insightsMath.ts";

describe("racha de cierre", () => {
  it("cuenta días consecutivos con cierre y cumplimiento mayor a 80; 80 exacto rompe", () => {
    const days = [
      { date: "2026-11-01", pct: 90, closed: true },
      { date: "2026-11-02", pct: 80, closed: true },
      { date: "2026-11-03", pct: 81, closed: true },
      { date: "2026-11-04", pct: 100, closed: true },
    ];
    const streaks = adherenceStreaks(days, "2026-11-04");
    assert.equal(streaks.current, 2);
    assert.equal(streaks.best, 2);
  });

  it("hoy abierto no corta la racha; un día vencido sin cierre sí", () => {
    const days = [
      { date: "2026-11-02", pct: 99, closed: true },
      { date: "2026-11-03", pct: 99, closed: true },
      { date: "2026-11-04", pct: 98, closed: true },
      { date: "2026-11-05", pct: 96, closed: true },
    ];
    const openToday = adherenceStreaks(days, "2026-11-07");
    assert.equal(openToday.current, 0);
    assert.equal(openToday.best, 4);
    const stillOpen = adherenceStreaks(
      [...days, { date: "2026-11-06", pct: null, closed: false }],
      "2026-11-06",
    );
    assert.equal(stillOpen.current, 4);
  });

  it("un día sin cierre rompe y el futuro no entra", () => {
    const days = [
      { date: "2026-11-01", pct: 95, closed: true },
      { date: "2026-11-02", pct: null, closed: false },
      { date: "2026-11-03", pct: 99, closed: true },
      { date: "2026-11-04", pct: 99, closed: true },
    ];
    const streaks = adherenceStreaks(days, "2026-11-03");
    assert.equal(streaks.current, 1);
    assert.equal(streaks.best, 1);
  });

  it("el consolidado del mes promedia solo días con cierre y omite el futuro", () => {
    const summary = monthAdherenceSummary(
      [
        { date: "2026-11-01", pct: 100, closed: true },
        { date: "2026-11-02", pct: null, closed: false },
        { date: "2026-11-03", pct: 50, closed: true },
        { date: "2026-11-04", pct: 100, closed: true },
      ],
      "2026-11",
      "2026-11-03",
    );
    assert.equal(summary.closedDays, 2);
    assert.equal(summary.above80, 1);
    assert.equal(summary.averagePct, 75);
  });
});
