import {
  ChatInputCommandInteraction,
  Client,
  Message,
  TextBasedChannel
} from "discord.js";
import { GuildSettingsRepository } from "../../application/ports/repositories/guild-settings-repository";
import { GuildAccessService } from "../../application/services/guild-access-service";
import { Logger } from "../../shared/logger";
import { GuildPlaybackManager } from "../music/guild-playback-manager";
import {
  PLAYBACK_QUEUE_PAGE_SIZE,
  PlaybackLayout,
  createNowPlayingResponse
} from "./playback-ui";

interface PanelRegistration {
  channelId: string;
  messageId: string;
  page: number;
  layout: PlaybackLayout;
  intervalMs?: number;
  interval?: NodeJS.Timeout;
}

export class PlaybackPanelService {
  private readonly registrations = new Map<string, PanelRegistration>();

  constructor(
    private readonly client: Client,
    private readonly playbackManager: GuildPlaybackManager,
    private readonly accessService: GuildAccessService,
    private readonly guildSettingsRepository: GuildSettingsRepository,
    private readonly logger: Logger
  ) {}

  async registerFromInteractionReply(
    interaction: ChatInputCommandInteraction,
    guildId: string
  ): Promise<void> {
    if (this.registrations.has(guildId)) {
      await this.refreshGuild(guildId);
      return;
    }

    const reply = await interaction.fetchReply();

    if (!(reply instanceof Message) || !reply.guildId || !reply.channelId) {
      return;
    }

    await this.registerMessage(guildId, reply.channelId, reply.id, 0, "full");
  }

  hasDock(guildId: string): boolean {
    return this.registrations.has(guildId);
  }

  isDockMessage(guildId: string, messageId: string): boolean {
    return this.registrations.get(guildId)?.messageId === messageId;
  }

  async createOrMoveDock(
    interaction: ChatInputCommandInteraction,
    guildId: string
  ): Promise<void> {
    const snapshot = this.playbackManager.getQueue(guildId);
    const response = await createNowPlayingResponse(snapshot, {
      page: 0,
      layout: "dock",
      meta: await this.loadRenderMeta(guildId)
    });

    if (!interaction.channel?.isSendable()) {
      return;
    }

    const dockMessage = await interaction.channel.send(response);

    if (!dockMessage) {
      return;
    }

    await this.registerMessage(guildId, dockMessage.channelId, dockMessage.id, 0, "dock");
  }

  async refreshGuild(guildId: string): Promise<void> {
    const registration = this.registrations.get(guildId);

    if (!registration) {
      return;
    }

    const channel = await this.resolveChannel(registration.channelId);

    if (!channel) {
      this.clearRegistration(guildId);
      return;
    }

    try {
      const message = await channel.messages.fetch(registration.messageId);
      const snapshot = this.playbackManager.getQueue(guildId);
      const totalPages = Math.max(1, Math.ceil(snapshot.upcoming.length / PLAYBACK_QUEUE_PAGE_SIZE));
      registration.page = Math.max(0, Math.min(registration.page, totalPages - 1));

      await message.edit(
        await createNowPlayingResponse(snapshot, {
          page: registration.page,
          layout: registration.layout,
          meta: await this.loadRenderMeta(guildId)
        })
      );
      this.ensureInterval(guildId, registration, snapshot);
    } catch (error) {
      this.logger.warn("Playback panel refresh failed", {
        guildId,
        error: error instanceof Error ? error.message : "unknown"
      });
      this.clearRegistration(guildId);
    }
  }

  setPage(guildId: string, page: number): void {
    const registration = this.registrations.get(guildId);

    if (!registration) {
      return;
    }

    registration.page = Math.max(0, page);
  }

  changePage(guildId: string, delta: number): void {
    const registration = this.registrations.get(guildId);

    if (!registration) {
      return;
    }

    registration.page = Math.max(0, registration.page + delta);
  }

  getPage(guildId: string): number {
    return this.registrations.get(guildId)?.page ?? 0;
  }

  private async registerMessage(
    guildId: string,
    channelId: string,
    messageId: string,
    page: number,
    layout: PlaybackLayout
  ): Promise<void> {
    this.clearRegistration(guildId);

    const registration: PanelRegistration = {
      channelId,
      messageId,
      page,
      layout
    };

    this.registrations.set(guildId, registration);
    await this.refreshGuild(guildId);
  }

  private ensureInterval(
    guildId: string,
    registration: PanelRegistration,
    snapshot: ReturnType<GuildPlaybackManager["getQueue"]>
  ): void {
    const nextInterval = getRefreshInterval(snapshot);

    if (nextInterval === null) {
      if (registration.interval) {
        clearInterval(registration.interval);
        registration.interval = undefined;
        registration.intervalMs = undefined;
      }

      return;
    }

    if (registration.interval && registration.intervalMs === nextInterval) {
      return;
    }

    if (registration.interval) {
      clearInterval(registration.interval);
    }

    registration.intervalMs = nextInterval;
    registration.interval = setInterval(() => {
      void this.refreshGuild(guildId);
    }, nextInterval);
  }

  private clearRegistration(guildId: string): void {
    const existing = this.registrations.get(guildId);

    if (existing?.interval) {
      clearInterval(existing.interval);
    }

    this.registrations.delete(guildId);
  }

  private async resolveChannel(channelId: string): Promise<TextBasedChannel | null> {
    const cached = this.client.channels.cache.get(channelId);

    if (cached?.isTextBased()) {
      return cached;
    }

    const fetched = await this.client.channels.fetch(channelId).catch(() => null);
    return fetched && fetched.isTextBased() ? fetched : null;
  }

  private async loadRenderMeta(guildId: string) {
    const [plan, settings] = await Promise.all([
      this.accessService.getPlan(guildId),
      this.guildSettingsRepository.getByGuildId(guildId)
    ]);

    return { plan, settings, language: settings.language };
  }
}

function getRefreshInterval(snapshot: ReturnType<GuildPlaybackManager["getQueue"]>): number | null {
  if (snapshot.playerState === "playing") {
    return 2_000;
  }

  if (snapshot.playerState === "buffering") {
    return 1_500;
  }

  if (snapshot.isPaused) {
    return 10_000;
  }

  if (snapshot.current || snapshot.upcoming.length > 0) {
    return 6_000;
  }

  return null;
}
