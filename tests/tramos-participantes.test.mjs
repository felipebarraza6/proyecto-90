import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { formatStageLine, stageCells } from "../app/participant-summary.ts";

const restoredSource = readFileSync(
  new URL("../app/restored-panels.tsx", import.meta.url),
  "utf8",
);

const completed = {
  adherence_elapsed_days: 95,
  adherence_day_30: 80,
  adherence_day_60: 70,
  adherence_day_90: 90,
  adherence: 80,
};

const halfway = {
  adherence_elapsed_days: 45,
  adherence_day_30: 80,
  adherence_day_60: 41,
  adherence_day_60_partial: true,
  adherence: 70,
};

const empty = {};

describe("stageCells", () => {
  it("muestra los tres tramos completos y el total", () => {
    const cells = stageCells(completed);
    assert.deepEqual(cells.map((cell) => cell.label), ["0–30", "30–60", "60–90", "Total"]);
    assert.deepEqual(cells.map((cell) => cell.value), ["80%", "70%", "90%", "80%"]);
    assert.deepEqual(cells.map((cell) => cell.note), ["Completado", "Completado", "Completado", "0–hoy"]);
    assert.equal(cells.some((cell) => cell.inProgress), false);
  });

  it("marca en curso el tramo 30–60 a mitad de camino y deja el siguiente en espera", () => {
    const cells = stageCells(halfway);
    const current = cells.find((cell) => cell.label === "30–60");
    const locked = cells.find((cell) => cell.label === "60–90");
    assert.equal(current?.value, "41%");
    assert.equal(current?.note, "en curso");
    assert.equal(current?.inProgress, true);
    assert.equal(locked?.value, "en espera");
    assert.equal(locked?.inProgress, undefined);
  });

  it("sin datos deja guiones en cada tramo y conserva la nota", () => {
    const cells = stageCells(empty);
    assert.deepEqual(cells.map((cell) => cell.value), ["—", "—", "—", "—"]);
    assert.deepEqual(cells.map((cell) => cell.note), ["Aún no", "Aún no", "Aún no", "0–hoy"]);
    for (const cell of cells) assert.equal(typeof cell.note, "string");
  });
});

describe("formatStageLine", () => {
  it("sigue devolviendo la línea concatenada con ·", () => {
    assert.equal(
      formatStageLine(completed),
      "0–30 80% · 30–60 70% · 60–90 90% · Total 80%",
    );
    assert.equal(
      formatStageLine(halfway),
      "0–30 80% · 30–60 41% en curso · 60–90 en espera · Total 70%",
    );
    assert.equal(
      formatStageLine(empty),
      "0–30 — · 30–60 — · 60–90 — · Total —",
    );
  });
});

describe("tabla de Participantes", () => {
  it("monta los chips de tramo y ya no pinta la línea de texto en la celda", () => {
    assert.match(restoredSource, /className="stage-chips"/);
    assert.match(restoredSource, /stageCells\(p\)/);
    assert.doesNotMatch(
      restoredSource,
      /<small className="weight-arrow">\{formatStageLine\(p\)\}<\/small>/,
    );
  });
});
