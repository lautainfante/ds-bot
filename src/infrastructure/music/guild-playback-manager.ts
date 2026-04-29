import {
  AudioPlayer,
  AudioPlayerStatus,
  DiscordGatewayAdapterCreator,
  NoSubscriberBehavior,
  VoiceConnection,
  VoiceConnectionDisconnectReason,
  VoiceConnectionStatus,
  createAudioPlayer,
  entersState,
  getVoiceConnection,
  joinVoiceChannel
} from "@discordjs/voice";
import { GuildSettingsRepository } from "../../application/ports/repositories/guild-settings-repository";
import { MusicSourceResolver } from "../../application/ports/services/music-source-resolver";
import { TrackAudioFactory } from "../../application/ports/services/track-audio-factory";
import { GuildSettings } from "../../domain/entities/guild-settings";
import { Track } from "../../domain/entities/track";
import { UserFacingError } from "../../domain/errors/user-facing-error";
import { Logger } from "../../shared/logger";
import {
  isTrackCompletionPremature,
  shouldRetryEarlyEndedTrack
} from "./playback-retry-policy";

export interface PlaybackRequest {
  guildId: string;
  voiceChannelId: string;
  adapterCreator: DiscordGatewayAdapterCreator;
  requestedBy: string;
  input: string;
}

export type LoopMode = "off" | "track" | "queue";

export interface QueueSnapshot {
  current?: Track;
  upcoming: Track[];
  loopMode: LoopMode;
  playerState: AudioPlayerStatus | "unknown";
  elapsedMs: number;
  remainingMs: number;
  isPaused: boolean;
}

const IDLE_DISCONNECT_MS = 5 * 60 * 1000; // 5 minutos sin musica -> el bot se va

class PlaybackSession {
  private readonly queue: Track[] = [];
  private readonly player: AudioPlayer;
  private connection?: VoiceConnection;
  private settings: GuildSettings;
  private currentTrack?: Track;
  private currentVolumeController?: { setVolume(value: number): void };
  private currentTrackStartedAt?: number;
  private pausedAt?: number;
  private pausedDurationMs = 0;
  private loopMode: LoopMode = "off";
  private skipRequested = false;
  private readonly retryAttempts = new WeakMap<Track, number>();
  private idleTimer?: NodeJS.Timeout;

