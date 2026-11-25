import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { sortSessionsDesc } from "../app/session-order.ts";

const desordenadas = [
  { id: "media", starts_at: "2026-11-10T12:00:00Z" },
  { id: "reciente", starts_at: "2026-11-20T09:00:00Z" },
  { id: "antigua", starts_at: "2026-11-01T18:30:00Z" },
];

describe("sortSessionsDesc", () => {
  it("ordena de la más reciente a la más antigua por starts_at", () => {
    assert.deepEqual(
      sortSessionsDesc(desordenadas).map((row) => row.id),
      ["reciente", "media", "antigua"],
    );
  });

  it("no muta el array original ni el orden de sus filas", () => {
    const copia = [...desordenadas];
    const ordenadas = sortSessionsDesc(desordenadas);
    assert.notEqual(ordenadas, desordenadas);
    assert.deepEqual(desordenadas, copia);
    assert.deepEqual(desordenadas.map((row) => row.id), ["media", "reciente", "antigua"]);
  });

  it("deja al final las fechas inválidas o vacías conservando su orden relativo", () => {
    const filas = [
      { id: "sin-fecha" },
      { id: "antigua", starts_at: "2026-10-01T10:00:00Z" },
      { id: "vacia", starts_at: "" },
      { id: "reciente", starts_at: "2026-10-20T10:00:00Z" },
      { id: "basura", starts_at: "no-es-fecha" },
    ];
    assert.deepEqual(
      sortSessionsDesc(filas).map((row) => row.id),
      ["reciente", "antigua", "sin-fecha", "vacia", "basura"],
    );
  });

  it("acepta dateKey alternativo, por ejemplo requested_at", () => {
    const solicitudes = [
      { id: "a", requested_at: "2026-11-05T10:00:00Z", starts_at: "2026-11-30T10:00:00Z" },
      { id: "b", requested_at: "2026-11-15T10:00:00Z", starts_at: "2026-11-16T10:00:00Z" },
      { id: "c", requested_at: "2026-11-01T10:00:00Z", starts_at: "2026-12-01T10:00:00Z" },
    ];
    assert.deepEqual(
      sortSessionsDesc(solicitudes, "requested_at").map((row) => row.id),
      ["b", "a", "c"],
    );
  });

  it("compara timestamps reales aunque el formato ISO varíe", () => {
    const filas = [
      { id: "utc", starts_at: "2026-11-10T12:00:00Z" },
      { id: "offset", starts_at: "2026-11-10T09:30:00-03:00" },
    ];
    assert.deepEqual(
      sortSessionsDesc(filas).map((row) => row.id),
      // 09:30-03:00 = 12:30Z, más reciente que 12:00Z aunque el string sea menor.
      ["offset", "utc"],
    );
  });
});

describe("call sites usan sortSessionsDesc", () => {
  it("calendario general de restored-panels y sesiones de participant-week", () => {
    const restored = readFileSync(new URL("../app/restored-panels.tsx", import.meta.url), "utf8");
    const week = readFileSync(new URL("../app/participant-week.tsx", import.meta.url), "utf8");
    assert.match(restored, /sortSessionsDesc\(scoped\)/);
    assert.match(restored, /sortSessionsDesc\(meetings,"requested_at"\)/);
    assert.match(week, /sortSessionsDesc\(sessions\.filter/);
  });
});
