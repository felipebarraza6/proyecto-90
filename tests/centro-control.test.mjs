import assert from "node:assert/strict";
import { afterEach, describe, it, mock } from "node:test";
import { computeAdherenceAlerts } from "../app/adherence-alerts.ts";
import { countPendingNutrition, weekHasClosedDays } from "../app/centro-control.ts";

afterEach(() => {
  mock.timers.reset();
});

function freezeNow(iso) {
  mock.timers.enable({ apis: ["Date"], now: new Date(iso) });
}

describe("centro de control: nutrición pendiente", () => {
  it("cuenta sin plan, pending_review y rejected; excluye approved", () => {
    const people = [
      { id: 1 },
      { id: 2, nutrition_id: "n2", nutrition_status: "pending_review" },
      { id: 3, nutrition_id: "n3", nutrition_status: "rejected" },
      { id: 4, nutrition_id: "n4", nutrition_status: "approved" },
    ];

    assert.equal(countPendingNutrition(people), 3);
    assert.equal(countPendingNutrition([people[3]]), 0);
    assert.equal(countPendingNutrition([people[0]]), 1);
  });
});

describe("centro de control: riesgo y contador con la misma fuente", () => {
  it("riskCount coincide con riskReasons.size para un set de registros", () => {
    freezeNow("2026-11-24T15:00:00Z"); // martes 12:00 en Chile

    const people = [
      { id: 1, challenge_start: "2026-11-01" },
      { id: 2, challenge_start: "2026-11-01" },
    ];
    const records = [
      { user_id: 1, habit: "training", habit_date: "2026-11-23", status: "missed" },
      { user_id: 2, habit: "training", habit_date: "2026-11-23", status: "met" },
    ];
    const alerts = computeAdherenceAlerts(
      people,
      records,
      [],
      ["training", "macros"],
      { alert_min_affected_days: 1 },
    );

    assert.equal(weekHasClosedDays(alerts), true);
    assert.equal(alerts.riskCount, alerts.riskReasons.size);
    assert.deepEqual([...alerts.riskReasons.keys()], ["1"]);
  });

  it("un lunes sin días cerrados deja lista y contador en cero", () => {
    freezeNow("2026-11-23T15:00:00Z"); // lunes 12:00 en Chile

    const people = [{ id: 1, challenge_start: "2026-11-01" }];
    const records = [
      { user_id: 1, habit: "training", habit_date: "2026-11-22", status: "missed" },
    ];
    const alerts = computeAdherenceAlerts(
      people,
      records,
      [],
      ["training", "macros"],
      { alert_min_affected_days: 1 },
    );

    assert.equal(weekHasClosedDays(alerts), false);
    assert.equal(alerts.riskCount, alerts.riskReasons.size);
    assert.equal(alerts.riskCount, 0);
    assert.deepEqual([...alerts.riskReasons.keys()], []);
  });
});
