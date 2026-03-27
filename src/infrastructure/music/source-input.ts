import { TrackSource } from "../../domain/entities/track";

export type ResolvedInputSource = TrackSource | "search";

export function detectInputSource(input: string): ResolvedInputSource {
  try {
    const url = new URL(input);
    const hostname = url.hostname.toLowerCase();

    if (hostname.includes("soundcloud.com")) {
      return "soundcloud";
    }

    if (hostname.includes("spotify.com")) {
      return "spotify";
    }

    if (hostname.includes("music.youtube.com")) {
      return "youtube_music";
    }

    if (hostname.includes("youtube.com") || hostname.includes("youtu.be")) {
      return "youtube";
    }
  } catch {
    return "search";
  }

  return "search";
}

