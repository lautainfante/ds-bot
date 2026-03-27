import jpeg from "jpeg-js";
import { PNG } from "pngjs";

type Rgb = [number, number, number];

const colorCache = new Map<string, number>();

export async function getDominantColor(thumbnailUrl?: string): Promise<number> {
  if (!thumbnailUrl) {
    return 0xf59e0b;
  }

  const cached = colorCache.get(thumbnailUrl);

  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(thumbnailUrl);

    if (!response.ok) {
      throw new Error(`Thumbnail request failed with status ${response.status}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    const buffer = Buffer.from(await response.arrayBuffer());
    const dominant = contentType.includes("png")
      ? getDominantFromPng(buffer)
      : getDominantFromJpeg(buffer);
    const themed = boostColor(dominant);
    const color = rgbToNumber(themed);

    colorCache.set(thumbnailUrl, color);
    return color;
  } catch {
    const fallback = hashColor(thumbnailUrl);
    colorCache.set(thumbnailUrl, fallback);
    return fallback;
  }
}

function getDominantFromJpeg(buffer: Buffer): Rgb {
  const decoded = jpeg.decode(buffer, { useTArray: true });
  return sampleDominant(decoded.width, decoded.height, decoded.data);
}

function getDominantFromPng(buffer: Buffer): Rgb {
  const decoded = PNG.sync.read(buffer);
  return sampleDominant(decoded.width, decoded.height, decoded.data);
}

function sampleDominant(width: number, height: number, rgba: Uint8Array | Buffer): Rgb {
  let red = 0;
  let green = 0;
  let blue = 0;
  let count = 0;

  const stepX = Math.max(1, Math.floor(width / 32));
  const stepY = Math.max(1, Math.floor(height / 32));

  for (let y = 0; y < height; y += stepY) {
    for (let x = 0; x < width; x += stepX) {
      const index = (width * y + x) << 2;
      const alpha = rgba[index + 3];

      if (alpha < 32) {
        continue;
      }

      const currentRed = rgba[index];
      const currentGreen = rgba[index + 1];
      const currentBlue = rgba[index + 2];
      const brightness = (currentRed + currentGreen + currentBlue) / 3;

      if (brightness < 28 || brightness > 232) {
        continue;
      }

      red += currentRed;
      green += currentGreen;
      blue += currentBlue;
      count += 1;
    }
  }

  if (count === 0) {
    return [245, 158, 11];
  }

  return [
    Math.round(red / count),
    Math.round(green / count),
    Math.round(blue / count)
  ];
}

function boostColor(color: Rgb): Rgb {
  const maxChannel = Math.max(color[0], color[1], color[2], 1);
  const scale = 210 / maxChannel;

  return [
    Math.max(60, Math.min(255, Math.round(color[0] * scale))),
    Math.max(60, Math.min(255, Math.round(color[1] * scale))),
    Math.max(60, Math.min(255, Math.round(color[2] * scale)))
  ];
}

function rgbToNumber(color: Rgb): number {
  return (color[0] << 16) + (color[1] << 8) + color[2];
}

function hashColor(input: string): number {
  let hash = 0;

  for (const char of input) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }

  const red = 90 + (hash & 0x5f);
  const green = 90 + ((hash >> 8) & 0x5f);
  const blue = 90 + ((hash >> 16) & 0x5f);

  return (red << 16) + (green << 8) + blue;
}
