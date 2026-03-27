import { GuildSubscriptionRepository } from "../../application/ports/repositories/guild-subscription-repository";
import { PlanTier } from "../../domain/enums/plan-tier";

export class InMemoryGuildSubscriptionRepository implements GuildSubscriptionRepository {
  private readonly plans = new Map<string, PlanTier>();

  constructor(seedPremiumGuildIds: string[]) {
    for (const guildId of seedPremiumGuildIds) {
      this.plans.set(guildId, PlanTier.PREMIUM);
    }
  }

  async getPlan(guildId: string): Promise<PlanTier> {
    return this.plans.get(guildId) ?? PlanTier.FREE;
  }

  async setPlan(guildId: string, plan: PlanTier): Promise<void> {
    this.plans.set(guildId, plan);
  }
}
