import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { afterEach, describe, it, mock } from "node:test";
import {
  computeAdherenceAlerts,
  weekHasClosedDays,
} from "../app/adherence-alerts.ts";

const functional = readFileSync(new URL("../app/functional-app.tsx", import.meta.url), "utf8");
const panel = readFileSync(new URL("../app/adherence-panel.tsx", import.meta.url), "utf8");

afterEach(() => {
  mock.timers.reset();
});

function freezeNow(iso) {
  mock.timers.enable({ apis: ["Date"], now: new Date(iso) });
}

describe("alerta de seguimiento: mismo número que la lista", () => {
  it("riskCount coincide con el set de ids en riesgo (macros)", () => {
    freezeNow("2026-11-24T15:00:00Z"); // martes 12:00 en Chile

    const people = [
      { id: 1, challenge_start: "2026-11-01", calories: 2000, protein: 150, carbs: 200, fats: 60 },
      { id: 2, challenge_start: "2026-11-01", calories: 2000, protein: 150, carbs: 200, fats: 60 },
      { id: 3, challenge_start: "2026-12-01", calories: 2000, protein: 150, carbs: 200, fats: 60 },
    ];
    const nutritionRecords = [
      { user_id: 1, log_date: "2026-11-23", calories: 200, protein: 20, carbs: 20, fats: 5 },
      { user_id: 2, log_date: "2026-11-23", calories: 2000, protein: 150, carbs: 200, fats: 60 },
    ];

    const alerts = computeAdherenceAlerts(
      people,
      [],
      nutritionRecords,
      ["macros"],
      { alert_min_affected_days: 1 },
    );

    assert.equal(weekHasClosedDays(alerts), true);
    assert.equal(alerts.riskCount, alerts.riskReasons.size);
    assert.deepEqual([...alerts.riskReasons.keys()], ["1"]);
    assert.equal(alerts.riskCount, 1);
  });

  it("sin días cerrados el contador es 0 y la UI muestra «—»", () => {
    freezeNow("2026-11-23T15:00:00Z"); // lunes 12:00 en Chile

    const people = [
      { id: 1, challenge_start: "2026-11-01", calories: 2000, protein: 150, carbs: 200, fats: 60 },
    ];
    const nutritionRecords = [
      { user_id: 1, log_date: "2026-11-22", calories: 200, protein: 20, carbs: 20, fats: 5 },
    ];

    const alerts = computeAdherenceAlerts(
      people,
      [],
      nutritionRecords,
      ["macros"],
      { alert_min_affected_days: 1 },
    );

    assert.equal(weekHasClosedDays(alerts), false);
    assert.equal(alerts.riskCount, 0);
    assert.match(
      functional,
      /value=\{riskHasClosedDays\?String\(alerts\.riskCount\):"—"\}/,
    );
    assert.match(functional, /Aún no hay datos suficientes de esta semana/);
  });
});

describe("fuente única del contador", () => {
  it("el dashboard profesional usa alerts.riskCount y no un contador duplicado", () => {
    assert.match(functional, /const alerts=computeAdherenceAlerts\(/);
    assert.match(functional, /alerts\.riskCount/);
    assert.doesNotMatch(functional, /function countRiskyParticipants/);
  });

  it("el centro de control admin también usa computeAdherenceAlerts", () => {
    assert.match(
      functional,
      /const riskAlerts=computeAdherenceAlerts\(people,data\.habitDaily\|\|\[\],data\.nutritionDaily\|\|\[\],\["training","macros"\],panelConfig\); const risk=riskAlerts\.riskCount/,
    );
  });
});

describe("abrir seguimiento con la lista filtrada", () => {
  it("el botón fija la intención «risk» y navega a Seguimiento", () => {
    assert.match(
      functional,
      /setPanelFilterIntentState\("risk"\);setScreen\("Seguimiento"\)/,
    );
  });

  it("la rama Seguimiento pasa initialFilter al panel", () => {
    assert.match(
      functional,
      /mode=\{nutrition\?"macros":"training"\}[^>]*initialFilter=\{panelFilterIntent \?\? "all"\}/,
    );
    assert.match(panel, /initialFilter\?: AlertFilter/);
    assert.match(panel, /useState<AlertFilter>\(initialFilter\)/);
  });
});
