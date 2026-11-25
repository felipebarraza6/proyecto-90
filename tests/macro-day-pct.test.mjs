import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { macroPctMap, macroPctForDay } from "../app/weekly-panel/macroDayPct.ts";
import { macroCalendarLabel, macroCalendarTone } from "../app/weekly-panel/macroCalendar.ts";

const TARGETS = { calories: 2000, protein: 150, carbs: 200, fats: 60 };

/** Config mínima: solo calorías pesan, rango abierto (permite % continuo). */
const CALORIES_ONLY = {
  macro_ranges: {
    calories: { min: 0, max: null },
    protein: { min: 0, max: null },
    carbs: { min: 0, max: null },
    fats: { min: 0, max: null },
  },
  macro_weights: { calories: 100, protein: 0, carbs: 0, fats: 0 },
};

describe("macroPctForDay", () => {
  it("sin registro devuelve null (no 0 %)", () => {
    assert.equal(macroPctForDay(null, TARGETS), null);
    assert.equal(macroPctForDay(undefined, TARGETS), null);
  });

  it("con valores exactos a la meta da 100 %", () => {
    const pct = macroPctForDay(
      { calories: 2000, protein: 150, carbs: 200, fats: 60 },
      TARGETS,
    );
    assert.equal(pct, 100);
  });

  it("con registro en cero da 0 %", () => {
    const pct = macroPctForDay({ calories: 0, protein: 0, carbs: 0, fats: 0 }, TARGETS);
    assert.equal(pct, 0);
  });

  it("sin metas suficientes no inventa un %", () => {
    assert.equal(macroPctForDay({ calories: 2000, protein: 150 }, {}), null);
  });

  it("usa el umbral 80 % del calendario sin cruzar por redondeo", () => {
    const targets = { calories: 1000 };
    const bajo = macroPctForDay({ calories: 796 }, targets, CALORIES_ONLY);
    assert.ok(Math.abs(bajo - 79.6) < 1e-9);
    assert.equal(macroCalendarTone(bajo), "tone-low");
    assert.equal(macroCalendarLabel(bajo), "79%");

    const justo = macroPctForDay({ calories: 800 }, targets, CALORIES_ONLY);
    assert.equal(justo, 80);
    assert.equal(macroCalendarTone(justo), "tone-high");
    assert.equal(macroCalendarLabel(justo), "80%");
  });

  it("respeta macro_weights y macro_ranges del panelConfig", () => {
    const values = { calories: 2000, protein: 120, carbs: 200, fats: 60 };
    // Defaults 40/40/10/10: proteína 120/150 bajo el mínimo 0.9 → 0.
    assert.equal(macroPctForDay(values, TARGETS), 60);
    // Solo calorías pesa → 100 %.
    assert.equal(
      macroPctForDay(values, TARGETS, {
        macro_weights: { calories: 100, protein: 0, carbs: 0, fats: 0 },
      }),
      100,
    );
    // Rango de calorías más exigente: 1900/2000 queda fuera → 0 %.
    assert.equal(macroPctForDay({ calories: 1900 }, { calories: 2000 }, CALORIES_ONLY), 95);
    assert.equal(
      macroPctForDay({ calories: 1900 }, { calories: 2000 }, {
        ...CALORIES_ONLY,
        macro_ranges: {
          ...CALORIES_ONLY.macro_ranges,
          calories: { min: 0.98, max: null },
        },
      }),
      0,
    );
  });
});

describe("macroPctMap", () => {
  const targetsByUser = {
    "1": { calories: 2000, protein: 150, carbs: 200, fats: 60 },
    "2": { calories: 1000, protein: 100, carbs: 100, fats: 30 },
  };
  const records = [
    { user_id: 1, log_date: "2026-11-20", calories: 2000, protein: 150, carbs: 200, fats: 60 },
    { user_id: 2, log_date: "2026-11-20T08:30:00Z", calories: 500, protein: 50, carbs: 50, fats: 15 },
    { user_id: 1, log_date: "", calories: 2000, protein: 150, carbs: 200, fats: 60 },
    { user_id: 1, log_date: null, calories: 2000, protein: 150, carbs: 200, fats: 60 },
    { user_id: 1, log_date: "sin-fecha", calories: 2000, protein: 150, carbs: 200, fats: 60 },
    { user_id: "", log_date: "2026-11-21", calories: 2000, protein: 150, carbs: 200, fats: 60 },
  ];

  it("arma la clave user_id:fecha y respeta los targets de cada usuario", () => {
    const map = macroPctMap(records, (userId) => targetsByUser[userId]);
    assert.equal(map.get("1:2026-11-20"), 100);
    assert.equal(map.get("2:2026-11-20"), 10);
    assert.equal(map.size, 2);
  });

  it("ignora log_date inválido/vacío y días sin registro", () => {
    const map = macroPctMap(records, (userId) => targetsByUser[userId]);
    for (const key of map.keys()) {
      assert.match(key, /^\d+:2026-11-2\d$/);
    }
    assert.equal(map.has("1:2026-11-22"), false);
    assert.equal(map.has(":2026-11-21"), false);
  });
});
