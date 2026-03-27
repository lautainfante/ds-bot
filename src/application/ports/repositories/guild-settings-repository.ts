import { GuildSettings } from "../../../domain/entities/guild-settings";

export interface GuildSettingsRepository {
  getByGuildId(guildId: string): Promise<GuildSettings>;
  save(settings: GuildSettings): Promise<void>;
}

