import { PassThrough, Readable } from "node:stream";
import {
  extractYouTubePlaylistId,
  extractYouTubeVideoId,
  normalizeYouTubeUrl
} from "./youtube-url";

let innertubePromise: Promise<any> | undefined;
const YOUTUBE_AUDIO_CLIENTS = ["ANDROID", "IOS", "MWEB", "YTMUSIC", "WEB"] as const;
const YOUTUBE_INFO_CLIENTS = ["WEB", "MWEB", "ANDROID", "IOS", "YTMUSIC"] as const;
const YOUTUBE_MUSIC_INFO_CLIENTS = ["YTMUSIC", "ANDROID", "IOS", "MWEB", "WEB"] as const;
type PreferredSource = "youtube" | "youtube_music";

export interface YouTubeVideoDetails {
  title: string;
  url: string;
  durationMs: number;
  thumbnailUrl?: string;
}

export interface YouTubePlaylistDetails {
  title?: string;
  tracks: YouTubeVideoDetails[];
}

export async function downloadYouTubeAudio(videoUrl: string): Promise<NodeJS.ReadableStream> {
  const videoId = extractYouTubeVideoId(videoUrl);

  if (!videoId) {
    throw new Error(`Could not extract a YouTube video id from: ${videoUrl}`);
  }

  const innertube = await getInnertube();
  let lastError: unknown;

  for (const client of YOUTUBE_AUDIO_CLIENTS) {
    try {
      const format = await getDirectAudioFormat(innertube, videoId, client);

      if (!format?.url) {
        throw new Error(`Client ${client} did not return a direct audio URL`);
      }

      return await fetchYouTubeAudioChunked(format.url, buildStreamHeaders(client));
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Could not open a playable YouTube audio stream for: ${videoUrl}`);
}

export async function getYouTubeVideoDetails(
  input: string,
  preferredSource: PreferredSource = "youtube"
): Promise<YouTubeVideoDetails> {
  const videoId = extractYouTubeVideoId(input);

  if (!videoId) {
    throw new Error(`Could not extract a YouTube video id from: ${input}`);
  }

  const innertube = await getInnertube();
  const clients = preferredSource === "youtube_music"
    ? YOUTUBE_MUSIC_INFO_CLIENTS
    : YOUTUBE_INFO_CLIENTS;
  let lastError: unknown;

  for (const client of clients) {
    try {
      const info = await innertube.getBasicInfo(videoId, { client });

      return {
        title: readText(info?.basic_info?.title) ?? `YouTube video ${videoId}`,
        url: buildWatchUrl(videoId),
        durationMs: Number(info?.basic_info?.duration ?? 0) * 1000,
        thumbnailUrl: readThumbnailUrl(info?.basic_info?.thumbnail)
      };
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Could not load metadata for: ${input}`);
}

export async function getYouTubePlaylistDetails(
  input: string,
  preferredSource: PreferredSource = "youtube"
): Promise<YouTubePlaylistDetails> {
  const playlistId = extractYouTubePlaylistId(input);

  if (!playlistId) {
    throw new Error(`Could not extract a YouTube playlist id from: ${input}`);
  }

  const innertube = await getInnertube();

  return preferredSource === "youtube_music"
    ? await getYouTubeMusicPlaylistDetails(innertube, playlistId)
    : await getYouTubeWebPlaylistDetails(innertube, playlistId);
}

export async function searchYouTubeVideo(query: string): Promise<YouTubeVideoDetails> {
  const innertube = await getInnertube();
  let lastError: unknown;

  try {
    const search = await innertube.search(query, { type: "video" });
    const firstVideo = toArray(search?.results).find(isYouTubeSearchVideo);

    if (firstVideo) {
      return mapSearchVideo(firstVideo);
    }
  } catch (error) {
    lastError = error;
  }

  try {
    const musicSearch = await innertube.music.search(query, { type: "song" });
    const firstSong = toArray(musicSearch?.songs?.contents).find(isYouTubeMusicItem);

    if (firstSong) {
      return mapMusicItem(firstSong);
    }

    const firstMusicVideo = toArray(musicSearch?.videos?.contents).find(isYouTubeMusicItem);

    if (firstMusicVideo) {
      return mapMusicItem(firstMusicVideo);
    }
  } catch (error) {
    if (!lastError) {
      lastError = error;
    }
  }

  if (lastError instanceof Error) {
    throw lastError;
  }

  throw new Error(`No results found for "${query}"`);
}

async function getInnertube(): Promise<any> {
  if (!innertubePromise) {
    innertubePromise = import("youtubei.js").then((module) => module.default.create());
  }

  return innertubePromise;
}

async function getDirectAudioFormat(
  innertube: any,
  videoId: string,
  client: (typeof YOUTUBE_AUDIO_CLIENTS)[number]
): Promise<any> {
  const info = await innertube.getBasicInfo(videoId, { client });
  const streamingData = info.streaming_data;

  if (!streamingData) {
    throw new Error(`Client ${client} did not return streaming data`);
  }

  const formats = [
    ...(streamingData.adaptive_formats ?? []),
    ...(streamingData.formats ?? [])
  ];

  const directAudioFormats = formats
    .filter((format: any) => format?.has_audio && !format?.has_video && typeof format?.url === "string")
    .sort((left: any, right: any) => Number(right?.bitrate ?? 0) - Number(left?.bitrate ?? 0));

  if (directAudioFormats.length === 0) {
    throw new Error(`Client ${client} did not expose a direct audio-only format`);
  }

  return directAudioFormats[0];
}

function buildStreamHeaders(client: (typeof YOUTUBE_AUDIO_CLIENTS)[number]): Record<string, string> {
  if (client === "ANDROID") {
    return {
      "accept": "*/*",
      "origin": "https://www.youtube.com",
      "referer": "https://www.youtube.com/",
      "user-agent": "com.google.android.youtube/21.03.36(Linux; U; Android 16; en_US; SM-S908E Build/TP1A.220624.014) gzip"
    };
  }

  if (client === "IOS") {
    return {
      "accept": "*/*",
      "origin": "https://www.youtube.com",
      "referer": "https://www.youtube.com/",
      "user-agent": "com.google.ios.youtube/20.11.6 (iPhone10,4; U; CPU iOS 16_7_7 like Mac OS X)"
    };
  }

  return {
    "accept": "*/*",
    "origin": "https://www.youtube.com",
    "referer": "https://www.youtube.com/"
  };
}

const YOUTUBE_CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per range request

async function fetchYouTubeAudioChunked(
  url: string,
  headers: Record<string, string>
): Promise<NodeJS.ReadableStream> {
  // Parse total content length from the `clen` query parameter YouTube embeds in audio URLs.
  // Without range requests YouTube's CDN closes the connection after the first chunk (~2-3 MB),
  // which cuts off audio mid-track.
  const urlObj = new URL(url);
  const clen = urlObj.searchParams.get("clen");
  const totalSize = clen ? parseInt(clen, 10) : NaN;

  if (!totalSize || isNaN(totalSize)) {
    // No clen — fall back to a single request and hope for the best.
    const response = await fetch(url, { headers, redirect: "follow" });

    if (!response.ok || !response.body) {
      throw new Error(`YouTube audio request failed with status ${response.status}`);
    }

    return Readable.fromWeb(response.body as any);
  }

  const output = new PassThrough();

  void (async () => {
    try {
      let offset = 0;

      while (offset < totalSize) {
        const end = Math.min(offset + YOUTUBE_CHUNK_SIZE - 1, totalSize - 1);
        const response = await fetch(url, {
          headers: { ...headers, "Range": `bytes=${offset}-${end}` },
          redirect: "follow"
        });

        if (!response.ok || !response.body) {
          output.destroy(
            new Error(`YouTube audio chunk request failed at offset ${offset} with status ${response.status}`)
          );
          return;
        }

        const readable = Readable.fromWeb(response.body as any);

        await new Promise<void>((resolve, reject) => {
          readable.on("end", resolve);
          readable.on("error", reject);
          readable.pipe(output, { end: false });
        });

        offset = end + 1;
      }

      output.end();
    } catch (error) {
      output.destroy(error instanceof Error ? error : new Error(String(error)));
    }
  })();

  return output;
}

async function getYouTubeWebPlaylistDetails(
  innertube: any,
  playlistId: string
): Promise<YouTubePlaylistDetails> {
  let playlist = await innertube.getPlaylist(playlistId);
  const title = readText(playlist?.info?.title);
  const tracks: YouTubeVideoDetails[] = [];

  while (true) {
    for (const item of toArray(playlist?.items)) {
      if (!isYouTubeWebPlaylistItem(item)) {
        continue;
      }

      tracks.push(mapWebPlaylistItem(item));
    }

    if (!playlist?.has_continuation) {
      break;
    }

    playlist = await playlist.getContinuation();
  }

  return { title, tracks };
}

async function getYouTubeMusicPlaylistDetails(
  innertube: any,
  playlistId: string
): Promise<YouTubePlaylistDetails> {
  let playlist = await innertube.music.getPlaylist(playlistId);
  const title = readText(playlist?.header?.title);
  const tracks: YouTubeVideoDetails[] = [];

  while (true) {
    for (const item of toArray(playlist?.items)) {
      if (!isYouTubeMusicItem(item)) {
        continue;
      }

      tracks.push(mapMusicItem(item));
    }

    if (!playlist?.has_continuation) {
      break;
    }

    playlist = await playlist.getContinuation();
  }

  return { title, tracks };
}

function isYouTubeSearchVideo(item: any): boolean {
  return typeof item?.video_id === "string" && item.video_id.length > 0;
}

function isYouTubeWebPlaylistItem(item: any): boolean {
  return typeof item?.id === "string" && item.id.length > 0 && item?.is_playable !== false;
}

function isYouTubeMusicItem(item: any): boolean {
  return typeof item?.id === "string" && item.id.length > 0;
}

function mapSearchVideo(item: any): YouTubeVideoDetails {
  return {
    title: readText(item?.title) ?? `YouTube video ${item.video_id}`,
    url: buildWatchUrl(item.video_id),
    durationMs: Number(item?.duration?.seconds ?? 0) * 1000,
    thumbnailUrl: readThumbnailUrl(item?.thumbnails) ?? item?.best_thumbnail?.url
  };
}

function mapWebPlaylistItem(item: any): YouTubeVideoDetails {
  return {
    title: readText(item?.title) ?? `YouTube video ${item.id}`,
    url: buildWatchUrl(item.id),
    durationMs: Number(item?.duration?.seconds ?? 0) * 1000,
    thumbnailUrl: readThumbnailUrl(item?.thumbnails)
  };
}

function mapMusicItem(item: any): YouTubeVideoDetails {
  return {
    title: readText(item?.title) ?? `YouTube video ${item.id}`,
    url: buildWatchUrl(item.id),
    durationMs: Number(item?.duration?.seconds ?? 0) * 1000,
    thumbnailUrl: readThumbnailUrl(item?.thumbnails)
  };
}

function readText(value: unknown): string | undefined {
  if (!value) {
    return undefined;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  }

  if (typeof (value as { toString?: () => string }).toString === "function") {
    const text = (value as { toString: () => string }).toString().trim();

    if (text.length > 0 && text !== "[object Object]") {
      return text;
    }
  }

  if (typeof value === "object" && "text" in value) {
    const text = readText((value as { text?: unknown }).text);

    if (text) {
      return text;
    }
  }

  return undefined;
}

function readThumbnailUrl(value: unknown): string | undefined {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  const last = value.at(-1) as { url?: unknown } | undefined;
  return typeof last?.url === "string" ? last.url : undefined;
}

function buildWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function toArray<T>(value: Iterable<T> | ArrayLike<T> | undefined | null): T[] {
  if (!value) {
    return [];
  }

  return Array.from(value);
}
