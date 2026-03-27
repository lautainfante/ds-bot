import { spawn } from "node:child_process";
import { PassThrough, Readable } from "node:stream";
import { AudioResource, StreamType, createAudioResource } from "@discordjs/voice";
import ffmpegPath from "ffmpeg-static";
import play from "play-dl";
import { TrackAudioFactory } from "../../application/ports/services/track-audio-factory";
import { GuildSettings } from "../../domain/entities/guild-settings";
import { Track } from "../../domain/entities/track";
import { downloadYouTubeAudio } from "./youtube-innertube";
import { createYtDlpStream } from "./yt-dlp-stream";

export class PlayDlTrackAudioFactory implements TrackAudioFactory {
  async create(track: Track, settings: GuildSettings): Promise<AudioResource<Track>> {
    if (ffmpegPath) {
      process.env.FFMPEG_PATH = ffmpegPath;
    }

    const input = track.streamHeaders
      ? await this.createOfficialHttpStream(track.audioUrl, track.streamHeaders)
      : await this.createCompatibilityStream(track.audioUrl);
    const ffmpegOutput = this.createTranscodedStream(input, settings);

    const resource = createAudioResource<Track>(ffmpegOutput, {
      inputType: StreamType.Raw,
      inlineVolume: true,
      metadata: track
    });

    resource.volume?.setVolume(clamp(settings.volume, 0, 150) / 100);
    return resource;
  }

  private async createCompatibilityStream(audioUrl: string): Promise<NodeJS.ReadableStream> {
    if (isYouTubeUrl(audioUrl)) {
      try {
        return await createYtDlpStream(audioUrl);
      } catch (ytDlpError) {
        try {
          return await downloadYouTubeAudio(audioUrl);
        } catch (youtubeIError) {
          const ytDlpMessage = ytDlpError instanceof Error ? ytDlpError.message : String(ytDlpError);
          const youtubeIMessage =
            youtubeIError instanceof Error ? youtubeIError.message : String(youtubeIError);

          throw new Error(
            `No pude abrir el stream de YouTube. yt-dlp: ${ytDlpMessage}. youtubei.js: ${youtubeIMessage}`
          );
        }
      }
    }

    const source = await (play as any).stream(audioUrl, {
      discordPlayerCompatibility: true
    });
    return source.stream;
  }

  private async createOfficialHttpStream(
    audioUrl: string,
    headers: Record<string, string>
  ): Promise<NodeJS.ReadableStream> {
    const response = await fetch(audioUrl, {
      headers,
      redirect: "follow"
    });

    if (!response.ok || !response.body) {
      throw new Error(`Official stream request failed with status ${response.status}`);
    }

    return Readable.fromWeb(response.body as any);
  }

  private createTranscodedStream(
    input: NodeJS.ReadableStream,
    settings: GuildSettings
  ): Readable {
    const executable = process.env.FFMPEG_PATH || ffmpegPath;

    if (!executable) {
      throw new Error("FFmpeg is not configured");
    }

    const ffmpeg = spawn(executable, buildFfmpegArgs(settings), {
      stdio: ["pipe", "pipe", "pipe"],
      windowsHide: true
    });
    const output = new PassThrough();
    const stderrChunks: string[] = [];

    input.on("error", (error) => {
      if (!isBrokenPipeError(error)) {
        output.destroy(error);
      }
    });

    ffmpeg.stdin.on("error", (error) => {
      if (isBrokenPipeError(error)) {
        return;
      }

      output.destroy(error);
    });

    ffmpeg.on("error", (error) => {
      output.destroy(error);
    });

    ffmpeg.stderr.setEncoding("utf8");
    ffmpeg.stderr.on("data", (chunk: string) => {
      if (stderrChunks.join("").length < 4000) {
        stderrChunks.push(chunk);
      }
    });

    ffmpeg.stdout.on("end", () => {
      output.end();
    });

    ffmpeg.on("exit", (code) => {
      if (code && code !== 0) {
        output.destroy(
          new Error(`FFmpeg failed with exit code ${code}${formatStderr(stderrChunks)}`)
        );
      }
    });

    output.once("close", () => {
      if (!ffmpeg.killed) {
        ffmpeg.kill();
      }
    });

    input.pipe(ffmpeg.stdin);
    ffmpeg.stdout.pipe(output);

    return output;
  }
}

function buildFfmpegArgs(settings: GuildSettings): string[] {
  const filters: string[] = [];

  if (settings.bassBoost > 0) {
    filters.push(`bass=g=${clamp(settings.bassBoost, 0, 20)}`);
  }

  if (settings.nightcore) {
    filters.push("asetrate=48000*1.15,aresample=48000,atempo=1");
  }

  return [
    "-analyzeduration",
    "0",
    "-loglevel",
    "0",
    "-i",
    "pipe:0",
    ...(filters.length > 0 ? ["-af", filters.join(",")] : []),
    "-f",
    "s16le",
    "-ar",
    "48000",
    "-ac",
    "2",
    "pipe:1"
  ];
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isYouTubeUrl(url: string): boolean {
  return url.includes("youtube.com") || url.includes("youtu.be");
}

function isBrokenPipeError(error: unknown): boolean {
  return error instanceof Error && error.message.includes("EPIPE");
}

function formatStderr(stderrChunks: string[]): string {
  const stderr = stderrChunks.join("").trim();
  return stderr.length > 0 ? `: ${stderr}` : "";
}
