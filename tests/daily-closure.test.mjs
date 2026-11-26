import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const daily = readFileSync(new URL("../app/daily-closure.tsx", import.meta.url), "utf8");
const functional = readFileSync(new URL("../app/functional-app.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("Cierre del día: registro en API", () => {
  it("envía la acción day.close con fecha, resumen y faltantes", () => {
    assert.ok(daily.includes('action: "day.close"'));
    assert.ok(daily.includes("summary: text"));
    assert.ok(daily.includes("missing,"));
    assert.ok(daily.includes("notified"));
  });

  it("solo ofrece registrar cuando hay act y el rol puede cerrar", () => {
    assert.ok(daily.includes("act?: (payload: Row) => Promise<unknown>"));
    assert.ok(daily.includes("canClose?: boolean"));
    assert.ok(daily.includes("{act && canClose && ("));
    assert.ok(daily.includes("Registrar cierre"));
  });

  it("FunctionalApp conecta act y respeta el modo revisor", () => {
    assert.equal((functional.match(/<DailyClosure/g) || []).length, 2);
    assert.ok(functional.includes("act={act} canClose={!readOnly}"));
    assert.ok(functional.includes('habits={nutrition?["macros"]:["training"]} act={act}'));
  });

  it("muestra confirmación o error del cierre", () => {
    assert.ok(daily.includes("daily-closure-status"));
    assert.ok(daily.includes("daily-closure-error"));
    assert.ok(css.includes(".daily-closure-status"));
    assert.ok(css.includes(".daily-closure-error"));
  });
});
