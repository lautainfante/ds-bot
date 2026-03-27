import test from "node:test";
import assert from "node:assert/strict";
import { FeaturePolicy } from "./feature-policy";
import { PlanTier } from "../enums/plan-tier";

test("free guilds cannot use premium controls", () => {
  const policy = new FeaturePolicy();

  assert.equal(policy.canUseCapability(PlanTier.FREE, "volume"), false);
  assert.equal(policy.canUseCapability(PlanTier.FREE, "bass"), false);
  assert.equal(policy.canUseCapability(PlanTier.FREE, "nightcore"), false);
});

test("premium guilds can use premium controls", () => {
  const policy = new FeaturePolicy();

  assert.equal(policy.canUseCapability(PlanTier.PREMIUM, "volume"), true);
  assert.equal(policy.canUseCapability(PlanTier.PREMIUM, "bass"), true);
  assert.equal(policy.canUseCapability(PlanTier.PREMIUM, "nightcore"), true);
});

