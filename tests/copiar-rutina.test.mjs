import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { copiedRoutineName } from "../app/copy-routine.ts";

const functional = readFileSync(new URL("../app/functional-app.tsx", import.meta.url), "utf8");
const dialog = readFileSync(new URL("../app/copy-routine-dialog.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("copiedRoutineName", () => {
  it("agrega el sufijo (copia) y recorta espacios", () => {
    assert.equal(copiedRoutineName("  Fuerza base  "), "Fuerza base (copia)");
  });

  it("no duplica el sufijo si el nombre ya es una copia", () => {
    assert.equal(copiedRoutineName("Fuerza base (copia)"), "Fuerza base (copia)");
    assert.equal(copiedRoutineName("Fuerza base (COPIA)"), "Fuerza base (COPIA)");
  });

  it("usa un nombre base cuando llega vacío", () => {
    assert.equal(copiedRoutineName(""), "Rutina (copia)");
    assert.equal(copiedRoutineName(null), "Rutina (copia)");
  });
});

describe("Programas: copiar rutina", () => {
  it("muestra el botón Copiar rutina junto a Crear rutina y lo oculta en solo lectura", () => {
    assert.match(functional, /Copiar rutina<\/button>/);
    assert.match(functional, /secondaryAction=\{readOnly\|\|!program\?undefined:/);
    assert.match(functional, /action=\{readOnly\?undefined:<button className="primary" onClick=\{\(\)=>open\("program"\)\}>＋ Crear rutina<\/button>\}/);
  });

  it("envía la acción program.copy con id y nombre editado", () => {
    assert.match(functional, /action:"program\.copy"/);
    assert.match(functional, /id:String\(program\.id\),name/);
  });

  it("selecciona la copia con el id devuelto", () => {
    assert.match(functional, /const copyId=String\(json\?\.id\|\|""\)/);
    assert.match(functional, /if\(copyId\)setActive\(copyId\)/);
  });

  it("no usa window.prompt ni prompt()", () => {
    for (const source of [functional, dialog]) {
      assert.doesNotMatch(source, /window\.prompt/);
      assert.doesNotMatch(source, /(^|[^.\w])prompt\(/);
    }
  });

  it("el diálogo es accesible: Escape, backdrop, role dialog y foco inicial", () => {
    assert.match(dialog, /role="dialog"/);
    assert.match(dialog, /aria-modal="true"/);
    assert.match(dialog, /event\.key === "Escape"/);
    assert.match(dialog, /event\.target === event\.currentTarget/);
    assert.match(dialog, /inputRef\.current\?\.focus\(\)/);
    assert.match(dialog, /type="button"/);
  });

  it("tiene CSS propio sin alterar los bloques existentes", () => {
    assert.match(css, /\.copy-routine-dialog\{/);
  });
});
