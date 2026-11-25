import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  PROGRAM_TYPES,
  filterPeopleByProgramType,
  normalizeProgramType,
  programDurationLabel,
  programTypeLabel,
  validateProgramType,
} from "../app/program-types.ts";
import { filterPeopleByStatus } from "../app/participant-status.ts";

const app = readFileSync(new URL("../app/functional-app.tsx", import.meta.url), "utf8");
const restored = readFileSync(new URL("../app/restored-panels.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

const ids = (rows) => rows.map((row) => row.id);

const people = [
  { id: "noventa", status: "active", program_type: "90_days" },
  { id: "personalizado", status: "active", program_type: "custom", program_duration_days: 120 },
  { id: "otro", status: "finished", program_type: "other", program_type_label: "Mantención" },
];

/** Extrae el cuerpo fuente de una función del archivo (hasta la siguiente función). */
function functionBlock(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `no existe la función ${name}`);
  const end = source.indexOf("\nfunction ", start + 1);
  return source.slice(start, end < 0 ? undefined : end);
}

describe("PROGRAM_TYPES", () => {
  it("expone los tres tipos configurables en orden", () => {
    assert.deepEqual(
      PROGRAM_TYPES.map((item) => item.value),
      ["90_days", "custom", "other"],
    );
    assert.deepEqual(
      PROGRAM_TYPES.map((item) => item.label),
      ["90 días", "Personalizado", "Otro"],
    );
  });
});

describe("programTypeLabel", () => {
  it("traduce los tres tipos", () => {
    assert.equal(programTypeLabel({ program_type: "90_days" }), "90 días");
    assert.equal(programTypeLabel({ program_type: "custom" }), "Personalizado");
    assert.equal(programTypeLabel({ program_type: "other" }), "Otro");
  });

  it("usa la etiqueta libre cuando el tipo es other", () => {
    assert.equal(
      programTypeLabel({ program_type: "other", program_type_label: "Mantención" }),
      "Mantención",
    );
  });

  it("conserva el valor crudo si el tipo es desconocido y asume 90 días sin dato", () => {
    assert.equal(programTypeLabel({ program_type: "legacy_plan" }), "legacy_plan");
    assert.equal(programTypeLabel({}), "90 días");
    assert.equal(normalizeProgramType("  "), "90_days");
  });
});

describe("programDurationLabel", () => {
  it("muestra 90 días fijos, la duración personalizada o un guion", () => {
    assert.equal(programDurationLabel({ program_type: "90_days", program_duration_days: 120 }), "90 días");
    assert.equal(programDurationLabel({ program_type: "custom", program_duration_days: 120 }), "120 días");
    assert.equal(programDurationLabel({ program_type: "custom" }), "—");
    assert.equal(programDurationLabel({ program_type: "other", program_duration_days: 45 }), "45 días");
    assert.equal(programDurationLabel({ program_type: "other" }), "—");
  });
});

describe("validateProgramType", () => {
  it("acepta un personalizado de 120 días", () => {
    const result = validateProgramType({ type: "custom", durationDays: "120" });
    assert.equal(result.ok, true);
    assert.equal(result.durationDays, 120);
  });

  it("rechaza un personalizado fuera de 7–365 días", () => {
    const result = validateProgramType({ type: "custom", durationDays: 6 });
    assert.equal(result.ok, false);
    assert.match(result.error, /7 y 365/);
  });

  it("rechaza un personalizado sin duración", () => {
    const result = validateProgramType({ type: "custom" });
    assert.equal(result.ok, false);
    assert.match(result.error, /duración/i);
  });

  it("exige etiqueta cuando el tipo es other", () => {
    const result = validateProgramType({ type: "other", label: "   " });
    assert.equal(result.ok, false);
    assert.match(result.error, /etiqueta/i);
  });

  it("acepta other con etiqueta y sin duración propia", () => {
    const result = validateProgramType({ type: "other", label: " Mantención " });
    assert.equal(result.ok, true);
    assert.equal(result.durationDays, null);
    assert.equal(result.programTypeLabel, "Mantención");
  });

  it("limpia la duración cuando el tipo es 90_days", () => {
    const result = validateProgramType({ type: "90_days", durationDays: 120 });
    assert.equal(result.ok, true);
    assert.equal(result.durationDays, null);
  });
});

describe("filterPeopleByProgramType", () => {
  it("filtra cada tipo y devuelve todas con all", () => {
    assert.deepEqual(ids(filterPeopleByProgramType(people, "all")), ids(people));
    assert.deepEqual(ids(filterPeopleByProgramType(people, "90_days")), ["noventa"]);
    assert.deepEqual(ids(filterPeopleByProgramType(people, "custom")), ["personalizado"]);
    assert.deepEqual(ids(filterPeopleByProgramType(people, "other")), ["otro"]);
  });

  it("trata las filas sin program_type como 90 días", () => {
    assert.deepEqual(ids(filterPeopleByProgramType([{ id: "antiguo" }], "90_days")), ["antiguo"]);
  });

  it("se combina con el filtro de estado sin mutar las filas", () => {
    const copia = [...people];
    assert.deepEqual(
      ids(filterPeopleByProgramType(filterPeopleByStatus(people, "active"), "custom")),
      ["personalizado"],
    );
    assert.deepEqual(
      ids(filterPeopleByProgramType(filterPeopleByStatus(people, "active"), "other")),
      [],
    );
    assert.deepEqual(people, copia);
  });
});

describe("tabla de Participantes", () => {
  it("muestra la columna Programa con tipo y duración", () => {
    assert.match(restored, /<th>Programa<\/th>/);
    assert.match(restored, /program-type-badge/);
    assert.match(restored, /programTypeLabel\(p\)/);
    assert.match(restored, /programDurationLabel\(p\)/);
  });

  it("agrega la barra de filtro por tipo con conteos", () => {
    assert.match(restored, /className="status-filter program-type-filter"/);
    assert.match(restored, /\["90_days","90 días"\]/);
    assert.match(restored, /\["custom","Personalizados"\]/);
    assert.match(restored, /programTypeCounts\[key as keyof typeof programTypeCounts\]/);
  });

  it("combina el filtro de tipo con el de estado", () => {
    assert.match(
      restored,
      /filterPeopleByProgramType\(filterPeopleByStatus\(rows,statusFilter\),programTypeFilter\)/,
    );
  });

  it("abre el diálogo propio y llama a participant.program_type.set", () => {
    assert.match(restored, /Cambiar tipo de programa/);
    assert.match(restored, /participant\.program_type\.set/);
    assert.match(restored, /programType:type,programDurationDays:check\.durationDays\?\?null,programTypeLabel:check\.programTypeLabel\|\|""/);
    assert.match(restored, /aria-modal="true"/);
    assert.doesNotMatch(restored, /window\.prompt/);
  });

  it("oculta la conversión para nutricionista y en modo revisor", () => {
    assert.match(restored, /canChangeProgramType/);
    assert.match(app, /canChangeProgramType=\{!readOnly\}/);
    assert.match(app, /canChangeProgramType=\{!nutrition\}/);
  });
});

describe("alta y edición de participante", () => {
  const fields = functionBlock(app, "Fields");
  const programFields = functionBlock(app, "ProgramTypeFields");

  it("incluye la sección Tipo de programa después de los campos existentes", () => {
    assert.match(programFields, /TIPO DE PROGRAMA/);
    assert.match(programFields, /n="programType"/);
    assert.match(programFields, /n="programDurationDays"/);
    assert.match(programFields, /n="programTypeLabel"/);
    assert.ok(
      fields.indexOf('<Area n="motivation"') < fields.indexOf("<ProgramTypeFields context={context}/>"),
      "la sección de programa debe ir después de motivación",
    );
  });

  it("valida y normaliza el payload antes de crear o actualizar", () => {
    assert.match(app, /validateProgramType\(\{type:values\.programType,durationDays:values\.programDurationDays,label:values\.programTypeLabel\}\)/);
    assert.match(app, /values\.programType=normalizeProgramType\(values\.programType\)/);
    assert.match(app, /values\.programDurationDays=program\.durationDays\?\?null/);
    assert.match(app, /values\.programTypeLabel=program\.programTypeLabel\|\|""/);
  });

  it("el Select de Estado sigue intacto (regresión overflow-estado-labels)", () => {
    assert.match(
      app,
      /Select n="status" l="Estado"[^>]*opts=\{\["invited","onboarding","review","configuration","active","finished"\]\} labels=\{\["Invitado","Primer ingreso","En revisión","En configuración","Activo","Finalizado"\]\}/,
    );
  });
});

describe("CSV y estilos", () => {
  it("el CSV sigue exportando todas las filas y no la lista filtrada", () => {
    assert.match(restored, /downloadSummaryCsv\(rows\)/);
    assert.doesNotMatch(restored, /downloadSummaryCsv\(filteredRows\)/);
    assert.doesNotMatch(restored, /participantSummaryCsv\(filteredRows\)/);
  });

  it("define los estilos mínimos del badge, filtro y diálogo", () => {
    assert.match(css, /\.program-type-badge\{/);
    assert.match(css, /\.program-type-filter\{/);
    assert.match(css, /\.program-type-dialog\{/);
  });
});