  constructor(
    private readonly guildId: string,
    initialSettings: GuildSettings,
    private readonly audioFactory: TrackAudioFactory,
    private readonly logger: Logger,
    private readonly onAutoDisconnect?: () => void
  ) {
    this.settings = initialSettings;
    this.player = createAudioPlayer({
      behaviors: {
        // Mantenemos el resource encodando aunque la conexion de voz tenga un
        // blip momentaneo. Con `Pause` el buffer se vacia y discord.js manda al
        // player a Idle, lo que se ve como un track que termina antes de tiempo.
        noSubscriber: NoSubscriberBehavior.Play
      }
    });

    this.player.on(AudioPlayerStatus.Idle, () => {
      const finishedTrack = this.currentTrack;
      const elapsedMs = this.getElapsedMs();
      const retryAttemptCount = finishedTrack ? this.retryAttempts.get(finishedTrack) ?? 0 : 0;
      const endedPrematurely = finishedTrack
        ? isTrackCompletionPremature(finishedTrack.durationMs, elapsedMs)
        : false;
      const shouldRetry = finishedTrack && !this.skipRequested
        ? shouldRetryEarlyEndedTrack(finishedTrack.durationMs, elapsedMs, retryAttemptCount)
        : false;

      if (finishedTrack && shouldRetry) {
        const nextAttempt = retryAttemptCount + 1;
        this.retryAttempts.set(finishedTrack, nextAttempt);
        this.queue.unshift(finishedTrack);
        this.logger.warn("Track ended early, retrying", {
          guildId: this.guildId,
          track: finishedTrack.title,
          elapsedMs,
          durationMs: finishedTrack.durationMs,
          retryAttempt: nextAttempt
        });
      } else if (finishedTrack) {
        this.retryAttempts.delete(finishedTrack);

        if (endedPrematurely && !this.skipRequested) {
          this.logger.warn("Track ended early, skipping after retry budget", {
            guildId: this.guildId,
            track: finishedTrack.title,
            elapsedMs,
            durationMs: finishedTrack.durationMs
          });
        } else if (!this.skipRequested) {
          if (this.loopMode === "track") {
            this.queue.unshift(finishedTrack);
          } else if (this.loopMode === "queue") {
            this.queue.push(finishedTrack);
          }
        }
      }

      this.skipRequested = false;
      this.currentTrack = undefined;
      this.currentVolumeController = undefined;
      this.currentTrackStartedAt = undefined;
      this.pausedAt = undefined;
      this.pausedDurationMs = 0;
      void this.playNext().then(() => {
        if (!this.currentTrack && this.queue.length === 0) {
          this.scheduleIdleDisconnect();
        }
      });
    });

    this.player.on("stateChange", (oldState, newState) => {
      if (
        oldState.status !== AudioPlayerStatus.Playing &&
        newState.status === AudioPlayerStatus.Playing &&
        !this.currentTrackStartedAt
      ) {
        this.currentTrackStartedAt = Date.now();
      }

      if (
        oldState.status !== AudioPlayerStatus.Paused &&
        newState.status === AudioPlayerStatus.Paused
      ) {
        this.pausedAt = Date.now();
      }

      if (
        oldState.status === AudioPlayerStatus.Paused &&
        newState.status !== AudioPlayerStatus.Paused &&
        this.pausedAt
      ) {
        this.pausedDurationMs += Date.now() - this.pausedAt;
        this.pausedAt = undefined;
      }

      this.logger.info("Audio player state change", {
        guildId: this.guildId,
        from: oldState.status,
        to: newState.status,
        track: this.currentTrack?.title
      });
    });

    this.player.on("error", (error) => {
      this.logger.error("Player error", {
        guildId: this.guildId,
        error: error.message
      });

      this.currentTrack = undefined;
      this.currentVolumeController = undefined;
      void this.playNext();
    });
  }

  async connect(
    voiceChannelId: string,
    adapterCreator: DiscordGatewayAdapterCreator
  ): Promise<void> {
    if (
      this.connection?.state.status === VoiceConnectionStatus.Ready &&
      this.connection.joinConfig.channelId === voiceChannelId
    ) {
      return;
    }

    this.connection?.destroy();
    getVoiceConnection(this.guildId)?.destroy();

    const connection = joinVoiceChannel({
      channelId: voiceChannelId,
      guildId: this.guildId,
      adapterCreator,
      selfDeaf: true,
      debug: true
    });

    connection.on("debug", (message) => {
      this.logger.info("Voice connection debug", {
        guildId: this.guildId,
        message
      });
    });

    connection.on("stateChange", (oldState, newState) => {
      this.logger.info("Voice connection state change", {
        guildId: this.guildId,
        from: oldState.status,
        to: newState.status
      });
    });

    connection.on("error", (error) => {
      this.logger.error("Voice connection error", {
        guildId: this.guildId,
        error: error.message
      });
    });

    try {
      await entersState(connection, VoiceConnectionStatus.Ready, 30_000);
    } catch (error) {
      this.logger.error("Voice connection failed", {
        guildId: this.guildId,
        status: connection.state.status,
        reason: "reason" in connection.state ? connection.state.reason : undefined,
        closeCode: "closeCode" in connection.state ? connection.state.closeCode : undefined,
        error: error instanceof Error ? error.message : "unknown"
      });

      if (
        connection.state.status === VoiceConnectionStatus.Disconnected &&
        "reason" in connection.state &&
        connection.state.reason === VoiceConnectionDisconnectReason.AdapterUnavailable
      ) {
        connection.destroy();
        throw new UserFacingError(
          "Discord no habilito la conexion de voz para el bot en este servidor. Sali y volve a entrar al canal y reintenta."
        );
      }

      connection.destroy();
      throw new UserFacingError(
        "No pude conectarme al canal de voz. Revisa permisos del bot, capacidad del canal y vuelve a intentar."
      );
    }

    connection.subscribe(this.player);
    this.connection = connection;
  }

