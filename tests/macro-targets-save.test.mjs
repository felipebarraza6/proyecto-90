import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { canEditMacroTargets } from "../app/weekly-panel/macroEditAccess.ts";
import {
  buildMacroTargetSaveBodies,
  buildPlanSyncMacroTargetBody,
  periodForChallengeDay,
} from "../app/weekly-panel/macroScore.ts";

describe("periodForChallengeDay", () => {
  it("mapea días del desafío a tramos", () => {
    assert.equal(periodForChallengeDay(0), "1-30");
    assert.equal(periodForChallengeDay(1), "1-30");
    assert.equal(periodForChallengeDay(30), "1-30");
    assert.equal(periodForChallengeDay(31), "31-60");
    assert.equal(periodForChallengeDay(60), "31-60");
    assert.equal(periodForChallengeDay(61), "61-90");
    assert.equal(periodForChallengeDay(90), "61-90");
  });
});

describe("buildMacroTargetSaveBodies", () => {
  it("no emite bodies si faltan calorías/proteína (evita éxito falso)", () => {
    const bodies = buildMacroTargetSaveBodies([
      {
        period: "1-30",
        calories: null,
        protein: null,
        carbs: 200,
        fats: 60,
        effective_from: null,
        note: null,
      },
      {
        period: "31-60",
        calories: null,
        protein: null,
        carbs: null,
        fats: null,
        effective_from: null,
        note: null,
      },
      {
        period: "61-90",
        calories: null,
        protein: null,
        carbs: null,
        fats: null,
        effective_from: null,
        note: null,
      },
    ]);
    assert.equal(bodies.length, 0);
  });

  it("arrastra el primer tramo a los vacíos al armar el POST", () => {
    const bodies = buildMacroTargetSaveBodies([
      {
        period: "1-30",
        calories: 2000,
        protein: 150,
        carbs: 200,
        fats: 60,
        effective_from: "2026-10-01",
        note: "base",
      },
      {
        period: "31-60",
        calories: null,
        protein: null,
        carbs: null,
        fats: null,
        effective_from: null,
        note: null,
      },
      {
        period: "61-90",
        calories: 1800,
        protein: null,
        carbs: null,
        fats: null,
        effective_from: "2026-11-15",
        note: null,
      },
    ]);
    assert.equal(bodies.length, 3);
    assert.equal(bodies[1].period, "31-60");
    assert.equal(bodies[1].calories, 2000);
    assert.equal(bodies[1].protein, 150);
    assert.equal(bodies[2].calories, 1800);
    assert.equal(bodies[2].protein, 150);
    assert.equal(bodies[2].effective_from, "2026-11-15");
  });
});

describe("buildPlanSyncMacroTargetBody", () => {
  it("sincroniza Guardar plan al tramo del día actual (incluye calorías)", () => {
    const body = buildPlanSyncMacroTargetBody({
      day: 45,
      calories: 2200,
      protein: 160,
      carbs: 210,
      fats: 70,
      effective_from: "2026-10-18",
    });
    assert.equal(body.period, "31-60");
    assert.equal(body.calories, 2200);
    assert.equal(body.protein, 160);
    assert.equal(body.carbs, 210);
    assert.equal(body.fats, 70);
    assert.equal(body.effective_from, "2026-10-18");
  });
});

describe("canEditMacroTargets (requisito Felipe: nutri + admin)", () => {
  it("nutri y admin pueden editar; coach no", () => {
    assert.equal(canEditMacroTargets("admin"), true);
    assert.equal(canEditMacroTargets("professional", "nutrition"), true);
    assert.equal(canEditMacroTargets("professional", "coach"), false);
    assert.equal(canEditMacroTargets("reviewer"), false);
    assert.equal(canEditMacroTargets("participant"), false);
  });
});

describe("rutas UI: calorías editables para nutri y admin", () => {
  it("admin abre modal nutrition; nutri tiene «Editar macros» → nutrition", () => {
    const functional = readFileSync(new URL("../app/functional-app.tsx", import.meta.url), "utf8");
    const restored = readFileSync(new URL("../app/restored-panels.tsx", import.meta.url), "utf8");
    const recalc = readFileSync(new URL("../app/nutrition-recalc.tsx", import.meta.url), "utf8");
    // Admin: Nutrición sin profileModal → default "nutrition" (campos editables).
    assert.match(functional, /screen==="Nutrición"\)return <NutritionWorkspace people=\{people\} open=\{open\}\/>/);
    // Nutri: ficha profesional + botón que abre el editor de macros/calorías.
    assert.match(
      functional,
      /screen==="Nutrición"\)return <NutritionWorkspace people=\{people\} open=\{open\} profileModal="professional-student"\/>/,
    );
    assert.match(restored, /open\("nutrition",person\)}>Editar macros</);
    // Campo calorías editable en el plan (name=calories → Guardar plan / sync).
    assert.match(recalc, /key: "calories", label: "Calorías sugeridas"/);
    assert.match(recalc, /name=\{item\.key\}/);
    // Guardar plan sincroniza macro-targets (persistencia panel/ficha).
    assert.match(functional, /saveMacroTarget/);
    assert.match(functional, /buildPlanSyncMacroTargetBody/);
  });

  it("ficha del panel muestra MacroTargetsEditor solo si canEditMacroTargets", () => {
    const drawer = readFileSync(new URL("../app/weekly-panel/StudentDrawer.tsx", import.meta.url), "utf8");
    assert.match(drawer, /canEditMacroTargets\(role, specialty\)/);
    assert.match(drawer, /roleCanEditMacros \? \(/);
    assert.match(drawer, /<MacroTargetsEditor/);
  });
});
