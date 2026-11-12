import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isRenderableGuide, parseGuideContent } from "../app/guide-content.ts";
import {
  buildWorkoutDays,
  exercisePrescription,
  filterWorkoutsForProgram,
  resolveTrainingView,
} from "../app/training-view.ts";

const guideRow = (content) => ({ content_json: content });

describe("isRenderableGuide", () => {
  it("rechaza filas vacías o inválidas", () => {
    assert.equal(isRenderableGuide(undefined), false);
    assert.equal(isRenderableGuide({}), false);
    assert.equal(isRenderableGuide(guideRow("")), false);
    assert.equal(isRenderableGuide(guideRow("{no es json")), false);
    assert.equal(isRenderableGuide(guideRow("null")), false);
  });

  it("rechaza guías que parsean pero no tienen contenido", () => {
    const empty = JSON.stringify({ title: "X", overview: [], days: [], reference: [] });
    assert.equal(isRenderableGuide(guideRow(empty)), false);
    const emptyDays = JSON.stringify({ title: "X", overview: [], days: [{ title: "D1", nodes: [] }], reference: [] });
    assert.equal(isRenderableGuide(guideRow(emptyDays)), false);
  });

  it("acepta guías con overview, días o progresión", () => {
    const overview = JSON.stringify({ title: "X", overview: [{ type: "paragraph", text: "hola" }], days: [], reference: [] });
    assert.equal(isRenderableGuide(guideRow(overview)), true);
    const days = JSON.stringify({ title: "X", overview: [], days: [{ title: "D1", nodes: [{ type: "exercise", name: "S" }] }], reference: [] });
    assert.equal(isRenderableGuide(guideRow(days)), true);
    const ref = JSON.stringify({ title: "X", overview: [], days: [], reference: [{ type: "paragraph", text: "r" }] });
    assert.equal(isRenderableGuide(guideRow(ref)), true);
  });

  it("parseGuideContent normaliza arreglos faltantes", () => {
    const parsed = parseGuideContent(guideRow(JSON.stringify({ title: "X" })));
    assert.deepEqual(parsed.overview, []);
    assert.deepEqual(parsed.days, []);
    assert.deepEqual(parsed.reference, []);
  });
});

describe("filterWorkoutsForProgram", () => {
  const workouts = [
    { id: 1, program_id: 10, name: "A" },
    { id: 2, program_id: 20, name: "B" },
    { id: 3, name: "C" },
  ];

  it("devuelve todo sin programId", () => {
    assert.equal(filterWorkoutsForProgram(workouts, undefined).length, 3);
    assert.equal(filterWorkoutsForProgram(workouts, "").length, 3);
  });

  it("filtra por program_id cuando existe", () => {
    const only = filterWorkoutsForProgram(workouts, 10);
    assert.equal(only.length, 1);
    assert.equal(only[0].name, "A");
  });

  it("no filtra si ningún workout trae program_id", () => {
    const noProgram = [{ id: 1, name: "A" }];
    assert.equal(filterWorkoutsForProgram(noProgram, 10).length, 1);
  });
});

describe("buildWorkoutDays", () => {
  it("agrupa ejercicios por workout_id y conserva el orden", () => {
    const workouts = [{ id: 1, month: 1, week: 1, name: "Día fuerza" }, { id: 2, name: "Día movilidad" }];
    const links = [
      { id: "a", workout_id: 1, exercise_name: "Sentadilla" },
      { id: "b", workout_id: 2, exercise_name: "Plancha" },
      { id: "c", workout_id: 1, exercise_name: "Peso muerto" },
    ];
    const days = buildWorkoutDays(workouts, links);
    assert.equal(days.length, 2);
    assert.equal(days[0].name, "Día fuerza");
    assert.equal(days[0].exercises.length, 2);
    assert.equal(days[0].exercises[0].exercise_name, "Sentadilla");
    assert.equal(days[0].exercises[1].exercise_name, "Peso muerto");
    assert.equal(days[1].exercises.length, 1);
    assert.equal(days[0].month, 1);
  });

  it("usa title cuando name falta", () => {
    const days = buildWorkoutDays([{ id: 1, title: "Sesión X" }], []);
    assert.equal(days[0].name, "Sesión X");
  });
});

describe("exercisePrescription", () => {
  it("arma series, reps y descanso", () => {
    assert.equal(exercisePrescription({ sets: 3, reps: 12, rest_seconds: 60 }), "3 × 12 · 60s descanso");
  });

  it("usa duration cuando no hay reps", () => {
    assert.equal(exercisePrescription({ sets: 2, duration: "45s" }), "2 × 45s");
  });

  it("omite partes faltantes sin mostrar undefined", () => {
    assert.equal(exercisePrescription({ reps: 10 }), "10");
    assert.equal(exercisePrescription({ rest_seconds: 30 }), "30s descanso");
    assert.equal(exercisePrescription({}), "");
    assert.equal(exercisePrescription({ sets: "", reps: "", rest_seconds: "" }), "");
  });
});

describe("resolveTrainingView", () => {
  const validGuide = guideRow(JSON.stringify({
    title: "Base",
    overview: [],
    days: [{ title: "D1", nodes: [{ type: "exercise", name: "S" }] }],
    reference: [],
  }));
  const invalidGuide = guideRow("{rota");
  const workouts = [{ id: 1, program_id: 10, name: "Día 1" }];
  const links = [{ id: "a", workout_id: 1, exercise_name: "Sentadilla" }];

  it("guía válida -> guide con la guía principal", () => {
    const view = resolveTrainingView({ guideRow: validGuide, workouts, workoutExercises: links, programId: 10 });
    assert.equal(view.kind, "guide");
    assert.equal(view.primaryGuideRow, validGuide);
    assert.equal(view.emergencyGuideRow, undefined);
  });

  it("guía principal inválida pero emergencia válida -> guide de emergencia", () => {
    const view = resolveTrainingView({ guideRow: invalidGuide, emergencyGuideRow: validGuide, workouts, workoutExercises: links, programId: 10 });
    assert.equal(view.kind, "guide");
    assert.equal(view.primaryGuideRow, undefined);
    assert.equal(view.emergencyGuideRow, validGuide);
  });

  it("guía inválida + workouts -> workouts", () => {
    const view = resolveTrainingView({ guideRow: invalidGuide, workouts, workoutExercises: links, programId: 10 });
    assert.equal(view.kind, "workouts");
    assert.equal(view.days.length, 1);
    assert.equal(view.days[0].name, "Día 1");
  });

  it("sin guía + workouts -> workouts", () => {
    const view = resolveTrainingView({ workouts, workoutExercises: links, programId: 10 });
    assert.equal(view.kind, "workouts");
    assert.equal(view.days.length, 1);
    assert.equal(view.days[0].exercises[0].exercise_name, "Sentadilla");
  });

  it("sin guía + sin workouts -> empty", () => {
    const view = resolveTrainingView({ workouts: [], workoutExercises: [] });
    assert.equal(view.kind, "empty");
  });

  it("filtra workouts por programa", () => {
    const mixed = [{ id: 1, program_id: 10, name: "Mío" }, { id: 2, program_id: 99, name: "De otro" }];
    const view = resolveTrainingView({ workouts: mixed, workoutExercises: [], programId: 10 });
    assert.equal(view.kind, "workouts");
    assert.equal(view.days.length, 1);
    assert.equal(view.days[0].name, "Mío");
  });
});
