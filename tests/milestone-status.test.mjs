import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { missingWeightNotice, stageRows } from "../app/milestone-status.ts";

const days = [30, 60, 90];

describe("missingWeightNotice", () => {
  it("día 29 con el peso 30 vacío no avisa: el hito todavía no es vigente", () => {
    assert.equal(missingWeightNotice(29, { 30: null }, days), null);
  });

  it("día 30 con el peso 30 vacío pide ese registro", () => {
    assert.equal(missingWeightNotice(30, { 30: null }, days), "Registra tu peso del día 30");
  });

  it("día 45 con el peso 30 presente y el 60 vacío no avisa el futuro", () => {
    assert.equal(missingWeightNotice(45, { 30: 70, 60: null }, days), null);
  });

  it("día 60 con 30 y 60 vacíos nombra solo el hito vigente", () => {
    assert.equal(missingWeightNotice(60, { 30: null, 60: null }, days), "Registra tu peso del día 60");
  });

  it("día 60 con el peso 60 presente no avisa", () => {
    assert.equal(missingWeightNotice(60, { 30: null, 60: 65 }, days), null);
  });
});

describe("stageRows", () => {
  it("día 30 deja 0–30 en curso y los tramos siguientes aún no", () => {
    const rows = stageRows(30, { day30: null, day60: null, day90: null, total: null });
    assert.deepEqual(
      rows.map((row) => ({ label: row.label, value: row.value, note: row.note })),
      [
        { label: "0–30", value: "—", note: "En curso" },
        { label: "30–60", value: "—", note: "Aún no" },
        { label: "60–90", value: "—", note: "Aún no" },
        { label: "Total", value: "—", note: "0–hoy" },
      ],
    );
  });

  it("día 31 cierra 0–30 con su % y abre 30–60", () => {
    const rows = stageRows(31, { day30: 80, day60: null, day90: null, total: 72 });
    const byLabel = Object.fromEntries(rows.map((row) => [row.label, row]));
    assert.equal(byLabel["0–30"].value, "80%");
    assert.equal(byLabel["0–30"].note, "Completado");
    assert.equal(byLabel["30–60"].note, "En curso");
    assert.equal(byLabel["30–60"].value, "—");
    assert.equal(byLabel.Total.value, "72%");
    assert.equal(byLabel.Total.note, "0–hoy");
  });

  it("un total vacío es un guion, no 0%", () => {
    const rows = stageRows(31, { day30: 80, day60: null, day90: null, total: null });
    const total = rows.find((row) => row.label === "Total");
    assert.equal(total.value, "—");
    assert.equal(total.note, "0–hoy");
  });
});
