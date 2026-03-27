import { Readable } from "node:stream";

let innertubePromise: Promise<any> | undefined;
const YOUTUBE_AUDIO_CLIENTS = ["ANDROID", "IOS", "MWEB", "YTMUSIC", "WEB"] as const;

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

      const response = await fetch(format.url, {
        headers: buildStreamHeaders(client),
        redirect: "follow"
      });

      if (!response.ok || !response.body) {
        throw new Error(`Client ${client} stream request failed with status ${response.status}`);
      }

      return Readable.fromWeb(response.body as any);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`Could not open a playable YouTube audio stream for: ${videoUrl}`);
}

async function getInnertube(): Promise<any> {
  if (!innertubePromise) {
    innertubePromise = import("youtubei.js").then((module) => module.default.create());
  }

  return innertubePromise;
}

function extractYouTubeVideoId(input: string): string | null {
  try {
    const url = new URL(normalizeYouTubeUrl(input));
    const hostname = url.hostname.toLowerCase();

    if (hostname.includes("youtu.be")) {
      return url.pathname.split("/").filter(Boolean)[0] ?? null;
    }

    if (hostname.includes("youtube.com")) {
      if (url.pathname.startsWith("/shorts/") || url.pathname.startsWith("/live/")) {
        return url.pathname.split("/").filter(Boolean)[1] ?? null;
      }

      return url.searchParams.get("v");
    }
  } catch {
    return null;
  }

  return null;
}

function normalizeYouTubeUrl(url: string): string {
  if (url.includes("music.youtube.com")) {
    return url.replace("music.youtube.com", "www.youtube.com");
  }

  return url;
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
