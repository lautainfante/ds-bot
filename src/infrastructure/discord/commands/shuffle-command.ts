import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { guildOnlyText, resolveGuildLanguage } from "../i18n";
import { createBotEmbed } from "../ui";

export function createShuffleCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("shuffle")
      .setDescription("Mezcla las canciones pendientes de la cola."),
    async execute(interaction) {
      const language = await resolveGuildLanguage(context, interaction.guild?.id);

      if (!interaction.guild) {
        await interaction.reply({
          content: guildOnlyText(language),
          ephemeral: true
        });
        return;
      }

      const shuffled = context.playbackManager.shuffleQueue(interaction.guild.id);
      await context.playbackPanelService.refreshGuild(interaction.guild.id);

      await interaction.reply({
        embeds: [
          createBotEmbed(
            language === "en" ? "Queue shuffled" : "Cola mezclada",
            shuffled > 0
              ? language === "en"
                ? `Shuffled **${shuffled}** queued tracks.`
                : `Se mezclaron **${shuffled}** canciones pendientes.`
              : language === "en"
                ? "There were no queued tracks to shuffle."
                : "No habia canciones pendientes para mezclar."
          )
        ]
      });
    }
  };
}
