import test from "node:test";
import assert from "node:assert/strict";

import {
  circleIntersectsGate,
  clamp,
  createGatePattern,
  formatScore,
  rectangleOverlap,
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

test("rectangle overlap accounts for a collision inset", () => {
  const a = { x: 0, y: 0, width: 20, height: 20 };
  const b = { x: 18, y: 0, width: 20, height: 20 };
  assert.equal(rectangleOverlap(a, b), true);
  assert.equal(rectangleOverlap(a, b, 2), false);
});

test("gate patterns use continuous positions instead of fixed lanes", () => {
  const sequence = [0.5, 0.73];
  const result = createGatePattern(0.5, null, () => sequence.shift());
  assert.ok(result.center > 0.5);
  assert.ok(result.center < 0.8);
  assert.ok(result.width > 0.34);
  assert.ok(result.width < 0.38);
});

test("successive gates limit movement to a reachable horizontal shift", () => {
  const result = createGatePattern(0, 0.2, () => 1);
  assert.ok(result.center <= 0.54);
  assert.ok(result.center >= result.width / 2);
});

test("a core inside a gate opening is safe", () => {
  const core = { x: 100, y: 200, radius: 16 };
  const gate = { y: 200, gapLeft: 75, gapRight: 125, thickness: 14 };
  assert.equal(circleIntersectsGate(core, gate), false);
});

test("a core touching the solid part of a gate collides", () => {
  const core = { x: 70, y: 200, radius: 16 };
  const gate = { y: 200, gapLeft: 75, gapRight: 125, thickness: 14 };
  assert.equal(circleIntersectsGate(core, gate), true);
});

test("a gate cannot collide before reaching the core vertically", () => {
  const core = { x: 30, y: 200, radius: 16 };
  const gate = { y: 100, gapLeft: 75, gapRight: 125, thickness: 14 };
  assert.equal(circleIntersectsGate(core, gate), false);
});

test("score formatting discards unsafe negative and fractional display values", () => {
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
