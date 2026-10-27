import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTENT_CATEGORIES,
  buildParticipantContentItems,
  groupContentByCategory,
  normalizeContentCategory,
} from "../app/content-library.ts";

describe("normalizeContentCategory", () => {
  it("mapea las cuatro categorías canónicas", () => {
    assert.equal(normalizeContentCategory("Hábitos"), "Hábitos");
    assert.equal(normalizeContentCategory("Nutrición"), "Nutrición");
    assert.equal(normalizeContentCategory("Entrenamiento"), "Entrenamiento");
    assert.equal(normalizeContentCategory("Sesiones"), "Sesiones");
  });

  it("envía categorías desconocidas a Hábitos", () => {
    assert.equal(normalizeContentCategory("Otro"), "Hábitos");
    assert.equal(normalizeContentCategory(""), "Hábitos");
    assert.equal(normalizeContentCategory(undefined), "Hábitos");
    assert.equal(normalizeContentCategory(null), "Hábitos");
  });
});

describe("groupContentByCategory", () => {
  it("siempre expone las 4 categorías con contador (vacías en 0)", () => {
    const groups = groupContentByCategory([]);
    assert.deepEqual(
      groups.map((g) => ({ category: g.category, count: g.count })),
      CONTENT_CATEGORIES.map((category) => ({ category, count: 0 })),
    );
  });

  it("agrupa por categoría normalizada y cuenta items", () => {
    const groups = groupContentByCategory([
      { id: "1", title: "A", category: "Nutrición" },
      { id: "2", title: "B", category: "desconocida" },
      { id: "3", title: "C", category: "Entrenamiento" },
      { id: "4", title: "D", category: "Nutrición" },
    ]);
    const byCat = Object.fromEntries(groups.map((g) => [g.category, g]));
    assert.equal(byCat["Nutrición"].count, 2);
    assert.equal(byCat["Hábitos"].count, 1);
    assert.equal(byCat["Hábitos"].items[0].id, "2");
    assert.equal(byCat["Entrenamiento"].count, 1);
    assert.equal(byCat["Sesiones"].count, 0);
  });
});

describe("buildParticipantContentItems", () => {
  it("inyecta la Guía nutricional en Nutrición si no está en la biblioteca", () => {
    const items = buildParticipantContentItems(
      [{ id: "c1", title: "Video", category: "Hábitos" }],
      "guides/plan.pdf",
    );
    assert.equal(items[0].id, "nutrition-guide");
    assert.equal(items[0].category, "Nutrición");
    assert.equal(items[0].file_key, "guides/plan.pdf");
    assert.equal(items.length, 2);
  });

  it("no duplica la guía si ya existe por file_key", () => {
    const items = buildParticipantContentItems(
      [{ id: "c1", title: "Guía", category: "Nutrición", file_key: "guides/plan.pdf" }],
      "guides/plan.pdf",
    );
    assert.equal(items.length, 1);
    assert.equal(items[0].id, "c1");
  });

  it("sin pdf de guía deja la biblioteca igual", () => {
    const library = [{ id: "c1", title: "A", category: "Sesiones" }];
    assert.deepEqual(buildParticipantContentItems(library, ""), library);
    assert.deepEqual(buildParticipantContentItems(library, null), library);
  });
});
