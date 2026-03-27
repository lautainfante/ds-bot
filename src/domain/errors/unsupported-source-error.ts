import { TrackSource } from "../entities/track";

export class UnsupportedSourceError extends Error {
  constructor(
    public readonly source: TrackSource | "search",
    message: string,
    public readonly documentationUrl?: string
  ) {
    super(message);
    this.name = "UnsupportedSourceError";
  }
}