  async enqueue(tracks: Track[]): Promise<void> {
    this.queue.push(...tracks);
    this.cancelIdleDisconnect();

    if (!this.currentTrack) {
      await this.playNext();
    }
  }

  private scheduleIdleDisconnect(): void {
    this.cancelIdleDisconnect();

    this.idleTimer = setTimeout(() => {
      this.idleTimer = undefined;

      if (this.currentTrack || this.queue.length > 0) {
        return;
      }

      this.logger.info("Auto-disconnecting after idle period", {
        guildId: this.guildId,
        idleMs: IDLE_DISCONNECT_MS
      });

      this.stop();
      this.onAutoDisconnect?.();
    }, IDLE_DISCONNECT_MS);

    if (typeof this.idleTimer.unref === "function") {
      this.idleTimer.unref();
    }
  }

  private cancelIdleDisconnect(): void {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = undefined;
    }
  }

  async updateSettings(settings: GuildSettings): Promise<void> {
    const shouldReplayCurrent =
      this.settings.bassBoost !== settings.bassBoost ||
      this.settings.nightcore !== settings.nightcore ||
      this.settings.volume !== settings.volume;

    this.settings = settings;

    if (shouldReplayCurrent && this.currentTrack) {
      this.retryAttempts.delete(this.currentTrack);
      this.queue.unshift(this.currentTrack);
      this.currentTrack = undefined;
      this.player.stop(true);
    }
  }

  skip(): boolean {
    if (this.currentTrack) {
      this.retryAttempts.delete(this.currentTrack);
    }
    this.skipRequested = true;
    return this.player.stop(true);
  }

  stop(): void {
    this.queue.length = 0;
    if (this.currentTrack) {
      this.retryAttempts.delete(this.currentTrack);
    }
    this.currentTrack = undefined;
    this.currentVolumeController = undefined;
    this.currentTrackStartedAt = undefined;
    this.pausedAt = undefined;
    this.pausedDurationMs = 0;
    this.skipRequested = false;
    this.cancelIdleDisconnect();
    this.player.stop(true);
    this.connection?.destroy();
    this.connection = undefined;
  }

  pause(): boolean {
    return this.player.pause();
  }

  resume(): boolean {
    return this.player.unpause();
  }

  snapshot(): QueueSnapshot {
    const elapsedMs = this.getElapsedMs();
    const remainingMs = this.currentTrack
      ? Math.max(0, this.currentTrack.durationMs - elapsedMs)
      : 0;

    return {
      current: this.currentTrack,
      upcoming: [...this.queue],
      loopMode: this.loopMode,
      playerState: this.player.state.status,
      elapsedMs,
      remainingMs,
      isPaused: this.player.state.status === AudioPlayerStatus.Paused
    };
  }

  setLoopMode(mode: LoopMode): void {
    this.loopMode = mode;
  }

  removeUpcoming(position: number): Track | null {
    if (position < 1 || position > this.queue.length) {
      return null;
    }

    return this.queue.splice(position - 1, 1)[0] ?? null;
  }

  clearUpcoming(): number {
    const cleared = this.queue.length;
    this.queue.length = 0;
    return cleared;
  }

  shuffleUpcoming(): number {
    for (let index = this.queue.length - 1; index > 0; index -= 1) {
      const randomIndex = Math.floor(Math.random() * (index + 1));
      [this.queue[index], this.queue[randomIndex]] = [this.queue[randomIndex], this.queue[index]];
    }

    return this.queue.length;
  }

  private async playNext(): Promise<void> {
    const nextTrack = this.queue.shift();

    if (!nextTrack) {
      this.currentVolumeController = undefined;
      return;
    }

    // Si habia un timer de auto-disconnect en marcha, lo cancelamos: hay
    // musica nueva que reproducir.
    this.cancelIdleDisconnect();

    this.currentTrack = nextTrack;
    this.currentTrackStartedAt = undefined;
    this.pausedAt = undefined;
    this.pausedDurationMs = 0;

    try {
      const resource = await this.audioFactory.create(nextTrack, this.settings);
      this.currentVolumeController = resource.volume ?? undefined;
      this.player.play(resource);
    } catch (error) {
      this.logger.error("Failed to start track", {
        guildId: this.guildId,
        track: nextTrack.title,
        url: nextTrack.audioUrl,
        error: error instanceof Error ? error.message : "unknown",
        stack: error instanceof Error ? error.stack : undefined
      });

      this.currentTrack = undefined;
      this.currentTrackStartedAt = undefined;
      this.pausedAt = undefined;
      this.pausedDurationMs = 0;
      await this.playNext();
    }
  }

  private getElapsedMs(): number {
    if (!this.currentTrack || !this.currentTrackStartedAt) {
      return 0;
    }

    const playbackEndedAt = this.pausedAt ?? Date.now();
    const elapsed = playbackEndedAt - this.currentTrackStartedAt - this.pausedDurationMs;
    return Math.max(0, elapsed);
  }
}

