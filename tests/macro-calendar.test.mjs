import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { macroCalendarLabel, macroCalendarTone } from "../app/weekly-panel/macroCalendar.ts";

describe("calendario de cumplimiento macros", () => {
  it("pinta verde desde 80 % y rojo por debajo, sin amarillo", () => {
    assert.equal(macroCalendarTone(80), "tone-high");
    assert.equal(macroCalendarTone(80.1), "tone-high");
    assert.equal(macroCalendarTone(100), "tone-high");
    assert.equal(macroCalendarTone(79.9), "tone-low");
    assert.equal(macroCalendarTone(0), "tone-low");
    assert.equal(macroCalendarTone(90), "tone-high");
  });

  it("deja vacío null, undefined y valores no numéricos", () => {
    assert.equal(macroCalendarTone(null), null);
    assert.equal(macroCalendarTone(undefined), null);
    assert.equal(macroCalendarTone(Number.NaN), null);
    assert.equal(macroCalendarTone(Number.POSITIVE_INFINITY), null);
  });

  it("el rótulo redondea el % de la API", () => {
    assert.equal(macroCalendarLabel(79.6), "80%");
    assert.equal(macroCalendarLabel(80), "80%");
  });
});
