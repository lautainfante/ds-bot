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

    console.info(
      `[audio] creating resource track="${track.title}" source="${track.source}" mode="${track.streamHeaders ? "official-http" : "compat"}"`
    );

    const ffmpegOutput = track.streamHeaders
      ? this.createTranscodedStream(
          await this.createOfficialHttpStream(track.audioUrl, track.streamHeaders),
          settings
        )
      : await this.createCompatibilityOutput(track.audioUrl, settings);

    const resource = createAudioResource<Track>(ffmpegOutput, {
      inputType: StreamType.OggOpus,
      metadata: track
    });

    return resource;
  }

  private async createCompatibilityOutput(
    audioUrl: string,
    settings: GuildSettings
  ): Promise<Readable> {
    if (isYouTubeUrl(audioUrl)) {
      try {
        console.info(`[audio] youtube strategy=yt-dlp-stdout`);
        return this.createTranscodedStream(await createYtDlpStream(audioUrl), settings);
      } catch (ytDlpError) {
        try {
          console.warn(
            `[audio] youtube yt-dlp failed: ${ytDlpError instanceof Error ? ytDlpError.message : String(ytDlpError)}`
          );
          console.info(`[audio] youtube strategy=youtubei.js`);
          return this.createTranscodedStream(await downloadYouTubeAudio(audioUrl), settings);
        } catch (youtubeIError) {
          const ytDlpMessage =
            ytDlpError instanceof Error ? ytDlpError.message : String(ytDlpError);
          const youtubeIMessage =
            youtubeIError instanceof Error ? youtubeIError.message : String(youtubeIError);
          const authHint = buildYouTubeAuthHint(ytDlpMessage, youtubeIMessage);

          throw new Error(
            `No pude abrir el stream de YouTube. yt-dlp: ${ytDlpMessage}. youtubei.js: ${youtubeIMessage}${authHint}`
          );
        }
      }
    }

    return this.createTranscodedStream(await this.createCompatibilityStream(audioUrl), settings);
  }

  private async createCompatibilityStream(audioUrl: string): Promise<NodeJS.ReadableStream> {
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
    let outputBytes = 0;

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

    ffmpeg.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
    });

    ffmpeg.stdout.on("end", () => {
      console.info(`[audio] ffmpeg stdout end bytes=${outputBytes}`);
      output.end();
    });

    ffmpeg.on("exit", (code) => {
      console.info(
        `[audio] ffmpeg exit code=${code ?? "null"} bytes=${outputBytes}${formatStderr(stderrChunks)}`
      );
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
  return [
    "-analyzeduration",
    "0",
    "-loglevel",
    "0",
    "-i",
    "pipe:0",
    "-vn",
    "-sn",
    "-dn",
    ...buildAudioFilterArgs(settings),
    "-c:a",
    "libopus",
    "-f",
    "ogg",
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

function buildAudioFilterArgs(settings: GuildSettings): string[] {
  const filters: string[] = [];

  const volume = clamp(settings.volume, 0, 150);
  if (volume !== 100) {
    filters.push(`volume=${volume / 100}`);
  }

  if (settings.bassBoost > 0) {
    filters.push(`bass=g=${clamp(settings.bassBoost, 0, 20)}`);
  }

  if (settings.nightcore) {
    filters.push("asetrate=48000*1.15,aresample=48000,atempo=1");
  }

  return filters.length > 0 ? ["-af", filters.join(",")] : [];
}

function buildYouTubeAuthHint(...messages: string[]): string {
  const combined = messages.join(" ").toLowerCase();

  if (!combined.includes("sign in to confirm")) {
    return "";
  }

  return " Configura o renueva YT_DLP_COOKIES_PATH con un cookies.txt Netscape valido.";
}
