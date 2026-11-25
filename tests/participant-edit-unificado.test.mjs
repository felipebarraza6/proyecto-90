import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const functional = readFileSync(new URL("../app/functional-app.tsx", import.meta.url), "utf8");
const restored = readFileSync(new URL("../app/restored-panels.tsx", import.meta.url), "utf8");

function sliceBetween(source, start, end, label) {
  const from = source.indexOf(start);
  assert.notEqual(from, -1, `No se encontró el inicio de ${label}`);
  const to = source.indexOf(end, from + start.length);
  assert.notEqual(to, -1, `No se encontró el final de ${label}`);
  return source.slice(from, to);
}

const fieldsSource = sliceBetween(functional, "function Fields(", "\nfunction Title(", "Fields");
const intakeViewSource = sliceBetween(functional, 'if(modal==="intake-view")return', "async function submit(", "intake-view");

describe("Participantes: un solo acceso de edición (#61)", () => {
  it("la tabla ya no ofrece el botón secundario «Editar datos»", () => {
    assert.ok(!restored.includes("Editar datos"));
    assert.ok(!restored.includes('open("participant-body"'));
    assert.ok(!restored.includes("participant-body"));
    assert.ok(!restored.includes("canEditBody"));
  });

  it("functional-app ya no declara el modal participant-body ni la prop canEditBody", () => {
    assert.ok(!functional.includes('"participant-body"'));
    assert.ok(!functional.includes("canEditBody"));
    assert.ok(!functional.includes('modal==="participant-body"'));
  });

  it("el formulario participant-edit monta el editor de datos corporales", () => {
    assert.ok(fieldsSource.includes('className="editor-subsection"'));
    assert.ok(fieldsSource.includes("<h3>Datos corporales</h3>"));
    assert.ok(
      fieldsSource.includes(
        "<BodyDataEditor person={context} questions={data.intakeQuestions||[]} act={act} startOpen panelConfig={panelConfig}/>",
      ),
    );
    assert.ok(!fieldsSource.includes("Se corrigen con «Editar datos»"));
  });

  it("la Ficha (intake-view) queda como vista de lectura sin editor de datos corporales", () => {
    assert.ok(intakeViewSource.includes("FICHA DEL ALUMNO"));
    assert.ok(!intakeViewSource.includes("BodyDataEditor"));
  });

  it("se conserva el borrado con confirmación (#62)", () => {
    assert.ok(restored.includes(">Eliminar</button>"));
    assert.ok(restored.includes('<ConfirmDialog open={pendingDelete!==null}'));
  });
});
