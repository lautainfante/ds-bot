import { access, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { PassThrough } from "node:stream";

const DEFAULT_WINDOWS_BINARY = path.resolve(process.cwd(), "tools", "yt-dlp.exe");
const DEFAULT_LINUX_BINARY = "/usr/local/bin/yt-dlp";
const AUDIO_FORMAT_SELECTORS = [
  "bestaudio[acodec!=none]/bestaudio*/ba",
  "140/251/250/249",
  "best"
];
let cookiesPathPromise: Promise<string | undefined> | undefined;

export async function createYtDlpStream(videoUrl: string): Promise<NodeJS.ReadableStream> {
  const executable = await resolveYtDlpPath();
  let lastError: Error | undefined;

  for (const formatSelector of AUDIO_FORMAT_SELECTORS) {
    try {
      const args = await createBaseArgs([
        "--no-playlist",
        "--quiet",
        "--no-warnings",
        "-f",
        formatSelector,
        "-o",
        "-",
        normalizeYouTubeUrl(videoUrl)
      ]);

      return await spawnYtDlpStream(executable, args);
    } catch (error) {
      lastError = wrapSelectorError(formatSelector, error);
    }
  }

  throw lastError ?? new Error("yt-dlp no pudo abrir el stream.");
}

export async function resolveYtDlpAudioUrl(videoUrl: string): Promise<string> {
  const executable = await resolveYtDlpPath();
  let lastError: Error | undefined;

  for (const formatSelector of AUDIO_FORMAT_SELECTORS) {
    try {
      const args = await createBaseArgs([
        "--no-playlist",
        "--quiet",
        "--no-warnings",
        "-f",
        formatSelector,
        "-g",
        normalizeYouTubeUrl(videoUrl)
      ]);

      return await spawnYtDlpUrl(executable, args);
    } catch (error) {
      lastError = wrapSelectorError(formatSelector, error);
    }
  }

  throw lastError ?? new Error("yt-dlp no pudo resolver una URL de audio.");
}

async function resolveYtDlpPath(): Promise<string> {
  const configuredPath = process.env.YT_DLP_PATH?.trim();

  if (configuredPath) {
    return configuredPath;
  }

  const candidates = process.platform === "win32"
    ? [DEFAULT_WINDOWS_BINARY]
    : [DEFAULT_LINUX_BINARY, DEFAULT_WINDOWS_BINARY];

  for (const candidate of candidates) {
    try {
      await access(candidate);
      return candidate;
    } catch {
      continue;
    }
  }

  throw new Error(
    "No encontre yt-dlp. Configura YT_DLP_PATH o instala el binario en /usr/local/bin/yt-dlp."
  );
}

async function createBaseArgs(args: string[]): Promise<string[]> {
  const extractorArgs = buildYouTubeExtractorArgs();
  const cookiesPath = await resolveYtDlpCookiesPath();
  const baseArgs = [
    ...(extractorArgs ? ["--extractor-args", extractorArgs] : []),
    ...args
  ];

  if (!cookiesPath) {
    return baseArgs;
  }

  return ["--cookies", cookiesPath, ...baseArgs];
}

async function resolveYtDlpCookiesPath(): Promise<string | undefined> {
  if (!cookiesPathPromise) {
    cookiesPathPromise = createCookiesPath();
  }

  return await cookiesPathPromise;
}

async function createCookiesPath(): Promise<string | undefined> {
  const configuredPath = process.env.YT_DLP_COOKIES_PATH?.trim();

  if (configuredPath) {
    return configuredPath;
  }

  const base64Cookies = process.env.YT_DLP_COOKIES_BASE64?.trim();

  if (!base64Cookies) {
    return undefined;
  }

  const cookiesPath = path.join(os.tmpdir(), "yt-dlp-cookies.txt");

  try {
    const contents = decodeCookiesEnvValue(base64Cookies);

    if (!contents) {
      throw new Error("YT_DLP_COOKIES_BASE64 esta vacio despues de procesarlo.");
    }

    await writeFile(cookiesPath, `${contents}\n`, "utf8");
    return cookiesPath;
  } catch (error) {
    throw new Error(
      `No pude preparar las cookies de yt-dlp: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function normalizeYouTubeUrl(url: string): string {
  if (url.includes("music.youtube.com")) {
    return url.replace("music.youtube.com", "www.youtube.com");
  }

  return url;
}

function formatStderr(stderrChunks: string[]): string {
  const stderr = stderrChunks.join("").trim();
  return stderr.length > 0 ? `: ${stderr}` : "";
}

function decodeCookiesEnvValue(value: string): string {
  const trimmed = value.trim();

  if (looksLikeNetscapeCookies(trimmed)) {
    return trimmed;
  }

  const decoded = Buffer.from(trimmed, "base64").toString("utf8").trim();

  if (looksLikeNetscapeCookies(decoded)) {
    return decoded;
  }

  throw new Error(
    "El valor de YT_DLP_COOKIES_BASE64 no es un cookies.txt Netscape valido ni un base64 de ese archivo."
  );
}

function looksLikeNetscapeCookies(value: string): boolean {
  return value.startsWith("# Netscape HTTP Cookie File");
}

function buildYouTubeExtractorArgs(): string | undefined {
  const poToken = process.env.YT_DLP_YOUTUBE_PO_TOKEN?.trim();

  if (!poToken) {
    return "youtube:player-client=web_music,web";
  }

  return `youtube:player-client=web_music,web,mweb;po_token=mweb.gvs+${poToken}`;
}

function wrapSelectorError(formatSelector: string, error: unknown): Error {
  const message = error instanceof Error ? error.message : String(error);
  return new Error(`[format=${formatSelector}] ${message}`);
}

async function spawnYtDlpStream(
  executable: string,
  args: string[]
): Promise<NodeJS.ReadableStream> {
  return await new Promise<NodeJS.ReadableStream>((resolve, reject) => {
    const child = spawn(executable, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });
    const output = new PassThrough();

    const stderrChunks: string[] = [];
    let settled = false;

    child.stderr.setEncoding("utf8");
    child.stderr.on("data", (chunk: string) => {
      if (stderrChunks.join("").length < 4000) {
        stderrChunks.push(chunk);
      }
    });

    child.once("error", (error) => {
      if (settled) {
        return;
      }

      settled = true;
      reject(error);
    });

    child.once("spawn", () => {
      if (settled) {
        return;
      }

      child.stdout.pipe(output);
      settled = true;
      resolve(output);
    });

    child.once("exit", (code) => {
      if (!settled) {
        if (code !== 0) {
          settled = true;
          reject(
            new Error(
              `yt-dlp failed with exit code ${code ?? "unknown"}${formatStderr(stderrChunks)}`
            )
          );
        }

        return;
      }

      if (code === 0 || code === null) {
        output.end();
        return;
      }

      output.destroy(
        new Error(`yt-dlp failed with exit code ${code ?? "unknown"}${formatStderr(stderrChunks)}`)
      );
    });

    output.once("close", () => {
      if (!child.killed) {
        child.kill();
      }
    });
  });
}

async function spawnYtDlpUrl(executable: string, args: string[]): Promise<string> {
  return await new Promise<string>((resolve, reject) => {
    const child = spawn(executable, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true
    });

    const stdoutChunks: string[] = [];
    const stderrChunks: string[] = [];

    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");

    child.stdout.on("data", (chunk: string) => {
      stdoutChunks.push(chunk);
    });

    child.stderr.on("data", (chunk: string) => {
      if (stderrChunks.join("").length < 4000) {
        stderrChunks.push(chunk);
      }
    });

    child.once("error", reject);

    child.once("exit", (code) => {
      if (code && code !== 0) {
        reject(
          new Error(`yt-dlp failed with exit code ${code ?? "unknown"}${formatStderr(stderrChunks)}`)
        );
        return;
      }

      const resolvedUrl = stdoutChunks.join("").trim().split(/\r?\n/)[0]?.trim();

      if (!resolvedUrl) {
        reject(new Error(`yt-dlp did not return an audio URL${formatStderr(stderrChunks)}`));
        return;
      }

      resolve(resolvedUrl);
    });
  });
}
