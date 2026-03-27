import { GuildLanguage, DEFAULT_GUILD_LANGUAGE } from "../../infrastructure/discord/i18n";

export interface GuildSettings {
  guildId: string;
  volume: number;
  bassBoost: number;
  nightcore: boolean;
  language: GuildLanguage;
}

export function createDefaultGuildSettings(guildId: string): GuildSettings {
  return {
    guildId,
    volume: 100,
    bassBoost: 0,
    nightcore: false,
    language: DEFAULT_GUILD_LANGUAGE
  };
}
