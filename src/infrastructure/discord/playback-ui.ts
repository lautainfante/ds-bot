import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ColorResolvable,
  EmbedBuilder
} from "discord.js";
import { GuildSettings } from "../../domain/entities/guild-settings";
import { PlanTier } from "../../domain/enums/plan-tier";
import { QueueSnapshot } from "../music/guild-playback-manager";
import { formatDuration } from "./command-helpers";
import { GuildLanguage, normalizeGuildLanguage } from "./i18n";
import { getDominantColor } from "./thumbnail-theme";

export type PlaybackLayout = "dock" | "full";

export const PLAYBACK_QUEUE_PAGE_SIZE = 3;

export const PLAYBACK_BUTTON_IDS = {
  pause: "player:pause",
  resume: "player:resume",
  skip: "player:skip",
  stop: "player:stop",
  loop: "player:loop",
  shuffle: "player:shuffle",
  clear: "player:clear",
  removeNext: "player:remove-next",
  pagePrev: "player:page-prev",
  pageNext: "player:page-next",
  refresh: "player:refresh"
} as const;

interface PlaybackRenderMeta {
  plan?: PlanTier;
  settings?: GuildSettings;
  language?: GuildLanguage;
}

export async function createNowPlayingResponse(
  snapshot: QueueSnapshot,
  options: {
    page?: number;
    layout?: PlaybackLayout;
    meta?: PlaybackRenderMeta;
  } = {}
): Promise<{
  embeds: EmbedBuilder[];
  components: ActionRowBuilder<ButtonBuilder>[];
}> {
  const page = options.page ?? 0;
  const layout = options.layout ?? "full";
  const dominantColor = await getDominantColor(snapshot.current?.thumbnailUrl);
  const embedColor = resolveEmbedColor(snapshot, dominantColor);
  const language = normalizeGuildLanguage(options.meta?.language ?? options.meta?.settings?.language);

  return {
    embeds: [buildPlayerEmbed(snapshot, page, embedColor, layout, options.meta, language)],
    components: buildPlaybackControls(snapshot, page, layout, language)
  };
}

function buildPlayerEmbed(
  snapshot: QueueSnapshot,
  page: number,
  accentColor: number,
  layout: PlaybackLayout,
  meta: PlaybackRenderMeta | undefined,
  language: GuildLanguage
): EmbedBuilder {
  if (!snapshot.current) {
    return new EmbedBuilder()
      .setColor(accentColor as ColorResolvable)
      .setTitle(language === "en" ? "Now Playing" : "Reproduciendo ahora")
      .setDescription(
        language === "en"
          ? "Nothing is playing right now.\nUse `/play` to start the queue."
          : "No hay nada sonando.\nUsa `/play` para arrancar la cola."
      )
      .setTimestamp();
  }

  return layout === "dock"
    ? buildDockEmbed(snapshot, page, accentColor, meta, language)
    : buildFullEmbed(snapshot, page, accentColor, meta, language);
}

function buildDockEmbed(
  snapshot: QueueSnapshot,
  page: number,
  accentColor: number,
  meta: PlaybackRenderMeta | undefined,
  language: GuildLanguage
): EmbedBuilder {
  const queueData = getQueuePageData(snapshot, page);
  const embed = new EmbedBuilder()
    .setColor(accentColor as ColorResolvable)
    .setTitle(language === "en" ? "Now Playing" : "Reproduciendo ahora")
    .setDescription([
      `**${snapshot.current?.title ?? (language === "en" ? "Untitled" : "Sin titulo")}**`,
      "",
      buildStatusBadge(snapshot, language),
      "",
      buildNeonProgressDisplay(snapshot),
      "",
      queueData.hasQueue
        ? language === "en"
          ? `Next up: **${snapshot.upcoming[0]?.title ?? "Nothing queued"}**`
          : `Sigue: **${snapshot.upcoming[0]?.title ?? "Nada pendiente"}**`
        : language === "en"
          ? "*No queued tracks*"
          : "*Sin temas pendientes*"
    ].join("\n"))
    .addFields(
      {
        name: language === "en" ? "Requested by" : "Pedido por",
        value: snapshot.current?.requestedBy ?? (language === "en" ? "Unknown" : "Desconocido"),
        inline: true
      },
      {
        name: "Loop",
        value: formatLoopMode(snapshot.loopMode, language),
        inline: true
      },
      {
        name: language === "en" ? "Remaining" : "Restante",
        value: snapshot.current ? formatDuration(snapshot.remainingMs) : language === "en" ? "Unknown" : "Desconocido",
        inline: true
      }
    )
    .setFooter({
      text: queueData.hasQueue
        ? language === "en"
          ? `${snapshot.upcoming.length} track${snapshot.upcoming.length === 1 ? "" : "s"} in queue`
          : `${snapshot.upcoming.length} tema${snapshot.upcoming.length === 1 ? "" : "s"} en cola`
        : language === "en"
          ? "Use /play to add another track"
          : "Usa /play para sumar otro tema"
    })
    .setTimestamp();

  if (meta?.plan === PlanTier.PREMIUM && meta.settings) {
    embed.addFields({
      name: language === "en" ? "Premium" : "Premium",
      value: buildPremiumMeter(meta.settings, language),
      inline: false
    });
  }

  if (snapshot.current?.thumbnailUrl) {
    embed.setThumbnail(snapshot.current.thumbnailUrl);
  }

  return embed;
}

