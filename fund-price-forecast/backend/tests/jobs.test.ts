import assert from "node:assert/strict";
import test from "node:test";

import { resolveTargetBusinessDate } from "../src/jobs.js";

test("resolveTargetBusinessDate prefers same-day TTM date when newer than official NAV", () => {
  assert.equal(
    resolveTargetBusinessDate("2026-04-28", null, "2026-04-29"),
    "2026-04-29",
  );
});

test("resolveTargetBusinessDate falls back to next day when no newer TTM exists", () => {
  assert.equal(
    resolveTargetBusinessDate("2026-04-28", null, "2026-04-28"),
    "2026-04-29",
  );
  assert.equal(
    resolveTargetBusinessDate("2026-04-28", null, null),
    "2026-04-29",
  );
});

test("resolveTargetBusinessDate advances with newer S&P trade dates when FX is missing", () => {
  assert.equal(
    resolveTargetBusinessDate("2026-05-01", "2026-05-04", null),
    "2026-05-05",
  );
});

test("resolveTargetBusinessDate picks the furthest available source date", () => {
  assert.equal(
    resolveTargetBusinessDate("2026-05-01", "2026-05-04", "2026-05-02"),
    "2026-05-05",
  );
});
