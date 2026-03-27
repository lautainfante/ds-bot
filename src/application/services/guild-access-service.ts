import { GuildSubscriptionRepository } from "../ports/repositories/guild-subscription-repository";
import { PlanTier } from "../../domain/enums/plan-tier";
import { FeaturePolicy, PremiumCapability } from "../../domain/services/feature-policy";

export class GuildAccessService {
  constructor(
    private readonly subscriptionRepository: GuildSubscriptionRepository,
    private readonly featurePolicy: FeaturePolicy
  ) {}

  async getPlan(guildId: string): Promise<PlanTier> {
    return this.subscriptionRepository.getPlan(guildId);
  }

  async ensureCapability(
    guildId: string,
    capability: PremiumCapability,
    upgradeUrl?: string
  ): Promise<void> {
    const tier = await this.getPlan(guildId);
    this.featurePolicy.ensureCapability(tier, capability, upgradeUrl);
  }
}

