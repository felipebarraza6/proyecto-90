import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  hasSeriesData,
  monthDates,
  seriesFromNutritionLogs,
  seriesFromWeeks,
} from "../app/weekly-panel/macroChartSeries.ts";

const insightsSource = readFileSync(
  new URL("../app/weekly-panel/InsightsPanel.tsx", import.meta.url),
  "utf8",
);
const cssSource = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

function weekFixture({ days, values, target }) {
  return {
    table: {
      days: days.map((date) => ({ date, weekday: 1, state: "due" })),
      rows: [
        {
          key: "protein",
          target,
          cells: values.map((value) => ({ value, pct: null, in_range: null, status: "met" })),
        },
      ],
    },
  };
}

describe("monthDates", () => {
  it("devuelve todos los días del mes en orden", () => {
    const dates = monthDates("2026-02");
    assert.equal(dates.length, 28);
    assert.equal(dates[0], "2026-02-01");
    assert.equal(dates[27], "2026-02-28");
  });

  it("mes inválido o vacío devuelve []", () => {
    assert.deepEqual(monthDates("2026-13"), []);
    assert.deepEqual(monthDates(""), []);
    assert.deepEqual(monthDates("2026-1"), []);
  });
});

describe("seriesFromNutritionLogs", () => {
  it("arma una posición por día y deja null donde no hay registro", () => {
    const series = seriesFromNutritionLogs("2026-02", "protein", [
      { log_date: "2026-02-01", protein: 90 },
      { log_date: "2026-02-02", protein: "abc" },
      { log_date: "nope", protein: 50 },
      { log_date: "2026-02-03T08:00:00Z", protein: "140" },
      { log_date: "2026-02-04", protein: null },
    ]);
    assert.equal(series.days.length, 28);
    assert.equal(series.values.length, 28);
    assert.equal(series.values[0], 90);
    assert.equal(series.values[1], null);
    assert.equal(series.values[2], 140);
    assert.equal(series.values[3], null);
    assert.equal(series.values[10], null);
  });

  it("ignora log_date inválido y valores no numéricos", () => {
    const series = seriesFromNutritionLogs("2026-02", "calories", [
      { log_date: "", calories: 2000 },
      { log_date: "2026-02-05", calories: "muchas" },
    ]);
    assert.equal(series.values.filter((value) => value != null).length, 0);
  });
});

describe("seriesFromWeeks", () => {
  const weekOne = weekFixture({
    days: ["2026-02-01", "2026-02-02", "2026-02-03"],
    values: [100, null, 115],
    target: 120,
  });
  const weekTwo = weekFixture({
    days: ["2026-02-08", "2026-02-09"],
    values: [130, 95],
    target: 125,
  });
  const weeks = new Map([
    ["2026-02-08", weekTwo],
    ["2026-02-01", weekOne],
  ]);

  it("toma el valor del día correcto desde la semana que lo contiene", () => {
    const { series } = seriesFromWeeks("2026-02", "protein", weeks);
    assert.equal(series.days.length, 28);
    assert.equal(series.values[0], 100);
    assert.equal(series.values[1], null);
    assert.equal(series.values[2], 115);
    assert.equal(series.values[7], 130);
    assert.equal(series.values[8], 95);
  });

  it("devuelve el target de la última fila encontrada", () => {
    const { target } = seriesFromWeeks("2026-02", "protein", weeks);
    assert.equal(target, 125);
  });

  it("no inventa valores cuando la semana no trae la fila", () => {
    const sinFila = new Map([
      ["2026-02-01", { table: { days: [{ date: "2026-02-01", weekday: 1, state: "due" }], rows: [] } }],
    ]);
    const { series, target } = seriesFromWeeks("2026-02", "protein", sinFila);
    assert.equal(series.values[0], null);
    assert.equal(target, null);
  });

  it("hasSeriesData es false si todos los valores son null", () => {
    const { series } = seriesFromWeeks("2026-02", "protein", new Map());
    assert.equal(hasSeriesData(series), false);
    assert.equal(hasSeriesData({ days: [], values: [null, null] }), false);
    assert.equal(hasSeriesData({ days: [], values: [null, 0] }), true);
  });
});

describe("contrato del gráfico de macros por período", () => {
  it("ya no existe un segundo selector de semana", () => {
    assert.equal(insightsSource.includes("Semana del gráfico"), false);
    assert.equal(/<label>\s*Semana/.test(insightsSource), false);
    assert.equal(insightsSource.includes("<select"), false);
  });

  it("ambas vistas usan las series del período y el estado vacío", () => {
    assert.ok(insightsSource.includes("seriesFromNutritionLogs"));
    assert.ok(insightsSource.includes("seriesFromWeeks"));
    assert.ok(insightsSource.includes("hasSeriesData"));
    assert.ok(insightsSource.includes("Cambia el período para ver otro mes"));
    assert.ok(insightsSource.includes("Macro por día · {monthLabel(month)}"));
    assert.ok(insightsSource.includes("days={series.days} values={series.values}"));
  });

  it("el CSS define el modo denso para mes completo", () => {
    assert.ok(cssSource.includes(".wp-insights-bars.is-dense"));
    assert.ok(cssSource.includes(".wp-insights-xaxis.is-dense"));
  });
});
