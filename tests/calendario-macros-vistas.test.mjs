import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";

const panel = readFileSync(new URL("../app/adherence-panel.tsx", import.meta.url), "utf8");
const student = readFileSync(new URL("../app/participant-adherence.tsx", import.meta.url), "utf8");
const functional = readFileSync(new URL("../app/functional-app.tsx", import.meta.url), "utf8");
const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf8");

describe("staff: matriz de adherencia en modo macros (#65)", () => {
  it("pinta el % diario con el umbral del calendario de macros", () => {
    assert.ok(panel.includes("macroCalendarLabel"));
    assert.ok(panel.includes("macroCalendarTone"));
    assert.ok(panel.includes("<MacroPctLegend />"));
    assert.ok(panel.includes("macroPctMap("));
  });

  it("la rama de macros no pinta ✓ ni ×", () => {
    const start = panel.indexOf("const cellText =");
    const end = panel.indexOf(': status === "met"', start);
    assert.ok(start > 0 && end > start);
    const macroBranch = panel.slice(start, end);
    assert.ok(macroBranch.includes("macroCalendarLabel(macroPct)"));
    assert.ok(!macroBranch.includes("✓"));
    assert.ok(!macroBranch.includes("×"));
  });

  it("mantiene «·» sin registro, el title con % y la clase with-pct", () => {
    assert.match(panel, /macroPct != null\s*\?\s*macroCalendarLabel\(macroPct\)\s*:\s*"·"/);
    assert.ok(panel.includes("`Macros ${macroCalendarLabel(macroPct)}`"));
    assert.ok(panel.includes('"Sin registro"'));
    assert.ok(panel.includes("with-pct"));
    assert.ok(css.includes(".habit-cell.with-pct{font-size:10px;font-weight:800}"));
  });

  it("monta la leyenda solo en el tab de macros, antes del footnote", () => {
    assert.ok(panel.includes('{habit === "macros" && <MacroPctLegend />}'));
    assert.ok(
      panel.indexOf('{habit === "macros" && <MacroPctLegend />}') <
        panel.indexOf('className="adherence-footnote"'),
    );
  });
});

describe("alumno: calendario mensual de macros (#78)", () => {
  const start = student.indexOf("participant-macro-calendar");
  const end = student.indexOf("</section>", start);
  const block = student.slice(start, end);

  it("monta MonthNav + HabitMonthCalendar con % y leyenda", () => {
    assert.ok(start > 0 && end > start);
    assert.ok(block.includes("<MonthNav"));
    assert.ok(block.includes("<HabitMonthCalendar"));
    assert.ok(block.includes('habitLabel="macros"'));
    assert.ok(block.includes("percents={macroCalendarPct}"));
    assert.ok(block.includes("<MacroPctLegend />"));
    assert.ok(block.includes("Tu cumplimiento de macros día por día"));
  });

  it("calcula el % solo con los registros y el plan del alumno", () => {
    const memoStart = student.indexOf("const macroCalendarPct = useMemo");
    const memoEnd = student.indexOf("}, [nutritionRecords, plan, panelConfig]);", memoStart);
    assert.ok(memoStart > 0 && memoEnd > memoStart);
    const memo = student.slice(memoStart, memoEnd);
    assert.ok(memo.includes("nutritionRecords"));
    assert.ok(memo.includes("plan?.calories"));
    assert.ok(memo.includes("macroPctForDay("));
    assert.ok(!block.includes("people"));
  });

  it("no toca la matriz semanal existente", () => {
    assert.ok(student.includes('className={`participant-habit-cell ${status} ${pct != null ? "with-pct" : ""}`}'));
    assert.ok(student.includes("formatMacroDayPct(pct, 0)"));
  });
});

describe("functional-app.tsx sigue intacto en sus literales frágiles", () => {
  it("conserva los dos call sites de NutritionWorkspace", () => {
    assert.match(functional, /screen==="Nutrición"\)return <NutritionWorkspace people=\{people\} open=\{open\}\/>/);
    assert.match(
      functional,
      /screen==="Nutrición"\)return <NutritionWorkspace people=\{people\} open=\{open\} profileModal="professional-student"\/>/,
    );
  });

  it("conserva las métricas del dashboard y la PeopleTable", () => {
    assert.ok(functional.includes('<Metric label="Participantes" value={String(people.length)} note="Registrados"/>'));
    assert.ok(functional.includes("<PeopleTable rows={people.slice(0,6)} selected={[]} setSelected={()=>{}} open={open} readOnly={readOnly}/>"));
  });
});
