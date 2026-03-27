import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { formatDuration } from "../command-helpers";
import { guildOnlyText, resolveGuildLanguage } from "../i18n";
import { createBotEmbed } from "../ui";

export function createQueueCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("queue")
      .setDescription("Muestra la cola actual."),
    async execute(interaction) {
      const language = await resolveGuildLanguage(context, interaction.guild?.id);

      if (!interaction.guild) {
        await interaction.reply({
          content: guildOnlyText(language),
          ephemeral: true
        });
        return;
      }

      const queue = context.playbackManager.getQueue(interaction.guild.id);

      if (!queue.current && queue.upcoming.length === 0) {
        await interaction.reply({
          embeds: [
            createBotEmbed(
              language === "en" ? "Queue is empty" : "Cola vacia",
              language === "en"
                ? "There is nothing queued right now."
                : "No hay nada en cola en este momento."
            )
          ]
        });
        return;
      }

      const embed = createBotEmbed(language === "en" ? "Playback queue" : "Cola de reproduccion");

      if (queue.current) {
        embed.addFields({
          name: language === "en" ? "Now playing" : "Ahora suena",
          value: `**${queue.current.title}**\n${formatDuration(queue.current.durationMs)}`
        });
      }

      embed.addFields({
        name: "Loop",
        value: queue.loopMode === "off"
          ? language === "en" ? "Off" : "Apagado"
          : queue.loopMode === "track"
            ? language === "en" ? "Track" : "Tema"
            : language === "en" ? "Queue" : "Cola",
        inline: true
      });

      embed.addFields({
        name: language === "en" ? "Status" : "Estado",
        value: queue.playerState,
        inline: true
      });

      const upcomingLines: string[] = [];

      for (const [index, track] of queue.upcoming.slice(0, 10).entries()) {
        upcomingLines.push(`${index + 1}. ${track.title} (${formatDuration(track.durationMs)})`);
      }

      if (upcomingLines.length > 0) {
        embed.addFields({
          name: language === "en"
            ? `Up next (${queue.upcoming.length})`
            : `Siguientes (${queue.upcoming.length})`,
          value: upcomingLines.join("\n")
        });
      }

      await interaction.reply({ embeds: [embed] });
    }
  };
}
