import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
  isStaffPanelRequest,
  myWeekPanelPath,
  myWeeksPanelPath,
  studentSelfRequestUrls,
  studentSelfUnavailable,
} from "../app/weekly-panel/studentSelfWeek.ts";

describe("ficha semanal del alumno", () => {
  it("solo arma /me/weeks y /me/week", () => {
    assert.equal(myWeeksPanelPath(), "/me/weeks");
    assert.equal(myWeekPanelPath("2026-11-09"), "/me/week?week=2026-11-09");
    const urls = studentSelfRequestUrls("2026-11-09");
    assert.deepEqual(urls, [
      "/api/p90/panel/me/weeks",
      "/api/p90/panel/me/week?week=2026-11-09",
    ]);
    for (const url of urls) assert.equal(isStaffPanelRequest(url), false);
  });

  it("reconoce endpoints de staff que el alumno no debe llamar", () => {
    const banned = [
      "/api/p90/panel/weeks",
      "/api/p90/panel/week?week_start=2026-11-09",
      "/api/p90/panel/participants/12/week?week_start=2026-11-09",
      "/api/p90/panel/participants/12/analysis?week_start=2026-11-09",
      "/api/p90/panel/participants/12/comments",
    ];
    for (const url of banned) assert.equal(isStaffPanelRequest(url), true, url);
  });

  it("oculta la sección ante 403 y 404", () => {
    assert.equal(studentSelfUnavailable(403), true);
    assert.equal(studentSelfUnavailable(404), true);
    assert.equal(studentSelfUnavailable(500), false);
    assert.equal(studentSelfUnavailable(200), false);
  });

  it("la vista no referencia clientes de staff ni cuadros de admin", () => {
    const src = readFileSync(new URL("../app/weekly-panel/StudentSelfWeek.tsx", import.meta.url), "utf8");
    const banned = [
      "fetchStudentWeek",
      "fetchAnalysis",
      "fetchComments",
      "fetchWeeks(",
      "fetchWeek(",
      "FeedbackBox",
      "AnalysisPanel",
      "HabitPlanEditor",
      "MacroTargetsEditor",
      "/participants/",
      "/analysis",
      "/comments",
    ];
    for (const token of banned) assert.equal(src.includes(token), false, token);
    assert.equal(src.includes("fetchMyWeeks"), true);
    assert.equal(src.includes("fetchMyWeek"), true);
  });
});
