import assert from "node:assert/strict";
import test from "node:test";
import {
  extractYouTubePlaylistId,
  extractYouTubeVideoId,
  isYouTubeMusicUrl,
  normalizeYouTubeUrl
} from "./youtube-url";

test("normalizes YouTube Music URLs to the regular web domain", () => {
  assert.equal(
    normalizeYouTubeUrl("https://music.youtube.com/watch?v=abc12345678"),
    "https://www.youtube.com/watch?v=abc12345678"
  );
});

test("detects YouTube Music URLs", () => {
  assert.equal(isYouTubeMusicUrl("https://music.youtube.com/watch?v=abc12345678"), true);
  assert.equal(isYouTubeMusicUrl("https://www.youtube.com/watch?v=abc12345678"), false);
});

test("extracts YouTube video ids from common URL formats and raw ids", () => {
  assert.equal(
    extractYouTubeVideoId("https://www.youtube.com/watch?v=NzMMhOWNzkg"),
    "NzMMhOWNzkg"
  );
  assert.equal(
    extractYouTubeVideoId("https://youtu.be/NzMMhOWNzkg?si=test"),
    "NzMMhOWNzkg"
  );
  assert.equal(
    extractYouTubeVideoId("https://www.youtube.com/shorts/NzMMhOWNzkg"),
    "NzMMhOWNzkg"
  );
  assert.equal(
    extractYouTubeVideoId("https://www.youtube.com/live/NzMMhOWNzkg"),
    "NzMMhOWNzkg"
  );
  assert.equal(extractYouTubeVideoId("NzMMhOWNzkg"), "NzMMhOWNzkg");
});

test("extracts YouTube playlist ids from URLs and raw ids", () => {
  assert.equal(
    extractYouTubePlaylistId("https://www.youtube.com/playlist?list=PL1234567890abcdef"),
    "PL1234567890abcdef"
  );
  assert.equal(
    extractYouTubePlaylistId(
      "https://music.youtube.com/watch?v=NzMMhOWNzkg&list=OLAK5uy_kH9SMZ2hZx5-IoR5Td_a5weGPX3F1nQKY"
    ),
    "OLAK5uy_kH9SMZ2hZx5-IoR5Td_a5weGPX3F1nQKY"
  );
  assert.equal(
    extractYouTubePlaylistId("OLAK5uy_kH9SMZ2hZx5-IoR5Td_a5weGPX3F1nQKY"),
    "OLAK5uy_kH9SMZ2hZx5-IoR5Td_a5weGPX3F1nQKY"
  );
});
