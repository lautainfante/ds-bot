import crypto from "node:crypto";
import {
  MusicSourceResolver,
  ResolvedTrackCollection
} from "../../application/ports/services/music-source-resolver";
import { Track, TrackSource } from "../../domain/entities/track";
import { UnsupportedSourceError } from "../../domain/errors/unsupported-source-error";
import { detectInputSource } from "./source-input";
import {
  getYouTubePlaylistDetails,
  getYouTubeVideoDetails,
  searchYouTubeVideo
} from "./youtube-innertube";
import {
  extractYouTubePlaylistId,
  extractYouTubeVideoId,
  isYouTubeMusicUrl,
  normalizeYouTubeUrl
} from "./youtube-url";

const YOUTUBE_SUPPORT_URL = "https://www.youtube.com";
type PreferredSource = "youtube" | "youtube_music";

export class YouTubeSourceResolver implements MusicSourceResolver {
  async resolve(input: string, requestedBy: string): Promise<ResolvedTrackCollection> {
    const detectedSource = detectInputSource(input);

    if (detectedSource === "soundcloud" || detectedSource === "spotify") {
      throw new UnsupportedSourceError(
        detectedSource,
        `Este bot esta configurado solo para YouTube. ${formatSourceName(detectedSource)} no esta habilitado.`,
        YOUTUBE_SUPPORT_URL
      );
    }

    const normalizedInput = normalizeYouTubeUrl(input);
    const preferredSource = resolvePreferredSource(input);

    if (extractYouTubePlaylistId(normalizedInput)) {
      const playlist = await getYouTubePlaylistDetails(normalizedInput, preferredSource);

      return {
        playlistTitle: playlist.title,
        tracks: playlist.tracks.map((track) =>
          toTrack(track, requestedBy, preferredSource)
        )
      };
    }

    if (extractYouTubeVideoId(normalizedInput)) {
      const track = await getYouTubeVideoDetails(normalizedInput, preferredSource);

      return {
        tracks: [toTrack(track, requestedBy, preferredSource)]
      };
    }

    const searchedTrack = await searchYouTubeVideo(normalizedInput);

    return {
      tracks: [toTrack(searchedTrack, requestedBy, preferredSource)]
    };
  }
}

function toTrack(
  track: {
    title: string;
    url: string;
    durationMs: number;
    thumbnailUrl?: string;
  },
  requestedBy: string,
  source: TrackSource
): Track {
  return {
    id: createTrackId(),
    title: track.title,
    url: track.url,
    audioUrl: track.url,
    source,
    durationMs: track.durationMs,
    thumbnailUrl: track.thumbnailUrl,
    requestedBy
  };
}

function resolvePreferredSource(input: string): PreferredSource {
  return isYouTubeMusicUrl(input) ? "youtube_music" : "youtube";
}

function createTrackId(): string {
  return crypto.randomUUID();
}

function formatSourceName(source: "soundcloud" | "spotify"): string {
  return source === "soundcloud" ? "SoundCloud" : "Spotify";
}