function buildFullEmbed(
  snapshot: QueueSnapshot,
  page: number,
  accentColor: number,
  meta: PlaybackRenderMeta | undefined,
  language: GuildLanguage
): EmbedBuilder {
  const queueData = getQueuePageData(snapshot, page);
  const fields = [
    {
      name: language === "en" ? "Status" : "Estado",
      value: formatPlayerState(snapshot, language),
      inline: true
    },
    {
      name: language === "en" ? "Requested by" : "Pedido por",
      value: snapshot.current?.requestedBy ?? (language === "en" ? "Unknown" : "Desconocido"),
      inline: true
    },
    {
      name: "Loop",
      value: formatLoopMode(snapshot.loopMode, language),
      inline: true
    },
    {
      name: language === "en" ? "Queue" : "En cola",
      value: String(snapshot.upcoming.length),
      inline: true
    },
    {
      name: language === "en" ? "Remaining" : "Restante",
      value: snapshot.current ? formatDuration(snapshot.remainingMs) : language === "en" ? "Unknown" : "Desconocido",
      inline: true
    },
    {
      name: language === "en" ? "Next" : "Siguiente",
      value: snapshot.upcoming[0]?.title ?? (language === "en" ? "Nothing queued" : "Nada pendiente"),
      inline: true
    }
  ];

  if (meta?.plan === PlanTier.PREMIUM && meta.settings) {
    fields.push({
      name: language === "en" ? "Premium profile" : "Perfil premium",
      value: buildPremiumMeter(meta.settings, language),
      inline: false
    });
  }

  if (queueData.hasQueue) {
    fields.push({
      name: queueData.totalPages > 1
        ? language === "en"
          ? `Queue • Page ${queueData.safePage + 1}/${queueData.totalPages}`
          : `Cola • Pagina ${queueData.safePage + 1}/${queueData.totalPages}`
        : language === "en"
          ? "Queue"
          : "Cola",
      value: buildQueuePreview(queueData.previewTracks, queueData.safePage, language),
      inline: false
    });
  }

  const embed = new EmbedBuilder()
    .setColor(accentColor as ColorResolvable)
    .setTitle(language === "en" ? "Now Playing" : "Reproduciendo ahora")
    .setDescription([
      `**${snapshot.current?.title ?? (language === "en" ? "Untitled" : "Sin titulo")}**`,
      "",
      buildStatusBadge(snapshot, language),
      "",
      buildNeonProgressDisplay(snapshot),
      "",
      queueData.hasQueue
        ? language === "en"
          ? `Next up: **${snapshot.upcoming[0]?.title ?? "Nothing queued"}**`
          : `Sigue: **${snapshot.upcoming[0]?.title ?? "Nada pendiente"}**`
        : language === "en"
          ? "*No queued tracks*"
          : "*Sin temas pendientes*"
    ].join("\n"))
    .addFields(fields)
    .setFooter({
      text: queueData.hasQueue
        ? language === "en"
          ? `${snapshot.upcoming.length} track${snapshot.upcoming.length === 1 ? "" : "s"} in queue`
          : `${snapshot.upcoming.length} tema${snapshot.upcoming.length === 1 ? "" : "s"} en cola`
        : language === "en"
          ? "Use /play to add another track"
          : "Usa /play para sumar otro tema"
    })
    .setTimestamp();

  if (snapshot.current?.thumbnailUrl) {
    embed.setImage(snapshot.current.thumbnailUrl);
  }

  return embed;
}

