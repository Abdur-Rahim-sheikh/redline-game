import test from "node:test";
import assert from "node:assert/strict";

import {
  clamp,
  createBranchGap,
  ellipseIntersectsRectangle,
  formatScore,
  safeStorage,
  smoothTowards,
} from "../src/core.js";

test("clamp keeps a number inside the requested range", () => {
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(4, 0, 10), 4);
  assert.equal(clamp(99, 0, 10), 10);
});

test("smoothTowards approaches without overshooting", () => {
  const result = smoothTowards(0, 100, 12, 1 / 60);
  assert.ok(result > 0);
  assert.ok(result < 100);
});

test("branch gaps can appear at continuous vertical positions", () => {
  const sequence = [0.5, 0.72];
  const result = createBranchGap(0.5, null, () => sequence.shift());
  assert.ok(result.center > 0.5);
  assert.ok(result.center < 0.8);
  assert.ok(result.size > 0.23);
  assert.ok(result.size < 0.25);
});

test("successive gaps limit the vertical jump to a reachable shift", () => {
  const result = createBranchGap(0, 0.3, () => 1);
  assert.ok(result.center <= 0.47);
});

test("crow ellipse collides with a touching branch rectangle", () => {
  const crow = { x: 100, y: 100, radiusX: 20, radiusY: 14 };
  const branch = { x: 115, y: 90, width: 40, height: 40 };
  assert.equal(ellipseIntersectsRectangle(crow, branch), true);
});

test("crow ellipse remains safe away from a branch rectangle", () => {
  const crow = { x: 100, y: 100, radiusX: 20, radiusY: 14 };
  const branch = { x: 130, y: 90, width: 40, height: 40 };
  assert.equal(ellipseIntersectsRectangle(crow, branch), false);
});

test("score formatting discards negative and fractional display values", () => {
  assert.equal(formatScore(-5), "0");
  assert.equal(formatScore(1234.9), "1,234");
});

test("safe storage falls back when browser storage is unavailable", () => {
  const throwingStorage = {
    getItem() {
      throw new Error("blocked");
    },
    setItem() {
      throw new Error("blocked");
    },
  };
  const storage = safeStorage(throwingStorage);
  assert.equal(storage.get("score", "0"), "0");
  assert.equal(storage.set("score", "8"), false);
});
