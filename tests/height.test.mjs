import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  formatHeightCm,
  heightCmForDisplay,
  normalizeHeightInputCm,
} from "../app/height.ts";

const ranges = { min: 100, max: 230 };

describe("normalizeHeightInputCm", () => {
  it("acepta centímetros", () => {
    const r = normalizeHeightInputCm("170", ranges);
    assert.equal(r.cm, 170);
    assert.equal(r.convertedFromMeters, false);
    assert.equal(r.error, undefined);
  });

  it("convierte metros a cm", () => {
    const r = normalizeHeightInputCm("1,70", ranges);
    assert.equal(r.cm, 170);
    assert.equal(r.convertedFromMeters, true);
  });

  it("rechaza valores fuera de rango", () => {
    const r = normalizeHeightInputCm("50", ranges);
    assert.equal(r.cm, null);
    assert.match(r.error || "", /entre 100 y 230/);
  });
});

describe("heightCmForDisplay", () => {
  it("muestra metros guardados como cm", () => {
    assert.equal(heightCmForDisplay(1.75), 175);
    assert.equal(formatHeightCm(1.75), "175 cm");
  });
});