function getQueuePageData(snapshot: QueueSnapshot, page: number) {
  const totalPages = Math.max(1, Math.ceil(snapshot.upcoming.length / PLAYBACK_QUEUE_PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const previewTracks = snapshot.upcoming.slice(
    safePage * PLAYBACK_QUEUE_PAGE_SIZE,
    safePage * PLAYBACK_QUEUE_PAGE_SIZE + PLAYBACK_QUEUE_PAGE_SIZE
  );

  return {
    totalPages,
    safePage,
    previewTracks,
    hasQueue: snapshot.upcoming.length > 0
  };
}

function resolveEmbedColor(snapshot: QueueSnapshot, dominantColor: number): number {
  switch (snapshot.playerState) {
    case "paused":
      return 0xf59e0b;
    case "buffering":
      return 0x38bdf8;
    case "autopaused":
      return 0x94a3b8;
    case "playing":
      return dominantColor;
    default:
      return dominantColor;
  }
}

function buildStatusBadge(snapshot: QueueSnapshot, language: GuildLanguage): string {
  switch (snapshot.playerState) {
    case "paused":
      return language === "en" ? "`PAUSED` `AMBER`" : "`PAUSADO` `AMBAR`";
    case "buffering":
      return language === "en" ? "`BUFFERING` `BLUE`" : "`CARGANDO` `AZUL`";
    case "autopaused":
      return language === "en" ? "`AUTO PAUSED` `GRAY`" : "`AUTO PAUSA` `GRIS`";
    case "playing":
      return language === "en" ? "`PLAYING` `LIVE`" : "`REPRODUCIENDO` `LIVE`";
    default:
      return language === "en" ? "`IDLE`" : "`EN ESPERA`";
  }
}

function buildPremiumMeter(settings: GuildSettings, language: GuildLanguage): string {
  const volumeRatio = Math.max(0, Math.min(1, settings.volume / 150));
  const bassRatio = Math.max(0, Math.min(1, settings.bassBoost / 20));

  return [
    `${language === "en" ? "Vol" : "Vol"} ${settings.volume}% ${buildMiniMeter(volumeRatio)}`,
    `${language === "en" ? "Bass" : "Bass"} ${settings.bassBoost} ${buildMiniMeter(bassRatio)}`,
    `${language === "en" ? "Nightcore" : "Nightcore"} ${settings.nightcore
      ? language === "en" ? "enabled" : "activo"
      : language === "en" ? "off" : "apagado"}`
  ].join("\n");
}

function buildMiniMeter(ratio: number): string {
  const segments = 5;
  const filled = Math.round(ratio * segments);
  return `${"▰".repeat(filled)}${"▱".repeat(Math.max(0, segments - filled))}`;
}

function buildPlaybackControls(
  snapshot: QueueSnapshot,
  page: number,
  layout: PlaybackLayout,
  language: GuildLanguage
): ActionRowBuilder<ButtonBuilder>[] {
  const hasCurrent = Boolean(snapshot.current);
  const totalPages = Math.max(1, Math.ceil(snapshot.upcoming.length / PLAYBACK_QUEUE_PAGE_SIZE));
  const safePage = Math.max(0, Math.min(page, totalPages - 1));
  const rows: ActionRowBuilder<ButtonBuilder>[] = [];
  const primaryButtons: ButtonBuilder[] = [];

  if (snapshot.isPaused) {
    primaryButtons.push(
      new ButtonBuilder()
        .setCustomId(PLAYBACK_BUTTON_IDS.resume)
        .setLabel(language === "en" ? "Resume" : "Reanudar")
        .setStyle(ButtonStyle.Success)
        .setDisabled(!hasCurrent)
    );
  } else {
    primaryButtons.push(
      new ButtonBuilder()
        .setCustomId(PLAYBACK_BUTTON_IDS.pause)
        .setLabel(language === "en" ? "Pause" : "Pausar")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(!hasCurrent)
    );
  }

  primaryButtons.push(
    new ButtonBuilder()
      .setCustomId(PLAYBACK_BUTTON_IDS.skip)
      .setLabel(language === "en" ? "Skip" : "Saltar")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(!hasCurrent),
    new ButtonBuilder()
      .setCustomId(PLAYBACK_BUTTON_IDS.stop)
      .setLabel(language === "en" ? "Stop" : "Detener")
      .setStyle(ButtonStyle.Danger)
      .setDisabled(!hasCurrent)
  );

  if (layout === "dock" && snapshot.upcoming.length === 0) {
    primaryButtons.push(
      new ButtonBuilder()
        .setCustomId(PLAYBACK_BUTTON_IDS.loop)
        .setLabel(`Loop: ${formatLoopMode(snapshot.loopMode, language)}`)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(PLAYBACK_BUTTON_IDS.refresh)
        .setLabel(language === "en" ? "Refresh" : "Actualizar")
        .setStyle(ButtonStyle.Secondary)
    );

    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(primaryButtons));
    return rows;
  }

  primaryButtons.push(
    new ButtonBuilder()
      .setCustomId(PLAYBACK_BUTTON_IDS.refresh)
      .setLabel(language === "en" ? "Refresh" : "Actualizar")
      .setStyle(ButtonStyle.Secondary)
  );

  rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(primaryButtons));

  const secondaryButtons: ButtonBuilder[] = [
    new ButtonBuilder()
      .setCustomId(PLAYBACK_BUTTON_IDS.loop)
      .setLabel(`Loop: ${formatLoopMode(snapshot.loopMode, language)}`)
      .setStyle(ButtonStyle.Secondary)
  ];

  if (snapshot.upcoming.length >= 2) {
    secondaryButtons.push(
      new ButtonBuilder()
        .setCustomId(PLAYBACK_BUTTON_IDS.shuffle)
        .setLabel(language === "en" ? "Shuffle" : "Mezclar")
        .setStyle(ButtonStyle.Secondary)
    );
  }

  if (snapshot.upcoming.length > 0) {
    secondaryButtons.push(
      new ButtonBuilder()
        .setCustomId(PLAYBACK_BUTTON_IDS.clear)
        .setLabel(language === "en" ? "Clear" : "Limpiar")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(PLAYBACK_BUTTON_IDS.removeNext)
        .setLabel(language === "en" ? "Remove next" : "Quitar siguiente")
        .setStyle(ButtonStyle.Secondary)
    );
  }

  if (secondaryButtons.length > 0) {
    rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(secondaryButtons.slice(0, 5)));
  }

  if (totalPages > 1) {
    rows.push(
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId(`${PLAYBACK_BUTTON_IDS.pagePrev}:${safePage}`)
          .setLabel(language === "en" ? "Previous" : "Anterior")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage === 0),
        new ButtonBuilder()
          .setCustomId(`${PLAYBACK_BUTTON_IDS.pageNext}:${safePage}`)
          .setLabel(language === "en" ? "Next" : "Siguiente")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(safePage >= totalPages - 1)
      )
    );
  }

  return rows;
}

