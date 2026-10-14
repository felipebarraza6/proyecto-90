import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveStudentMacroPlan } from "../app/effective-macro-targets.ts";

describe("resolveStudentMacroPlan", () => {
  const nutrition = {
    calories: 2000,
    protein: 150,
    carbs: 200,
    fats: 60,
    notes: "Plan base",
    pdf_key: "guide.pdf",
  };
  const effective = {
    calories: 2500,
    protein: 190,
    carbs: 275,
    fats: 63,
    period: "1-30",
    effective_from: "2026-10-13",
    source: "period",
  };

  it("usa effective_macro_targets cuando viene no-null", () => {
    const plan = resolveStudentMacroPlan(nutrition, effective);
    assert.equal(plan.calories, 2500);
    assert.equal(plan.protein, 190);
    assert.equal(plan.carbs, 275);
    assert.equal(plan.fats, 63);
    assert.equal(plan.notes, "Plan base");
    assert.equal(plan.pdf_key, "guide.pdf");
  });

  it("cae a nutrition.* si effective es null o falta el campo", () => {
    assert.deepEqual(resolveStudentMacroPlan(nutrition, null), nutrition);
    assert.deepEqual(resolveStudentMacroPlan(nutrition, undefined), nutrition);
    assert.equal(resolveStudentMacroPlan(null, null), null);
  });
});
