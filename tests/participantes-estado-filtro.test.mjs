import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  STATUS_LABELS,
  filterPeopleByStatus,
  statusLabel,
} from "../app/participant-status.ts";

const people = [
  { id: "activo", status: "active" },
  { id: "finalizado", status: "finished" },
  { id: "pausado", status: "paused" },
  { id: "invitado", status: "invited" },
  { id: "ingreso", status: "onboarding" },
  { id: "revision", status: "review" },
  { id: "configuracion", status: "configuration" },
  { id: "desconocido", status: "ARCHIVED" },
  { id: "sin-estado" },
];

const ids = (rows) => rows.map((row) => row.id);

describe("statusLabel", () => {
  it("traduce los siete estados del programa a es-CL, incluido pausado", () => {
    assert.equal(statusLabel("invited"), "Invitado");
    assert.equal(statusLabel("onboarding"), "Primer ingreso");
    assert.equal(statusLabel("review"), "En revisión");
    assert.equal(statusLabel("configuration"), "En configuración");
    assert.equal(statusLabel("active"), "Activo");
    assert.equal(statusLabel("finished"), "Finalizado");
    assert.equal(statusLabel("paused"), "Pausado");
  });

  it("mantiene el valor crudo cuando el estado es desconocido", () => {
    assert.equal(statusLabel("ARCHIVED"), "ARCHIVED");
  });

  it("replica las etiquetas que ya usa el editor de participantes", () => {
    assert.deepEqual(Object.keys(STATUS_LABELS).sort(), [
      "active",
      "configuration",
      "finished",
      "invited",
      "onboarding",
      "paused",
      "review",
    ]);
  });
});

describe("filterPeopleByStatus", () => {
  it("sin filtro explícito deja solo activos", () => {
    assert.deepEqual(ids(filterPeopleByStatus(people)), ["activo"]);
  });

  it("all no filtra y devuelve todas las filas", () => {
    assert.deepEqual(ids(filterPeopleByStatus(people, "all")), ids(people));
  });

  it("active solo deja activos", () => {
    assert.deepEqual(ids(filterPeopleByStatus(people, "active")), ["activo"]);
  });

  it("paused solo deja pausados", () => {
    assert.deepEqual(ids(filterPeopleByStatus(people, "paused")), ["pausado"]);
  });

  it("finished solo deja finalizados", () => {
    assert.deepEqual(ids(filterPeopleByStatus(people, "finished")), ["finalizado"]);
  });

  it("other agrupa pausados, invitados, onboarding, revisión, configuración, desconocidos y sin estado", () => {
    assert.deepEqual(ids(filterPeopleByStatus(people, "other")), [
      "pausado",
      "invitado",
      "ingreso",
      "revision",
      "configuracion",
      "desconocido",
      "sin-estado",
    ]);
  });

  it("no muta el array recibido", () => {
    const copia = [...people];
    filterPeopleByStatus(people, "other");
    assert.deepEqual(people, copia);
  });
});

describe("tabla de Participantes", () => {
  const restored = readFileSync(
    new URL("../app/restored-panels.tsx", import.meta.url),
    "utf8",
  );

  it("agrega la columna Estado y arranca el filtro en activos", () => {
    assert.match(restored, /<th>Estado<\/th>/);
    assert.match(restored, /useState<StatusFilter>\("active"\)/);
    assert.match(restored, /filterPeopleByStatus\(rows,statusFilter\)/);
    assert.match(restored, /statusLabel\(p\.status\|\|"invited"\)/);
  });

  it("el CSV sigue recibiendo todas las filas y no la lista filtrada por estado", () => {
    assert.match(restored, /downloadSummaryCsv\(rows\)/);
    assert.doesNotMatch(restored, /downloadSummaryCsv\(filteredRows\)/);
    assert.doesNotMatch(restored, /participantSummaryCsv\(filteredRows\)/);
  });

  it("deja un estado vacío con «Ver todos» cuando el filtro no deja filas", () => {
    assert.match(restored, /No hay participantes en este estado/);
    assert.match(restored, /setStatusFilter\("all"\)/);
  });
});
