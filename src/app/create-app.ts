import { generateDependencyReport } from "@discordjs/voice";
import { Client, GatewayIntentBits } from "discord.js";
import { GuildAccessService } from "../application/services/guild-access-service";
import { loadEnv } from "../config/env";
import { FeaturePolicy } from "../domain/services/feature-policy";
import { buildCommands } from "../infrastructure/discord/commands";
import { DiscordBot } from "../infrastructure/discord/discord-bot";
import { createPlaybackButtonHandler } from "../infrastructure/discord/playback-button-handler";
import { PlaybackPanelService } from "../infrastructure/discord/playback-panel-service";
import { GuildPlaybackManager } from "../infrastructure/music/guild-playback-manager";
import { createMusicSourceResolver } from "../infrastructure/music/music-source-resolver-factory";
import { PlayDlTrackAudioFactory } from "../infrastructure/music/play-dl-track-audio-factory";
import { InMemoryGuildSettingsRepository } from "../infrastructure/repositories/in-memory-guild-settings-repository";
import { InMemoryGuildSubscriptionRepository } from "../infrastructure/repositories/in-memory-guild-subscription-repository";
import { createLogger } from "../shared/logger";

export async function createApp(): Promise<DiscordBot> {
  const env = loadEnv();
  const logger = createLogger();
  logger.info("yt-dlp runtime configuration", {
    path: env.ytDlpPath ?? "/usr/local/bin/yt-dlp",
    cookies: env.ytDlpCookiesPath ? "path" : env.ytDlpCookiesBase64 ? "base64" : "none"
  });
  logger.info("Voice dependency report", {
    report: generateDependencyReport()
  });

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildVoiceStates
    ]
  });

  const guildSettingsRepository = new InMemoryGuildSettingsRepository();
  const subscriptionRepository = new InMemoryGuildSubscriptionRepository(env.premiumGuildIds);
  const accessService = new GuildAccessService(subscriptionRepository, new FeaturePolicy());
  const playbackManager = new GuildPlaybackManager(
    guildSettingsRepository,
    createMusicSourceResolver(env),
    new PlayDlTrackAudioFactory(),
    logger
  );
  const playbackPanelService = new PlaybackPanelService(
    client,
    playbackManager,
    accessService,
    guildSettingsRepository,
    logger
  );

  const commandContext = {
    env,
    accessService,
    playbackManager,
    playbackPanelService,
    guildSettingsRepository,
    subscriptionRepository
  };
  const commands = buildCommands(commandContext);
  const buttonHandlers = [
    createPlaybackButtonHandler(commandContext)
  ];

  return new DiscordBot(client, commands, buttonHandlers, env, logger);
}
