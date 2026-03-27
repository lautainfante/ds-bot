export type TrackSource = "youtube" | "youtube_music" | "soundcloud" | "spotify";

export interface Track {
  id: string;
  title: string;
  url: string;
  audioUrl: string;
  source: TrackSource;
  durationMs: number;
  thumbnailUrl?: string;
  requestedBy: string;
  streamHeaders?: Record<string, string>;
}

export function isTrackSource(value: string): value is TrackSource {
  return value === "youtube" || value === "youtube_music" || value === "soundcloud" || value === "spotify";
}

