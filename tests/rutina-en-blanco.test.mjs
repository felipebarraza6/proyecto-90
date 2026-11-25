import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { isRenderableGuide, parseGuideContent } from "../app/guide-content.ts";

const functional = readFileSync(new URL("../app/functional-app.tsx", import.meta.url), "utf8");

describe("guía vacía", () => {
  it("un programa sin guía no es renderizable y no inventa días", () => {
    assert.equal(parseGuideContent(undefined), null);
    assert.equal(isRenderableGuide(undefined), false);
    assert.equal(isRenderableGuide({ content_json: JSON.stringify({ title: "", overview: [], days: [], reference: [] }) }), false);
  });
});

describe("Programas: la rutina nueva nace vacía", () => {
  it("el formulario de creación ya no pide ni envía dayCount", () => {
    assert.doesNotMatch(functional, /dayCount/);
    assert.doesNotMatch(functional, /Select n="dayCount"/);
    assert.match(functional, /program:"program\.create"/);
  });

  it("avisa que la rutina se crea sin días ni ejercicios", () => {
    assert.match(functional, /La rutina se crea vacía: sin días ni ejercicios\./);
  });

  it("no inyecta contenido de ejemplo al crear", () => {
    const programForm = functional.slice(functional.indexOf('if(modal==="program")return'), functional.indexOf('if(modal==="workout"'));
    assert.ok(programForm.length > 0);
    assert.doesNotMatch(programForm, /Calentamiento/);
    assert.doesNotMatch(programForm, /Bloque A/);
    assert.doesNotMatch(programForm, /\bCore\b/);
    assert.doesNotMatch(programForm, /workout\.create|workout\.exercise\.add|program\.guide/);
  });

  it("muestra «Agregar día» en la rama sin guía, sin depender de días previos", () => {
    assert.match(functional, /:program&&<>[\s\S]*?＋ Agregar día/);
    assert.match(functional, /workouts\.length===0\?<Empty title="Aún no hay días de entrenamiento"/);
  });

  it("no autoabre ni selecciona un día inexistente al crear el programa", () => {
    assert.doesNotMatch(functional, /program\.create[\s\S]{0,200}open\("workout"/);
    assert.match(functional, /const program=programs\.find\(x=>String\(x\.id\)===active\)\|\|programs\[0\]/);
  });
});
