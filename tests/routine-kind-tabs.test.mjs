import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const app = readFileSync(new URL("../app/functional-app.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

// Regresión #74: antes `.routine-kind-tabs` existía solo dentro de
// `@media(max-width:620px)`, así que en web los dos botones se veían como
// texto inline. Partimos el CSS en el media query para asegurar que la base
// vive fuera y aplica también en desktop.
const mediaStart = css.indexOf("@media(max-width:620px)");
const baseCss = css.slice(0, mediaStart);

describe("Selector de rutinas: botones separados en web", () => {
  it("define el contenedor base fuera del media query de 620px", () => {
    assert.ok(mediaStart > 0, "debe existir el media query de 620px");
    assert.match(baseCss, /\.routine-kind-tabs\{[^}]*display:flex;/);
    assert.match(baseCss, /\.routine-kind-tabs\{[^}]*gap:10px;/);
  });

  it("define los botones base fuera del media query de 620px", () => {
    assert.match(baseCss, /\.routine-kind-tabs button\{[^}]*border:1px solid var\(--line\);/);
    assert.match(baseCss, /\.routine-kind-tabs button\{[^}]*border-radius:[^;}]+;/);
    assert.match(baseCss, /\.routine-kind-tabs button\{[^}]*padding:[^;}]+;/);
    assert.match(baseCss, /\.routine-kind-tabs button\{[^}]*cursor:pointer;/);
  });

  it("marca el botón activo con el verde de la marca", () => {
    assert.match(baseCss, /\.routine-kind-tabs button\.active\{[^}]*color:var\(--green\)/);
    assert.match(baseCss, /\.routine-kind-tabs button\.active\{[^}]*background:#173020/);
  });

  it("el alumno ve exactamente dos botones type=button en el nav", () => {
    const start = app.indexOf("function ParticipantTrainingRoute");
    const end = app.indexOf("\nfunction ", start + 1);
    assert.ok(start >= 0, "debe existir ParticipantTrainingRoute");
    assert.ok(end > start, "debe existir la función siguiente");

    const participant = app.slice(start, end);
    const nav = participant.match(/<nav className="routine-kind-tabs"[^>]*>([\s\S]*?)<\/nav>/);
    assert.ok(nav, "el alumno debe renderizar el nav de rutinas");

    const buttons = nav[1].match(/<button type="button"/g) || [];
    assert.equal(buttons.length, 2);
    assert.match(nav[1], />Mi rutina principal</);
    assert.match(nav[1], />Emergencia · para entrenar en casa</);
  });

  it("el nav del alumno conserva su aria-label", () => {
    assert.match(
      app,
      /<nav className="routine-kind-tabs" aria-label="Rutinas disponibles">/,
    );
  });
});
