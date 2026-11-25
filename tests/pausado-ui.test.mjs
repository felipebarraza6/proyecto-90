import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  STATUS_LABELS,
  filterPeopleByStatus,
  statusLabel,
} from "../app/participant-status.ts";

const app = readFileSync(new URL("../app/functional-app.tsx", import.meta.url), "utf8");
const restored = readFileSync(new URL("../app/restored-panels.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

const ids = (rows) => rows.map((row) => row.id);

const people = [
  { id: "activo", status: "active" },
  { id: "pausado-1", status: "paused" },
  { id: "pausado-2", status: "paused" },
  { id: "finalizado", status: "finished" },
  { id: "invitado", status: "invited" },
];

/** Extrae el cuerpo fuente de una función del archivo (hasta la siguiente función). */
function functionBlock(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `no existe la función ${name}`);
  const end = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, end < 0 ? undefined : end);
}

describe("estado pausado en participant-status", () => {
  it("expone la etiqueta «Pausado»", () => {
    assert.equal(STATUS_LABELS.paused, "Pausado");
    assert.equal(statusLabel("paused"), "Pausado");
    assert.equal(statusLabel(" PAUSED "), "Pausado");
  });

  it("filtra solo pausados con el filtro explícito", () => {
    assert.deepEqual(ids(filterPeopleByStatus(people, "paused")), [
      "pausado-1",
      "pausado-2",
    ]);
  });

  it("«other» también incluye a los pausados", () => {
    const other = ids(filterPeopleByStatus(people, "other"));
    assert.ok(other.includes("pausado-1"));
    assert.ok(other.includes("pausado-2"));
    assert.ok(!other.includes("activo"));
    assert.ok(!other.includes("finalizado"));
  });
});

describe("tabla de Participantes", () => {
  it("mantiene la columna Estado con el badge y el color de pausado", () => {
    assert.match(restored, /<th>Estado<\/th>/);
    assert.match(restored, /className=\{`status-badge \$\{/);
    assert.match(css, /\.status-badge\.paused\{[^}]*var\(--amber\)/);
  });

  it("agrega el filtro Pausados con su conteo", () => {
    assert.match(restored, /\["paused","Pausados"\]/);
    assert.match(restored, /paused:filterPeopleByStatus\(people,"paused"\)\.length/);
  });
});

describe("fichas de staff", () => {
  const notice = functionBlock(app, "PausedNotice");

  it("solo aparece cuando el estado es paused", () => {
    assert.match(notice, /\.toLowerCase\(\)!=="paused"/);
    assert.match(notice, /className="paused-notice"/);
  });

  it("usa motivo, fecha es-CL y quién aplicó la pausa sin inventar datos", () => {
    assert.match(notice, /paused_reason/);
    assert.match(notice, /paused_at/);
    assert.match(notice, /paused_by_email/);
    assert.match(app, /toLocaleDateString\("es-CL"/);
    assert.match(notice, /&&<p>/);
  });

  it("se muestra en la ficha del alumno y en la ficha profesional", () => {
    assert.match(app, /<PausedNotice person=\{context\}\/>/);
    assert.equal(app.match(/<PausedNotice person=\{context\}\/>/g).length, 2);
  });
});

describe("vista del alumno pausado", () => {
  const screen = functionBlock(app, "ParticipantPausedScreen");
  const paused = functionBlock(app, "participantPaused");

  it("reacciona al bloque paused del backend y al estado del perfil", () => {
    assert.match(paused, /data\.paused/);
    assert.match(paused, /profile\?\.status/);
    assert.match(paused, /info\?\.active/);
  });

  it("renderiza el mensaje, el motivo y la instrucción de contacto", () => {
    assert.match(screen, /className="paused-screen"/);
    assert.match(screen, /Tu programa está pausado/);
    assert.match(screen, /info\.reason/);
    assert.match(screen, /Escribe al equipo de Proyecto 90/);
  });

  it("corta la vista del alumno antes de rutinas, adherencia y formularios", () => {
    assert.ok(
      app.includes(
        "function ParticipantArea({data,screen,setScreen,act,panelConfig}:{data:AppData;screen:string;setScreen:(x:string)=>void;act:(r:Row)=>Promise<unknown>;panelConfig:PanelConfig|null}){if(participantPaused(data))return <ParticipantPausedScreen data={data}/>;",
      ),
    );
  });

  it("la pantalla pausada no menciona rutinas ni adherencia", () => {
    assert.doesNotMatch(screen, /rutina/i);
    assert.doesNotMatch(screen, /adherencia/i);
  });
});

describe("contrato de datos y regresiones", () => {
  it("AppData acepta el bloque paused del backend", () => {
    assert.match(
      app,
      /paused\?:\{active\?:boolean;reason\?:string;since\?:string\}/,
    );
  });

  it("el Select de Estado no cambia (regresión overflow-estado-labels)", () => {
    assert.match(
      app,
      /Select n="status" l="Estado"[^>]*opts=\{\["invited","onboarding","review","configuration","active","finished"\]\} labels=\{\["Invitado","Primer ingreso","En revisión","En configuración","Activo","Finalizado"\]\}/,
    );
  });

  it("guardar la ficha de un participante pausado conserva el estado", () => {
    assert.match(
      app,
      /modal==="participant-edit"&&String\(context\.status\|\|""\)\.trim\(\)\.toLowerCase\(\)==="paused"\)values\.status=String\(context\.status\)/,
    );
  });
});

describe("estilos de pausado", () => {
  it("aviso y pantalla usan ámbar", () => {
    assert.match(css, /\.paused-notice\{[^}]*border[^;}]*#5c4721/);
    assert.match(css, /\.paused-screen\{[^}]*text-align:center/);
  });
});
