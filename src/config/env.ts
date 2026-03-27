import dotenv from "dotenv";

dotenv.config();

export interface AppEnv {
  discordToken: string;
  discordClientId: string;
  discordGuildId?: string;
  discordOwnerId?: string;
  premiumPortalUrl?: string;
  premiumGuildIds: string[];
  registerCommandsOnStart: boolean;
  youtubeApiKey?: string;
}

export function loadEnv(): AppEnv {
  const discordToken = requireEnv("DISCORD_TOKEN");
  const discordClientId = requireEnv("DISCORD_CLIENT_ID");

  return {
    discordToken,
    discordClientId,
    discordGuildId: optionalEnv("DISCORD_GUILD_ID"),
    discordOwnerId: optionalEnv("DISCORD_OWNER_ID"),
    premiumPortalUrl: optionalEnv("PREMIUM_PORTAL_URL"),
    premiumGuildIds: optionalEnv("PREMIUM_GUILD_IDS")
      ?.split(",")
      .map((guildId) => guildId.trim())
      .filter(Boolean) ?? [],
    registerCommandsOnStart: optionalEnv("REGISTER_COMMANDS_ON_START") !== "false",
    youtubeApiKey: optionalEnv("YOUTUBE_API_KEY")
  };
}

function requireEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function optionalEnv(name: string): string | undefined {
  const value = process.env[name];
  return value && value.trim().length > 0 ? value.trim() : undefined;
}
