import { GuildSettingsRepository } from "../../application/ports/repositories/guild-settings-repository";
import { GuildSubscriptionRepository } from "../../application/ports/repositories/guild-subscription-repository";
import { GuildAccessService } from "../../application/services/guild-access-service";
import { AppEnv } from "../../config/env";
import { PlaybackPanelService } from "./playback-panel-service";
import { GuildPlaybackManager } from "../music/guild-playback-manager";

export interface CommandContext {
  env: AppEnv;
  accessService: GuildAccessService;
  playbackManager: GuildPlaybackManager;
  playbackPanelService: PlaybackPanelService;
  guildSettingsRepository: GuildSettingsRepository;
  subscriptionRepository: GuildSubscriptionRepository;
}
