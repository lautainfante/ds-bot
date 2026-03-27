import { Track } from "../../../domain/entities/track";

export interface ResolvedTrackCollection {
  tracks: Track[];
  playlistTitle?: string;
}

export interface MusicSourceResolver {
  resolve(input: string, requestedBy: string): Promise<ResolvedTrackCollection>;
}

