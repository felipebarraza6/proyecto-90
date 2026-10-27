import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  FLOW_CONFIRM_INTERVAL_MS,
  FLOW_CONFIRM_MAX_MS,
  formatDueDate,
  formatPesosClp,
  installmentIdFromPath,
  interpretInstallmentPayload,
  isFromFlow,
  loadInstallmentView,
} from "../app/pay-installment.ts";

describe("installmentIdFromPath", () => {
  it("extrae el id de /checkout/pay-installment/<id>", () => {
    assert.equal(
      installmentIdFromPath("/checkout/pay-installment/abc-123"),
      "abc-123",
    );
    assert.equal(
      installmentIdFromPath("/checkout/pay-installment/abc-123/"),
      "abc-123",
    );
  });

  it("devuelve null si la ruta no corresponde", () => {
    assert.equal(installmentIdFromPath("/checkout/result"), null);
    assert.equal(installmentIdFromPath("/"), null);
    assert.equal(installmentIdFromPath("/checkout/pay-installment/"), null);
  });
});

describe("formatPesosClp / formatDueDate", () => {
  it("formatea montos en es-CL", () => {
    assert.match(formatPesosClp(199990), /199\.990|199,990/);
  });

  it("formatea vencimiento ISO a fecha local legible", () => {
    assert.match(formatDueDate("2026-11-15"), /15/);
  });
});

describe("interpretInstallmentPayload", () => {
  it("marca ya pagada cuando status es PAID", () => {
    const view = interpretInstallmentPayload(200, {
      status: "PAID",
      message: "Esta cuota ya se encuentra pagada.",
      number: 2,
      total_installments: 3,
    });
    assert.equal(view.kind, "already_paid");
    assert.equal(view.number, 2);
  });

  it("marca inválida en 404", () => {
    const view = interpretInstallmentPayload(404, { detail: "Not found." });
    assert.equal(view.kind, "invalid");
  });

  it("expone datos de pago pendientes con payment_url", () => {
    const view = interpretInstallmentPayload(200, {
      id: "uuid-1",
      number: 2,
      total_installments: 3,
      amount_clp: 50000,
      due_date: "2026-11-15",
      status: "PENDING",
      payment_url: "https://www.flow.cl/pay?token=x",
      business_name: "Demo",
    });
    assert.equal(view.kind, "ready");
    assert.equal(view.amount_clp, 50000);
    assert.equal(view.payment_url, "https://www.flow.cl/pay?token=x");
  });

  it("marca error si falta payment_url en cuota pendiente", () => {
    const view = interpretInstallmentPayload(200, {
      number: 1,
      total_installments: 3,
      amount_clp: 1000,
      due_date: "2026-11-15",
      status: "PENDING",
      payment_url: null,
    });
    assert.equal(view.kind, "error");
  });
});

describe("isFromFlow", () => {
  it("detecta ?from=flow en el query", () => {
    assert.equal(isFromFlow("?from=flow"), true);
    assert.equal(isFromFlow("from=flow&token=x"), true);
    assert.equal(isFromFlow("?foo=bar"), false);
    assert.equal(isFromFlow(""), false);
  });
});

const pendingView = interpretInstallmentPayload(200, {
  id: "uuid-1",
  number: 2,
  total_installments: 3,
  amount_clp: 50000,
  due_date: "2026-11-15",
  status: "PENDING",
  payment_url: "https://www.flow.cl/pay?token=x",
});

const paidView = interpretInstallmentPayload(200, {
  status: "PAID",
  message: "Esta cuota ya se encuentra pagada.",
  number: 2,
  total_installments: 3,
});

function fakeClock() {
  let now = 0;
  const sleeps = [];
  return {
    now: () => now,
    sleep: async (ms) => {
      sleeps.push(ms);
      now += ms;
    },
    sleeps,
  };
}

describe("loadInstallmentView (retorno Flow)", () => {
  it("no reintenta si la URL no trae from=flow", async () => {
    let calls = 0;
    const view = await loadInstallmentView({
      fetchView: async () => {
        calls += 1;
        return pendingView;
      },
      fromFlow: false,
    });
    assert.equal(view.kind, "ready");
    assert.equal(calls, 1);
  });

  it("no reintenta si from=flow y ya está pagada", async () => {
    let calls = 0;
    const view = await loadInstallmentView({
      fetchView: async () => {
        calls += 1;
        return paidView;
      },
      fromFlow: true,
    });
    assert.equal(view.kind, "already_paid");
    assert.equal(calls, 1);
  });

  it("reintenta cada 2s y muestra pagada cuando Flow confirma", async () => {
    let calls = 0;
    const clock = fakeClock();
    const view = await loadInstallmentView({
      fetchView: async () => {
        calls += 1;
        return calls >= 4 ? paidView : pendingView;
      },
      fromFlow: true,
      now: clock.now,
      sleep: clock.sleep,
    });
    assert.equal(view.kind, "already_paid");
    assert.equal(calls, 4);
    assert.deepEqual(clock.sleeps, [
      FLOW_CONFIRM_INTERVAL_MS,
      FLOW_CONFIRM_INTERVAL_MS,
      FLOW_CONFIRM_INTERVAL_MS,
    ]);
  });

  it("si se agotan ~20s pendiente, espera confirmación en minutos", async () => {
    let calls = 0;
    const clock = fakeClock();
    const view = await loadInstallmentView({
      fetchView: async () => {
        calls += 1;
        return pendingView;
      },
      fromFlow: true,
      now: clock.now,
      sleep: clock.sleep,
    });
    assert.equal(view.kind, "awaiting_confirmation");
    assert.match(view.message || "", /unos minutos/i);
    assert.equal(clock.sleeps.every((ms) => ms === FLOW_CONFIRM_INTERVAL_MS), true);
    assert.equal(clock.now(), FLOW_CONFIRM_MAX_MS);
    assert.ok(calls > 1);
  });

  it("avisa onConfirming al empezar a reintentar una cuota pendiente", async () => {
    let confirming = false;
    const clock = fakeClock();
    await loadInstallmentView({
      fetchView: async () => paidView,
      fromFlow: true,
      now: clock.now,
      sleep: clock.sleep,
      onConfirming: () => {
        confirming = true;
      },
    });
    assert.equal(confirming, false);

    confirming = false;
    let calls = 0;
    await loadInstallmentView({
      fetchView: async () => {
        calls += 1;
        return calls >= 2 ? paidView : pendingView;
      },
      fromFlow: true,
      now: clock.now,
      sleep: clock.sleep,
      onConfirming: () => {
        confirming = true;
      },
    });
    assert.equal(confirming, true);
  });
});
