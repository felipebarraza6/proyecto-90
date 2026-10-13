import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const app = readFileSync(new URL("../app/functional-app.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("Estado select labels", () => {
  it("muestra etiquetas en español manteniendo los values", () => {
    assert.match(
      app,
      /Select n="status" l="Estado"[^>]*opts=\{\["invited","onboarding","review","configuration","active","finished"\]\} labels=\{\["Invitado","Primer ingreso","En revisión","En configuración","Activo","Finalizado"\]\}/,
    );
    assert.match(app, /onboarding:"Primer ingreso"/);
    assert.match(app, /configuration:"En configuración"/);
  });
});

describe("Overflow guards (CSS)", () => {
  it("nutrición: cards y header text se encogen/envuelven", () => {
    assert.match(css, /\.nutrition-card\{[^}]*max-width:100%;min-width:0/);
    assert.match(css, /\.nutrition-card>header[^}]*flex-wrap:wrap/);
    assert.match(css, /\.nutrition-card header>\.person-link\{[^}]*min-width:0;max-width:100%;[^}]*flex-wrap:wrap/);
    assert.match(css, /overflow-wrap:anywhere/);
  });

  it("participantes: tabla no ensancha la página", () => {
    assert.match(css, /\.participant-table\{overflow-x:auto;max-width:100%\}/);
    assert.match(css, /\.participant-table \.row-actions\{flex-wrap:wrap/);
  });

  it("contenedor principal bloquea scroll horizontal de página", () => {
    assert.match(css, /main\{[^}]*overflow-x:hidden/);
    assert.match(css, /\.app-shell\{[^}]*overflow-x:hidden/);
  });
});
