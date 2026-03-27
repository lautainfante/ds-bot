import { AppEnv } from "../../config/env";
import { MusicSourceResolver } from "../../application/ports/services/music-source-resolver";
import { PlayDlSourceResolver } from "./play-dl-source-resolver";

export function createMusicSourceResolver(_env: AppEnv): MusicSourceResolver {
  return new PlayDlSourceResolver();
}
