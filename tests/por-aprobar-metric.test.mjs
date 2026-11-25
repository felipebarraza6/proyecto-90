import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { isNutritionPending } from "../app/centro-control.ts";

const functional = readFileSync(new URL("../app/functional-app.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("indicador «Por aprobar» (issue #73)", () => {
  it("Metric acepta onClick opcional y solo entonces renderiza button", () => {
    assert.ok(
      functional.includes(
        "function Metric({label,value,note,green=false,onClick}:{label:string;value:string;note:string;green?:boolean;onClick?:()=>void})",
      ),
    );
    assert.ok(
      functional.includes(
        'return onClick?<button type="button" className={`metric ${green?"green":""}`} onClick={onClick}>',
      ),
    );
    assert.ok(
      functional.includes(
        ':<article className={`metric ${green?"green":""}`}>',
      ),
    );
  });

  it("«Por aprobar» del dashboard profesional abre Nutrición filtrada a pendientes", () => {
    assert.ok(
      functional.includes(
        '<Metric label="Por aprobar" value={String(pending.length)} note="Prioridad actual" onClick={nutrition?()=>{setNutritionFilterIntent("pending");setScreen("Nutrición")}:undefined}/>',
      ),
    );
  });

  it("el conteo del dashboard y isNutritionPending usan el mismo criterio", () => {
    const people = [
      { id: 1 },
      { id: 2, nutrition_id: "n2", nutrition_status: "pending_review" },
      { id: 3, nutrition_id: "n3", nutrition_status: "rejected" },
      { id: 4, nutrition_id: "n4", nutrition_status: "approved" },
    ];

    const dashboardPending = people.filter(
      (x) => !x.nutrition_id || x.nutrition_status !== "approved",
    );
    const workspacePending = people.filter(isNutritionPending);

    assert.deepEqual(
      dashboardPending.map((person) => person.id),
      workspacePending.map((person) => person.id),
    );
    assert.deepEqual(dashboardPending.map((person) => person.id), [1, 2, 3]);
  });

  it("CSS: el metric como botón conserva la caja del article", () => {
    assert.match(
      css,
      /button\.metric\{[^}]*color:inherit;font:inherit;text-align:left;width:100%;cursor:pointer/,
    );
    assert.match(css, /button\.metric:hover\{[^}]*border-color:#2f5d3d/);
    assert.match(css, /button\.metric:focus-visible\{[^}]*outline:2px solid var\(--green\)/);
  });
});
