import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const app = readFileSync(new URL("../app/functional-app.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

const rule = (selector) => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = css.match(new RegExp(`${escaped}\\{([^}]*)\\}`));
  return match ? match[1] : "";
};

describe("Programas: rutinas en grilla seleccionable (#67)", () => {
  it("la grilla usa 4 columnas sin scroll horizontal", () => {
    const tabs = rule(".program-tabs");
    assert.match(tabs, /display:grid/);
    assert.match(tabs, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
    assert.ok(!tabs.includes("overflow:auto"), ".program-tabs no debe usar overflow:auto");
    assert.ok(!tabs.includes("overflow: scroll"), ".program-tabs no debe usar overflow:scroll");
  });

  it("los botones no fuerzan un ancho fijo y permiten envolver texto", () => {
    const button = rule(".program-tabs button");
    assert.ok(!button.includes("min-width:190px"), "se quitó el min-width que provocaba el scroll");
    assert.match(button, /min-width:0/);
    assert.match(button, /width:100%/);
    assert.match(button, /overflow-wrap:anywhere/);
  });

  it("la tarjeta activa se distingue con anillo y foco visible", () => {
    const active = rule(".program-tabs button.active");
    assert.match(active, /border-color:#347748/);
    assert.match(active, /box-shadow:inset 0 -2px var\(--green\),0 0 0 1px #347748/);
    const focus = rule(".program-tabs button:focus-visible");
    assert.match(focus, /outline:2px solid var\(--green\)/);
  });

  it("colapsa a 2 columnas en 1100 px y a 1 columna en 760 px", () => {
    assert.ok(
      css.includes("@media(max-width:1100px){.program-tabs{grid-template-columns:repeat(2,minmax(0,1fr))}}"),
      "falta el breakpoint de 1100 px con 2 columnas",
    );
    assert.ok(
      css.includes("@media(max-width:760px){.program-tabs{grid-template-columns:1fr}}"),
      "falta el breakpoint de 760 px con 1 columna",
    );
  });

  it("el texto de las tarjetas no desborda la celda", () => {
    const labels = rule(".program-tabs b,.program-tabs small");
    assert.ok(!labels.includes("white-space:nowrap"));
    const b = rule(".program-tabs b");
    const small = rule(".program-tabs small");
    assert.ok(!/min-width:\s*[1-9]/.test(b));
    assert.ok(!/min-width:\s*[1-9]/.test(small));
  });

  it("el selector es accesible y seleccionable con teclado", () => {
    assert.match(app, /<div className="program-tabs" role="group" aria-label="Rutinas">/);
    assert.match(
      app,
      /<button type="button" aria-pressed=\{String\(p\.id\)===String\(program\?\.id\)\} className=\{String\(p\.id\)===String\(program\?\.id\)\?"active":""\}/,
    );
  });
});
