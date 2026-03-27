import crypto from "node:crypto";
import play from "play-dl";
import {
  MusicSourceResolver,
  ResolvedTrackCollection
} from "../../application/ports/services/music-source-resolver";
import { Track, TrackSource } from "../../domain/entities/track";
import { UnsupportedSourceError } from "../../domain/errors/unsupported-source-error";
import { detectInputSource } from "./source-input";

const YOUTUBE_SUPPORT_URL = "https://www.youtube.com";

export class PlayDlSourceResolver implements MusicSourceResolver {
  async resolve(input: string, requestedBy: string): Promise<ResolvedTrackCollection> {
    const detectedSource = detectInputSource(input);

    if (detectedSource === "soundcloud" || detectedSource === "spotify") {
      throw new UnsupportedSourceError(
        detectedSource,
        `Este bot esta configurado solo para YouTube. ${formatSourceName(detectedSource)} no esta habilitado.`,
        YOUTUBE_SUPPORT_URL
      );
    }

    const sourceHint = isMusicUrl(input);
    const normalizedInput = normalizeInput(input);
    const validation = await (play as any).validate(normalizedInput);

    switch (validation) {
      case "yt_video":
        return {
          tracks: [await this.resolveYouTubeVideo(normalizedInput, requestedBy, sourceHint)]
        };
      case "yt_playlist":
        return this.resolveYouTubePlaylist(normalizedInput, requestedBy, sourceHint);
      case "sc_track":
      case "sc_playlist":
      case "sc_set":
      case "sp_track":
      case "sp_album":
      case "sp_playlist":
        throw new UnsupportedSourceError(
          detectedSource === "search" ? "spotify" : detectedSource,
          "Este bot esta configurado solo para YouTube y YouTube Music.",
          YOUTUBE_SUPPORT_URL
        );
      default:
        return {
          tracks: [await this.resolveSearch(normalizedInput, requestedBy)]
        };
    }
  }

  private async resolveYouTubeVideo(
    url: string,
    requestedBy: string,
    isYouTubeMusic: boolean
  ): Promise<Track> {
    const info = await (play as any).video_info(url);
    const video = info.video_details;
    const source: TrackSource = isYouTubeMusic ? "youtube_music" : "youtube";

    return {
      id: createTrackId(),
      title: video.title,
      url,
      audioUrl: url,
      source,
      durationMs: Number(video.durationInSec ?? 0) * 1000,
      thumbnailUrl: video.thumbnails?.at(-1)?.url,
      requestedBy
    };
  }

  private async resolveYouTubePlaylist(
    url: string,
    requestedBy: string,
    isYouTubeMusic: boolean
  ): Promise<ResolvedTrackCollection> {
    const playlist = await (play as any).playlist_info(url, { incomplete: true });
    const videos = await playlist.all_videos();

    return {
      playlistTitle: playlist.title,
      tracks: videos.map((video: any) => ({
        id: createTrackId(),
        title: video.title,
        url: video.url,
        audioUrl: video.url,
        source: isYouTubeMusic ? "youtube_music" : "youtube",
        durationMs: Number(video.durationInSec ?? 0) * 1000,
        thumbnailUrl: video.thumbnails?.at(-1)?.url,
        requestedBy
      }))
    };
  }

  private async resolveSearch(query: string, requestedBy: string): Promise<Track> {
    const results = await (play as any).search(query, { limit: 1 });
    const first = results[0];

    if (!first) {
      throw new Error(`No results found for "${query}"`);
    }

    return {
      id: createTrackId(),
      title: first.title,
      url: first.url,
      audioUrl: first.url,
      source: "youtube",
      durationMs: Number(first.durationInSec ?? 0) * 1000,
      thumbnailUrl: first.thumbnails?.at(-1)?.url,
      requestedBy
    };
  }
}

function normalizeInput(input: string): string {
  if (isMusicUrl(input)) {
    return input.replace("music.youtube.com", "www.youtube.com");
  }

  return input;
}

function isMusicUrl(input: string): boolean {
  return input.includes("music.youtube.com");
}

function createTrackId(): string {
  return crypto.randomUUID();
}

function formatSourceName(source: "soundcloud" | "spotify"): string {
  return source === "soundcloud" ? "SoundCloud" : "Spotify";
}
