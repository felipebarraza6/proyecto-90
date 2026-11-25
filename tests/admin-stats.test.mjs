import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { averageOf, kgLostTotal, stageStats, weightStats } from "../app/admin-stats.ts";
import { participantSummaryCsv } from "../app/participant-summary.ts";

describe("averageOf", () => {
  it("devuelve null sin valores y promedia números", () => {
    assert.equal(averageOf([]), null);
    assert.equal(averageOf([1, 2]), 1.5);
    assert.equal(averageOf([0]), 0);
  });
});

describe("weightStats", () => {
  it("usa solo a quienes tienen weight_day_30 y promedia diferencias individuales", () => {
    const people = [
      { weight: 100, weight_day_30: 90 },
      { weight_day_30: 78 },
      { weight: 70 },
      { weight: 60, weight_day_30: "" },
    ];
    const stats = weightStats(people);
    assert.equal(stats.n, 2);
    assert.equal(stats.initial, 100);
    assert.equal(stats.day30, 84);
    assert.equal(stats.delta, -10);
    // La resta de promedios daría -16: se usa la diferencia por persona.
    assert.notEqual(stats.delta, stats.day30 - stats.initial);
  });

  it("trata null y valores no numéricos como ausencia de dato", () => {
    const stats = weightStats([
      { weight: 80, weight_day_30: null },
      { weight: 70, weight_day_30: "sin medición" },
    ]);
    assert.equal(stats.n, 0);
    assert.equal(stats.initial, null);
    assert.equal(stats.day30, null);
    assert.equal(stats.delta, null);
  });

  it("sin participantes devuelve todo null y n en cero", () => {
    assert.deepEqual(weightStats([]), { initial: null, day30: null, delta: null, n: 0 });
  });
});

describe("stageStats", () => {
  it("cada tramo tiene su propio n y el total usa adherence", () => {
    const stats = stageStats([
      { adherence_day_30: 50, adherence: 40 },
      { adherence_day_30: 70, adherence_day_60: 60, adherence: 65 },
      { adherence_day_90: 0, adherence: 80 },
      { adherence_day_30: "", adherence_day_60: null, adherence_day_90: "—", adherence: undefined },
    ]);
    assert.deepEqual(stats.day30, { value: 60, n: 2 });
    assert.deepEqual(stats.day60, { value: 60, n: 1 });
    assert.deepEqual(stats.day90, { value: 0, n: 1 });
    assert.deepEqual(stats.total, { value: (40 + 65 + 80) / 3, n: 3 });
  });

  it("sin datos deja value null y n en cero en cada tramo", () => {
    const stats = stageStats([{}]);
    assert.deepEqual(stats.day30, { value: null, n: 0 });
    assert.deepEqual(stats.day60, { value: null, n: 0 });
    assert.deepEqual(stats.day90, { value: null, n: 0 });
    assert.deepEqual(stats.total, { value: null, n: 0 });
  });
});

describe("kgLostTotal", () => {
  it("suma los deltas individuales contra el último peso medido", () => {
    const stats = kgLostTotal([
      { weight: 100, weight_day_30: 95 },
      { weight: 80, weight_day_30: 78, weight_day_60: 75 },
      { weight: 70 },
    ]);
    assert.deepEqual(stats, { value: -10, n: 2 });
  });

  it("sin datos no inventa un cero", () => {
    assert.deepEqual(kgLostTotal([{}]), { value: null, n: 0 });
  });

  it("acepta un total positivo cuando el grupo subió de peso", () => {
    assert.deepEqual(kgLostTotal([{ weight: 80, weight_day_90: 83 }]), { value: 3, n: 1 });
  });
});

describe("coincidencia con el CSV de participantes", () => {
  const people = [
    { first_name: "Ana", last_name: "Paz", email: "ana@example.com", weight: 80, weight_day_30: 78.5, adherence_day_30: 50 },
    { first_name: "Beto", last_name: "Ruiz", email: "beto@example.com", weight: 90, weight_day_30: 85, adherence_day_30: 70 },
    { first_name: "Caro", last_name: "Soto", email: "caro@example.com", weight: 70, weight_day_30: "", adherence_day_30: "" },
  ];

  function parseCsvLine(line) {
    const cells = [];
    let cell = "";
    let quoted = false;
    for (let index = 0; index < line.length; index += 1) {
      const char = line[index];
      if (quoted) {
        if (char === '"' && line[index + 1] === '"') {
          cell += '"';
          index += 1;
        } else if (char === '"') {
          quoted = false;
        } else {
          cell += char;
        }
      } else if (char === '"') {
        quoted = true;
      } else if (char === ",") {
        cells.push(cell);
        cell = "";
      } else {
        cell += char;
      }
    }
    cells.push(cell);
    return cells;
  }

  function csvAverage(column) {
    const lines = participantSummaryCsv(people).split("\n");
    const header = parseCsvLine(lines[0]);
    const index = header.indexOf(column);
    const values = lines
      .slice(1)
      .map((line) => parseCsvLine(line)[index])
      .filter((cell) => cell !== "")
      .map((cell) => Number(cell.replace(",", ".")));
    return values.reduce((sum, value) => sum + value, 0) / values.length;
  }

  it("el promedio de peso_30 coincide con weightStats().day30", () => {
    assert.equal(csvAverage("peso_30"), weightStats(people).day30);
  });

  it("el promedio de adherencia_0_30 coincide con stageStats().day30", () => {
    assert.equal(csvAverage("adherencia_0_30"), stageStats(people).day30.value);
  });
});

describe("contrato del Resumen", () => {
  const functional = readFileSync(new URL("../app/functional-app.tsx", import.meta.url), "utf8");
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

  it("elimina la lista duplicada y monta las estadísticas", () => {
    assert.ok(!functional.includes("<PeopleTable"));
    assert.ok(!functional.includes("people.slice(0,6)"));
    for (const token of ["group-stats", "weightStats(", "stageStats(", "kgLostTotal(", "Sin datos"]) {
      assert.ok(functional.includes(token), `falta ${token}`);
    }
    assert.ok(css.includes(".group-stats-grid"));
  });
});
