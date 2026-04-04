const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11,12}$/;
const YOUTUBE_PLAYLIST_ID_PATTERN = /^(PL|UU|LL|RD|OL)[a-zA-Z0-9_-]{10,}$/;

export function normalizeYouTubeUrl(input: string): string {
  if (input.includes("music.youtube.com")) {
    return input.replace("music.youtube.com", "www.youtube.com");
  }

  return input;
}

export function isYouTubeMusicUrl(input: string): boolean {
  return input.includes("music.youtube.com");
}

export function extractYouTubeVideoId(input: string): string | undefined {
  const trimmed = input.trim();

  if (YOUTUBE_VIDEO_ID_PATTERN.test(trimmed) && !YOUTUBE_PLAYLIST_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const url = tryParseUrl(normalizeYouTubeUrl(trimmed));

  if (!url) {
    return undefined;
  }

  const hostname = url.hostname.toLowerCase();

  if (hostname.includes("youtu.be")) {
    return firstPathSegment(url);
  }

  if (!hostname.includes("youtube.com")) {
    return undefined;
  }

  if (
    url.pathname.startsWith("/embed/") ||
    url.pathname.startsWith("/shorts/") ||
    url.pathname.startsWith("/live/")
  ) {
    return secondPathSegment(url);
  }

  return url.searchParams.get("v") ?? undefined;
}

export function extractYouTubePlaylistId(input: string): string | undefined {
  const trimmed = input.trim();

  if (YOUTUBE_PLAYLIST_ID_PATTERN.test(trimmed)) {
    return trimmed;
  }

  const url = tryParseUrl(normalizeYouTubeUrl(trimmed));

  if (!url) {
    return undefined;
  }

  const hostname = url.hostname.toLowerCase();

  if (!hostname.includes("youtube.com") && !hostname.includes("youtu.be")) {
    return undefined;
  }

  const playlistId = url.searchParams.get("list") ?? undefined;

  if (!playlistId) {
    return undefined;
  }

  return YOUTUBE_PLAYLIST_ID_PATTERN.test(playlistId) ? playlistId : undefined;
}

function tryParseUrl(input: string): URL | undefined {
  try {
    return new URL(input);
  } catch {
    return undefined;
  }
}

function firstPathSegment(url: URL): string | undefined {
  return url.pathname.split("/").filter(Boolean)[0] ?? undefined;
}

function secondPathSegment(url: URL): string | undefined {
  return url.pathname.split("/").filter(Boolean)[1] ?? undefined;
}
