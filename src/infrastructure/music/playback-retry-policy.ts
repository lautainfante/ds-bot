const MAX_EARLY_END_RETRIES = 3;
const MIN_REMAINING_MS_TO_RETRY = 12_000;
const MIN_COMPLETION_PROGRESS = 0.9;

export function isTrackCompletionPremature(durationMs: number, elapsedMs: number): boolean {
  if (durationMs <= 0) {
    return false;
  }

  const sanitizedElapsedMs = Math.max(0, elapsedMs);
  const remainingMs = Math.max(0, durationMs - sanitizedElapsedMs);
  const progress = sanitizedElapsedMs / durationMs;

  return remainingMs >= MIN_REMAINING_MS_TO_RETRY && progress < MIN_COMPLETION_PROGRESS;
}

export function shouldRetryEarlyEndedTrack(
  durationMs: number,
  elapsedMs: number,
  attemptCount: number
): boolean {
  return attemptCount < MAX_EARLY_END_RETRIES && isTrackCompletionPremature(durationMs, elapsedMs);
}