export class GuildPlaybackManager {
  private readonly sessions = new Map<string, PlaybackSession>();

  constructor(
    private readonly guildSettingsRepository: GuildSettingsRepository,
    private readonly sourceResolver: MusicSourceResolver,
    private readonly audioFactory: TrackAudioFactory,
    private readonly logger: Logger
  ) {}

  async play(request: PlaybackRequest): Promise<{ tracks: Track[]; playlistTitle?: string }> {
    const settings = await this.guildSettingsRepository.getByGuildId(request.guildId);
    const session = this.getOrCreateSession(request.guildId, settings);
    const resolved = await this.sourceResolver.resolve(request.input, request.requestedBy);
    await session.connect(request.voiceChannelId, request.adapterCreator);
    await session.enqueue(resolved.tracks);

    return resolved;
  }

  async setSettings(settings: GuildSettings): Promise<void> {
    const session = this.sessions.get(settings.guildId);

    if (!session) {
      return;
    }

    await session.updateSettings(settings);
  }

  skip(guildId: string): boolean {
    return this.sessions.get(guildId)?.skip() ?? false;
  }

  stop(guildId: string): boolean {
    const session = this.sessions.get(guildId);

    if (!session) {
      return false;
    }

    session.stop();
    this.sessions.delete(guildId);
    return true;
  }

  pause(guildId: string): boolean {
    return this.sessions.get(guildId)?.pause() ?? false;
  }

  resume(guildId: string): boolean {
    return this.sessions.get(guildId)?.resume() ?? false;
  }

  setLoopMode(guildId: string, mode: LoopMode): LoopMode {
    const settings = this.guildSettingsRepository.getByGuildId(guildId);
    const session = this.sessions.get(guildId);

    if (session) {
      session.setLoopMode(mode);
      return mode;
    }

    void settings.then((resolvedSettings) => {
      this.getOrCreateSession(guildId, resolvedSettings).setLoopMode(mode);
    });

    return mode;
  }

  removeFromQueue(guildId: string, position: number): Track | null {
    return this.sessions.get(guildId)?.removeUpcoming(position) ?? null;
  }

  clearQueue(guildId: string): number {
    return this.sessions.get(guildId)?.clearUpcoming() ?? 0;
  }

  shuffleQueue(guildId: string): number {
    return this.sessions.get(guildId)?.shuffleUpcoming() ?? 0;
  }

  getQueue(guildId: string): QueueSnapshot {
    const session = this.sessions.get(guildId);

    if (!session) {
      return {
        current: undefined,
        upcoming: [],
        loopMode: "off",
        playerState: "unknown",
        elapsedMs: 0,
        remainingMs: 0,
        isPaused: false
      };
    }

    return session.snapshot();
  }

  private getOrCreateSession(guildId: string, settings: GuildSettings): PlaybackSession {
    const existing = this.sessions.get(guildId);

    if (existing) {
      return existing;
    }

    const created = new PlaybackSession(
      guildId,
      settings,
      this.audioFactory,
      this.logger,
      () => {
        // Cuando la session se desconecta sola por inactividad, la sacamos
        // del map para que la proxima reproduccion arranque limpia.
        this.sessions.delete(guildId);
      }
    );
    this.sessions.set(guildId, created);
    return created;
  }
}
