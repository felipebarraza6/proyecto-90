import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveStudentWeightCards } from "../app/weekly-panel/weightCards.ts";

const days = [30, 60, 90];

const contaminated = {
  milestoneDays: days,
  panelInitialKg: 143.9,
  panelMilestones: [
    { day: 30, kg: 143.9 },
    { day: 60, kg: 143.9 },
    { day: 90, kg: 143.9 },
  ],
  panelLatestKg: 143.9,
};

describe("tarjetas de peso de la ficha", () => {
  it("usa el peso de Participantes cuando el panel repite el último en Inicial y Día 30", () => {
    const cards = resolveStudentWeightCards({
      ...contaminated,
      participant: {
        weight: 150,
        milestones: { 30: 143.9, 60: null, 90: null },
        latest: 143.9,
      },
    });
    assert.equal(cards.initial, 150);
    assert.equal(cards.milestones.find((row) => row.day === 30)?.kg, 143.9);
    assert.equal(cards.latest, 143.9);
  });

  it("deja Día 60 y Día 90 pendientes si Participantes no tiene esos hitos", () => {
    const cards = resolveStudentWeightCards({
      ...contaminated,
      participant: {
        weight: 150,
        milestones: { 30: 143.9, 60: null, 90: null },
        latest: 143.9,
      },
    });
    assert.equal(cards.milestones.find((row) => row.day === 60)?.kg, null);
    assert.equal(cards.milestones.find((row) => row.day === 90)?.kg, null);
  });

  it("un hito tardío no reemplaza el inicial ni rellena hitos futuros", () => {
    const cards = resolveStudentWeightCards({
      milestoneDays: days,
      panelInitialKg: 143.9,
      panelMilestones: [
        { day: 30, kg: 143.9 },
        { day: 60, kg: null },
        { day: 90, kg: null },
      ],
      panelLatestKg: 143.9,
      participant: {
        weight: 150,
        milestones: { 30: 143.9, 60: null, 90: null },
        latest: 143.9,
      },
    });
    assert.equal(cards.initial, 150);
    assert.equal(cards.milestones.find((row) => row.day === 30)?.kg, 143.9);
    assert.equal(cards.milestones.find((row) => row.day === 60)?.kg, null);
  });

  it("sin fila de Participantes no inventa el inicial ni copia el último a hitos vacíos del panel", () => {
    const cards = resolveStudentWeightCards({
      milestoneDays: days,
      panelInitialKg: 143.9,
      panelMilestones: [
        { day: 30, kg: 143.9 },
        { day: 60, kg: null },
        { day: 90, kg: null },
      ],
      panelLatestKg: 143.9,
      participant: null,
    });
    assert.equal(cards.initial, 143.9);
    assert.equal(cards.milestones.find((row) => row.day === 60)?.kg, null);
    assert.equal(cards.correctedFromParticipant, false);
  });
});
