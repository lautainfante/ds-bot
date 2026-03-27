import { PlanTier } from "../enums/plan-tier";
import { FeatureAccessError } from "../errors/feature-access-error";

export type PremiumCapability = "volume" | "bass" | "nightcore";

export class FeaturePolicy {
  canUseCapability(tier: PlanTier, capability: PremiumCapability): boolean {
    if (tier === PlanTier.PREMIUM) {
      return true;
    }

    return false;
  }

  ensureCapability(
    tier: PlanTier,
    capability: PremiumCapability,
    upgradeUrl?: string
  ): void {
    if (!this.canUseCapability(tier, capability)) {
      throw new FeatureAccessError(capability, upgradeUrl);
    }
  }
}

