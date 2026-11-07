import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { averageDrift, averageRecorded, formatRecordedAverage, liveMacroAverages, metricKeyFromAlert } from "../app/weekly-panel/macroWeekAverage.ts";

describe("promedio semanal de macros", () => {
  it("divide solo por los días con registro", () => {
    assert.equal(averageRecorded([100, null, 200, null, null, null, null]), 150);
    assert.equal(averageRecorded([10, null, 20, 30]), 20);
  });

  it("un cero registrado cuenta y un día sin registro no cuenta como cero", () => {
    assert.equal(averageRecorded([0, null, 0]), 0);
    assert.equal(averageRecorded([null, null, undefined]), null);
  });

  it("formatea el promedio vigente a un decimal es-CL", () => {
    assert.equal(formatRecordedAverage(94.25), "94,3");
    assert.equal(formatRecordedAverage(94), "94");
  });

  it("marca deriva cuando la IA conserva un promedio distinto al de la tabla", () => {
    const live = liveMacroAverages([
      { key: "fats", cells: [{ value: 96 }, { value: 88 }, { value: 75 }, { value: 118 }, { value: null }] },
    ]);
    assert.equal(metricKeyFromAlert("fats", "Grasas fuera de rango", "fat_high"), "fats");
    const drift = averageDrift(96.7, live.fats);
    assert.ok(drift);
    assert.equal(formatRecordedAverage(drift.live), "94,3");
    assert.equal(formatRecordedAverage(drift.evidence), "96,7");
    assert.equal(averageDrift(94.25, live.fats), null);
  });
});
