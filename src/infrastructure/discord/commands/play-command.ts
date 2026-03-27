import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { formatDuration, requireVoiceChannel } from "../command-helpers";
import { resolveGuildLanguage } from "../i18n";
import { createNowPlayingResponse } from "../playback-ui";
import { createBotEmbed } from "../ui";

export function createPlayCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("play")
      .setDescription("Busca una cancion o reproduce una URL.")
      .addStringOption((option) =>
        option
          .setName("input")
          .setDescription("Busqueda o URL de YouTube o YouTube Music")
          .setRequired(true)
      ),
    async execute(interaction) {
      const voiceState = await requireVoiceChannel(interaction);

      if (!voiceState || !interaction.guild) {
        return;
      }

      const input = interaction.options.getString("input", true);
      await interaction.deferReply();
      const language = await resolveGuildLanguage(context, interaction.guild.id);

      const result = await context.playbackManager.play({
        guildId: interaction.guild.id,
        voiceChannelId: voiceState.voiceChannelId,
        adapterCreator: interaction.guild.voiceAdapterCreator as any,
        requestedBy: interaction.user.username,
        input
      });

      const first = result.tracks[0];
      const summaryEmbed = result.playlistTitle
        ? createBotEmbed(
            language === "en" ? "Playlist added" : "Playlist agregada",
            `**${result.playlistTitle}**`,
            {
            fields: [
              {
                name: language === "en" ? "Tracks" : "Tracks",
                value: String(result.tracks.length),
                inline: true
              },
              {
                name: language === "en" ? "Requested by" : "Pedido por",
                value: interaction.user.username,
                inline: true
              }
            ]
          }
          )
        : createBotEmbed(language === "en" ? "Added to queue" : "Agregado a la cola", `**${first.title}**`, {
            fields: [
              {
                name: language === "en" ? "Duration" : "Duracion",
                value: formatDuration(first.durationMs),
                inline: true
              },
              {
                name: language === "en" ? "Source" : "Fuente",
                value: first.source === "youtube_music" ? "YouTube Music" : "YouTube",
                inline: true
              },
              {
                name: language === "en" ? "Requested by" : "Pedido por",
                value: interaction.user.username,
                inline: true
              }
            ]
          });

      if (first.thumbnailUrl) {
        summaryEmbed.setThumbnail(first.thumbnailUrl);
      }

      const snapshot = context.playbackManager.getQueue(interaction.guild.id);
      const [plan, settings] = await Promise.all([
        context.accessService.getPlan(interaction.guild.id),
        context.guildSettingsRepository.getByGuildId(interaction.guild.id)
      ]);
      const hasDock = context.playbackPanelService.hasDock(interaction.guild.id);

      if (hasDock) {
        await interaction.editReply({
          embeds: [
            summaryEmbed.setFooter({
              text: language === "en"
                ? "The server dock was updated."
                : "El dock fijo del servidor ya fue actualizado."
            })
          ]
        });
        await context.playbackPanelService.refreshGuild(interaction.guild.id);
        return;
      }

      const nowPlayingResponse = await createNowPlayingResponse(snapshot, {
        layout: "full",
        meta: { plan, settings, language }
      });

      await interaction.editReply({
        embeds: [summaryEmbed, ...nowPlayingResponse.embeds],
        components: nowPlayingResponse.components
      });
      await context.playbackPanelService.registerFromInteractionReply(
        interaction,
        interaction.guild.id
      );
    }
  };
}
