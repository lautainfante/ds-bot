import { PlanTier } from "../../../domain/enums/plan-tier";

export interface GuildSubscriptionRepository {
  getPlan(guildId: string): Promise<PlanTier>;
  setPlan(guildId: string, plan: PlanTier): Promise<void>;
}

