import test from "node:test";
import assert from "node:assert/strict";
import { threshold, rewardProgress, isAdmin } from "../lib/domain.ts";
test("Role thresholds and progress match membership rules", () => {
  assert.equal(threshold("membre"), 1200);
  assert.equal(threshold("benevole"), 2500);
  assert.equal(threshold("volontaire"), 2500);
  assert.equal(threshold("admin"), null);
  assert.equal(threshold("super_admin"), null);
  assert.equal(rewardProgress(1200, "membre"), 100);
  assert.equal(rewardProgress(1200, "benevole"), 48);
  assert.equal(rewardProgress(3000, "volontaire"), 100);
  assert.equal(rewardProgress(65, "admin"), null);
});
test("Only administrative grades unlock the administration UI", () => {
  assert.equal(isAdmin("membre"), false);
  assert.equal(isAdmin("benevole"), false);
  assert.equal(isAdmin("volontaire"), false);
  assert.equal(isAdmin("admin"), true);
  assert.equal(isAdmin("super_admin"), true);
});
