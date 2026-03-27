import { FeatureAccessError } from "../../domain/errors/feature-access-error";
import { PlanTier } from "../../domain/enums/plan-tier";
import { CommandContext } from "./command-context";

export type GuildLanguage = "es" | "en";

export const DEFAULT_GUILD_LANGUAGE: GuildLanguage = "es";

export function normalizeGuildLanguage(value?: string): GuildLanguage {
  return value === "en" ? "en" : DEFAULT_GUILD_LANGUAGE;
}

export async function resolveGuildLanguage(
  context: CommandContext,
  guildId?: string
): Promise<GuildLanguage> {
  if (!guildId) {
    return DEFAULT_GUILD_LANGUAGE;
  }

  const settings = await context.guildSettingsRepository.getByGuildId(guildId);
  return normalizeGuildLanguage(settings.language);
}

export function guildOnlyText(language: GuildLanguage): string {
  return language === "en"
    ? "This command only works inside a server."
    : "Este comando solo funciona dentro de un servidor.";
}

export function planLabel(plan: PlanTier, language: GuildLanguage): string {
  if (language === "en") {
    return plan === PlanTier.PREMIUM ? "Premium" : "Free";
  }

  return plan === PlanTier.PREMIUM ? "Premium" : "Free";
}

export function languageLabel(language: GuildLanguage, target: GuildLanguage): string {
  if (target === "en") {
    return language === "en" ? "English" : "Ingles";
  }

  return language === "en" ? "Spanish" : "Espanol";
}

export function premiumErrorMessage(
  language: GuildLanguage,
  error: FeatureAccessError
): string {
  const feature = featureLabel(language, error.featureName);

  if (language === "en") {
    return error.upgradeUrl
      ? `${feature} is a premium feature. Upgrade: ${error.upgradeUrl}`
      : `${feature} is a premium feature.`;
  }

  return error.upgradeUrl
    ? `La configuracion de ${feature} es premium. Upgrade: ${error.upgradeUrl}`
    : `La configuracion de ${feature} es premium.`;
}

export function featureLabel(
  language: GuildLanguage,
  feature: string
): string {
  if (language === "en") {
    switch (feature) {
      case "bass":
        return "bass boost";
      case "nightcore":
        return "nightcore";
      default:
        return "volume";
    }
  }

  switch (feature) {
    case "bass":
      return "bass boost";
    case "nightcore":
      return "nightcore";
    default:
      return "volumen";
  }
}
