import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  contentCategoryIconLabel,
  formatPublishDate,
} from "../app/content-library.ts";

const uiSource = readFileSync(
  new URL("../app/content-library-ui.tsx", import.meta.url),
  "utf8",
);
const iconsSource = readFileSync(
  new URL("../app/content-icons.tsx", import.meta.url),
  "utf8",
);

describe("formatPublishDate", () => {
  it("formatea una fecha ISO 8601 en es-CL sin correrse de día", () => {
    const formatted = formatPublishDate("2026-11-12T00:00:00Z");
    assert.match(formatted, /nov/);
    assert.match(formatted, /2026/);
    assert.match(formatPublishDate("2026-11-12"), /12/);
  });

  it("deja vacío lo que no es una fecha válida", () => {
    for (const value of ["", null, undefined, "no-es-fecha"]) {
      assert.equal(formatPublishDate(value), "");
    }
  });
});

describe("contentCategoryIconLabel", () => {
  it("nombra las cuatro categorías canónicas", () => {
    assert.equal(contentCategoryIconLabel("Hábitos"), "Lectura");
    assert.equal(contentCategoryIconLabel("Nutrición"), "Nutrición");
    assert.equal(contentCategoryIconLabel("Entrenamiento"), "Entrenamiento");
    assert.equal(contentCategoryIconLabel("Sesiones"), "Sesiones");
  });

  it("usa un nombre genérico para una categoría desconocida", () => {
    assert.equal(contentCategoryIconLabel("Otro"), "Contenido");
  });
});

describe("biblioteca de contenido", () => {
  it("la interfaz monta los íconos por categoría y la fecha de publicación", () => {
    assert.match(uiSource, /ContentCategoryIcon/);
    assert.match(uiSource, /formatPublishDate/);
    assert.match(uiSource, /publish_at/);
    assert.doesNotMatch(uiSource, /published_at/);
  });

  it("los íconos son SVG decorativos con el mismo trazo", () => {
    assert.match(iconsSource, /aria-hidden="true"/);
    assert.match(iconsSource, /focusable="false"/);
    assert.match(iconsSource, /contentCategoryIconLabel/);
  });
});
