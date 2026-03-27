import { AudioResource } from "@discordjs/voice";
import { GuildSettings } from "../../../domain/entities/guild-settings";
import { Track } from "../../../domain/entities/track";

export interface TrackAudioFactory {
  create(track: Track, settings: GuildSettings): Promise<AudioResource<Track>>;
}

