import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatStageLine, formatWeightTrail, participantSummaryCsv } from "../app/participant-summary.ts";

describe("formatWeightTrail", () => {
  it("arma la cadena 0 → 30 → 60 → 90 y el delta contra el inicio", () => {
    const trail = formatWeightTrail({ weight: 70, weight_day_30: 68 });
    assert.equal(trail.text, "70 → 68 → — → — kg");
    assert.equal(trail.delta, "-2 kg");
  });

  it("sin ningún peso deja guiones y delta vacío", () => {
    const trail = formatWeightTrail({});
    assert.equal(trail.text, "— → — → — → — kg");
    assert.equal(trail.delta, "—");
  });
});

describe("formatStageLine", () => {
  it("marca el tramo en curso, el futuro y el total", () => {
    assert.equal(
      formatStageLine({
        adherence_elapsed_days: 31,
        adherence_day_30: 80,
        adherence: 72,
      }),
      "0–30 80% · 30–60 En curso · 60–90 — · Total 72%",
    );
  });

  it("con adherencia parcial marca en curso y en espera", () => {
    assert.equal(
      formatStageLine({
        adherence_elapsed_days: 45,
        adherence_day_30: 80,
        adherence_day_60: 41,
        adherence_day_60_partial: true,
        adherence: 70,
        adherence_stages: [
          { day: 30, start: 1, end: 30, pct: 80, status: "done" },
          { day: 60, start: 31, end: 60, pct: 41, status: "current" },
          { day: 90, start: 61, end: 90, pct: null, status: "locked" },
        ],
      }),
      "0–30 80% · 30–60 41% en curso · 60–90 en espera · Total 70%",
    );
  });

  it("un total vacío se escribe Total —", () => {
    assert.equal(
      formatStageLine({ adherence_elapsed_days: 31, adherence_day_30: 80 }),
      "0–30 80% · 30–60 En curso · 60–90 — · Total —",
    );
  });
});

describe("participantSummaryCsv", () => {
  it("deja vacías las celdas de peso que no existen y cita un nombre con coma", () => {
    const csv = participantSummaryCsv([
      {
        first_name: "Ana, Luz",
        last_name: "Pérez",
        email: "ana@example.com",
        adherence_elapsed_days: 31,
        weight: 70,
        weight_day_30: 68,
        adherence_day_30: 80,
        adherence: 72,
      },
      { first_name: "Sin", last_name: "Datos", email: "sin@example.com" },
    ]);
    const lines = csv.split("\n");
    assert.equal(
      lines[0],
      "nombre,email,dia,peso_0,peso_30,peso_60,peso_90,delta_kg,adherencia_0_30,adherencia_30_60,adherencia_60_90,adherencia_total",
    );
    assert.equal(
      lines[1],
      '"Ana, Luz Pérez",ana@example.com,31,70,68,,,-2,80,,,72',
    );
    assert.equal(lines[2], "Sin Datos,sin@example.com,,,,,,,,,,");
  });
});