function buildNeonProgressDisplay(snapshot: QueueSnapshot): string {
  if (!snapshot.current || snapshot.current.durationMs <= 0) {
    return "Progreso no disponible";
  }

  const segments = 22;
  const ratio = Math.min(1, snapshot.elapsedMs / snapshot.current.durationMs);
  const markerIndex = Math.min(segments - 1, Math.max(0, Math.round(ratio * (segments - 1))));
  let bar = "";

  for (let index = 0; index < segments; index += 1) {
    if (index === markerIndex) {
      bar += "\u25c9";
      continue;
    }

    bar += index < markerIndex ? "\u2501" : "\u2500";
  }

  return `${formatDuration(snapshot.elapsedMs)}  ${bar}  ${formatDuration(snapshot.current.durationMs)}`;
}

function buildQueuePreview(
  tracks: QueueSnapshot["upcoming"],
  page: number,
  language: GuildLanguage
): string {
  return tracks
    .map(
      (track, index) =>
        `**${page * PLAYBACK_QUEUE_PAGE_SIZE + index + 1}.** ${track.title} ${language === "en" ? "•" : "•"} ${formatDuration(track.durationMs)}`
    )
    .join("\n");
}

function formatPlayerState(snapshot: QueueSnapshot, language: GuildLanguage): string {
  if (!snapshot.current) {
    return language === "en" ? "Idle" : "En espera";
  }

  switch (snapshot.playerState) {
    case "playing":
      return language === "en" ? "Playing" : "Reproduciendo";
    case "paused":
      return language === "en" ? "Paused" : "Pausado";
    case "buffering":
      return language === "en" ? "Buffering" : "Cargando";
    case "autopaused":
      return language === "en" ? "Auto paused" : "Auto pausa";
    default:
      return language === "en" ? "Idle" : "En espera";
  }
}

function formatLoopMode(mode: QueueSnapshot["loopMode"], language: GuildLanguage): string {
  switch (mode) {
    case "track":
      return language === "en" ? "Track" : "Tema";
    case "queue":
      return language === "en" ? "Queue" : "Cola";
    default:
      return language === "en" ? "Off" : "Apagado";
  }
}
