import { spawn } from "node:child_process";
import { PassThrough, Readable } from "node:stream";
import { AudioResource, StreamType, createAudioResource } from "@discordjs/voice";
import ffmpegPath from "ffmpeg-static";
import play from "play-dl";
import { TrackAudioFactory } from "../../application/ports/services/track-audio-factory";
import { GuildSettings } from "../../domain/entities/guild-settings";
import { Track } from "../../domain/entities/track";
import { downloadYouTubeAudio } from "./youtube-innertube";
import { createYtDlpStream, resolveYtDlpAudioUrl } from "./yt-dlp-stream";

export class PlayDlTrackAudioFactory implements TrackAudioFactory {
  async create(track: Track, settings: GuildSettings): Promise<AudioResource<Track>> {
    if (ffmpegPath) {
      process.env.FFMPEG_PATH = ffmpegPath;
    }

    console.info(
      `[audio] creating resource track="${track.title}" source="${track.source}" mode="${track.streamHeaders ? "official-http" : "compat"}"`
    );

    const ffmpegOutput = track.streamHeaders
      ? this.createTranscodedInputStream(
          await this.createOfficialHttpStream(track.audioUrl, track.streamHeaders),
          settings
        )
      : await this.createCompatibilityOutput(track.audioUrl, settings);

    const resource = createAudioResource<Track>(ffmpegOutput, {
      inputType: StreamType.Raw,
      inlineVolume: true,
      metadata: track
    });

    resource.volume?.setVolume(clamp(settings.volume, 0, 150) / 100);
    return resource;
  }

  private async createCompatibilityOutput(
    audioUrl: string,
    settings: GuildSettings
  ): Promise<Readable> {
    if (isYouTubeUrl(audioUrl)) {
      try {
        const directAudioUrl = await resolveYtDlpAudioUrl(audioUrl);
        console.info(`[audio] youtube strategy=yt-dlp-direct-url url="${redactUrl(directAudioUrl)}"`);
        return this.createTranscodedUrlStream(directAudioUrl, settings);
      } catch (directUrlError) {
        try {
          console.warn(
            `[audio] youtube direct-url failed: ${directUrlError instanceof Error ? directUrlError.message : String(directUrlError)}`
          );
          console.info(`[audio] youtube strategy=yt-dlp-stdout`);
          return this.createTranscodedInputStream(await createYtDlpStream(audioUrl), settings);
        } catch (ytDlpError) {
          try {
            console.warn(
              `[audio] youtube yt-dlp stdout failed: ${ytDlpError instanceof Error ? ytDlpError.message : String(ytDlpError)}`
            );
            console.info(`[audio] youtube strategy=youtubei.js`);
            return this.createTranscodedInputStream(await downloadYouTubeAudio(audioUrl), settings);
          } catch (youtubeIError) {
            const directMessage =
              directUrlError instanceof Error ? directUrlError.message : String(directUrlError);
            const ytDlpMessage =
              ytDlpError instanceof Error ? ytDlpError.message : String(ytDlpError);
            const youtubeIMessage =
              youtubeIError instanceof Error ? youtubeIError.message : String(youtubeIError);

            throw new Error(
              `No pude abrir el stream de YouTube. direct-url: ${directMessage}. yt-dlp: ${ytDlpMessage}. youtubei.js: ${youtubeIMessage}`
            );
          }
        }
      }
    }

    return this.createTranscodedInputStream(await this.createCompatibilityStream(audioUrl), settings);
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

  private createTranscodedInputStream(
    input: NodeJS.ReadableStream,
    settings: GuildSettings
  ): Readable {
    const executable = process.env.FFMPEG_PATH || ffmpegPath;

    if (!executable) {
      throw new Error("FFmpeg is not configured");
    }

    const ffmpeg = spawn(executable, buildFfmpegArgsForPipeInput(settings), {
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

    ffmpeg.stdout.on("end", () => {
      console.info(`[audio] ffmpeg(pipe) stdout end bytes=${outputBytes}`);
      output.end();
    });

    ffmpeg.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
    });

    ffmpeg.on("exit", (code) => {
      console.info(
        `[audio] ffmpeg(pipe) exit code=${code ?? "null"} bytes=${outputBytes}${formatStderr(stderrChunks)}`
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

  private createTranscodedUrlStream(url: string, settings: GuildSettings): Readable {
    const executable = process.env.FFMPEG_PATH || ffmpegPath;

    if (!executable) {
      throw new Error("FFmpeg is not configured");
    }

    const ffmpeg = spawn(executable, buildFfmpegArgsForUrlInput(url, settings), {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const output = new PassThrough();
    const stderrChunks: string[] = [];
    let outputBytes = 0;

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
      console.info(`[audio] ffmpeg(url) stdout end bytes=${outputBytes} input="${redactUrl(url)}"`);
      output.end();
    });

    ffmpeg.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
    });

    ffmpeg.on("exit", (code) => {
      console.info(
        `[audio] ffmpeg(url) exit code=${code ?? "null"} bytes=${outputBytes} input="${redactUrl(url)}"${formatStderr(stderrChunks)}`
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

    ffmpeg.stdout.pipe(output);
    return output;
  }
}

function buildFfmpegArgsForPipeInput(settings: GuildSettings): string[] {
  return [
    "-analyzeduration",
    "0",
    "-loglevel",
    "0",
    "-i",
    "pipe:0",
    ...buildFfmpegOutputArgs(settings)
  ];
}

function buildFfmpegArgsForUrlInput(url: string, settings: GuildSettings): string[] {
  return [
    "-reconnect",
    "1",
    "-reconnect_at_eof",
    "1",
    "-reconnect_streamed",
    "1",
    "-reconnect_on_network_error",
    "1",
    "-reconnect_delay_max",
    "5",
    "-rw_timeout",
    "15000000",
    "-analyzeduration",
    "0",
    "-loglevel",
    "warning",
    "-i",
    url,
    ...buildFfmpegOutputArgs(settings)
  ];
}

function buildFfmpegOutputArgs(settings: GuildSettings): string[] {
  const filters: string[] = [];

  if (settings.bassBoost > 0) {
    filters.push(`bass=g=${clamp(settings.bassBoost, 0, 20)}`);
  }

  if (settings.nightcore) {
    filters.push("asetrate=48000*1.15,aresample=48000,atempo=1");
  }

  return [
    "-vn",
    "-sn",
    "-dn",
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

function redactUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.search = "";
    return parsed.toString();
  } catch {
    return url;
  }
}
