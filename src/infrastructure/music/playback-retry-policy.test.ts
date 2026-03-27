import assert from "node:assert/strict";
import test from "node:test";
import {
  isTrackCompletionPremature,
  shouldRetryEarlyEndedTrack
} from "./playback-retry-policy";

test("retries once when a track ends well before its duration", () => {
  assert.equal(shouldRetryEarlyEndedTrack(180_000, 45_000, 0), true);
  assert.equal(shouldRetryEarlyEndedTrack(180_000, 45_000, 1), false);
});

test("does not retry when the track was almost complete", () => {
  assert.equal(isTrackCompletionPremature(180_000, 170_000), false);
  assert.equal(shouldRetryEarlyEndedTrack(180_000, 170_000, 0), false);
});

test("does not retry when very little time remained", () => {
  assert.equal(isTrackCompletionPremature(60_000, 50_500), false);
  assert.equal(shouldRetryEarlyEndedTrack(60_000, 50_500, 0), false);
});
