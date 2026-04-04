import { AppEnv } from "../../config/env";
import { MusicSourceResolver } from "../../application/ports/services/music-source-resolver";
import { YouTubeSourceResolver } from "./youtube-source-resolver";

export function createMusicSourceResolver(_env: AppEnv): MusicSourceResolver {
  return new YouTubeSourceResolver();
}
