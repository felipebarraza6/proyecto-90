import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { panelConfigBlocksStaff, reviewerMutationBlocked } from "../app/staff-guards.ts";

describe("reviewerMutationBlocked", () => {
  it("bloquea solo al revisor", () => {
    assert.equal(reviewerMutationBlocked("reviewer"), true);
    assert.equal(reviewerMutationBlocked("admin"), false);
    assert.equal(reviewerMutationBlocked("professional"), false);
    assert.equal(reviewerMutationBlocked("participant"), false);
  });
});

describe("panelConfigBlocksStaff", () => {
  it("bloquea al staff cuando la config falló y no hay panel", () => {
    assert.equal(panelConfigBlocksStaff("admin", true, null), true);
    assert.equal(panelConfigBlocksStaff("professional", true, null), true);
    assert.equal(panelConfigBlocksStaff("reviewer", true, null), true);
  });

  it("no bloquea si la config cargó, el fallo no ocurrió, o el rol es alumno", () => {
    assert.equal(panelConfigBlocksStaff("admin", false, null), false);
    assert.equal(panelConfigBlocksStaff("admin", true, { panel: true }), false);
    assert.equal(panelConfigBlocksStaff("participant", true, null), false);
  });
});
