import { GuildSettingsRepository } from "../../application/ports/repositories/guild-settings-repository";
import {
  createDefaultGuildSettings,
  GuildSettings
} from "../../domain/entities/guild-settings";

export class InMemoryGuildSettingsRepository implements GuildSettingsRepository {
  private readonly storage = new Map<string, GuildSettings>();

  async getByGuildId(guildId: string): Promise<GuildSettings> {
    const existing = this.storage.get(guildId);

    if (existing) {
      return existing;
    }

    const created = createDefaultGuildSettings(guildId);
    this.storage.set(guildId, created);
    return created;
  }

  async save(settings: GuildSettings): Promise<void> {
    this.storage.set(settings.guildId, settings);
  }
}

