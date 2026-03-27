import { access } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { PassThrough } from "node:stream";

const DEFAULT_WINDOWS_BINARY = path.resolve(process.cwd(), "tools", "yt-dlp.exe");
const DEFAULT_LINUX_BINARY = "/usr/local/bin/yt-dlp";

export async function createYtDlpStream(videoUrl: string): Promise<NodeJS.ReadableStream> {
  const executable = await resolveYtDlpPath();
  const args = [
    "--no-playlist",
    "--quiet",
    "--no-warnings",
    "-f",
    "bestaudio/best",
    "-o",
    "-",
    normalizeYouTubeUrl(videoUrl)
  ];

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
