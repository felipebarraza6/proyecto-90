import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { averageRecorded } from "../app/weekly-panel/macroWeekAverage.ts";

describe("promedio semanal de macros", () => {
  it("divide solo por los días con registro", () => {
    assert.equal(averageRecorded([100, null, 200, null, null, null, null]), 150);
    assert.equal(averageRecorded([10, null, 20, 30]), 20);
  });

  it("un cero registrado cuenta y un día sin registro no cuenta como cero", () => {
    assert.equal(averageRecorded([0, null, 0]), 0);
    assert.equal(averageRecorded([null, null, undefined]), null);
  });
});
