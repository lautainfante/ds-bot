import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { guildOnlyText, resolveGuildLanguage } from "../i18n";
import { createBotEmbed } from "../ui";

export function createClearCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("clear")
      .setDescription("Limpia las canciones pendientes de la cola."),
    async execute(interaction) {
      const language = await resolveGuildLanguage(context, interaction.guild?.id);

      if (!interaction.guild) {
        await interaction.reply({
          content: guildOnlyText(language),
          ephemeral: true
        });
        return;
      }

      const cleared = context.playbackManager.clearQueue(interaction.guild.id);
      await context.playbackPanelService.refreshGuild(interaction.guild.id);

      await interaction.reply({
        embeds: [
          createBotEmbed(
            language === "en" ? "Queue cleared" : "Cola limpiada",
            cleared > 0
              ? language === "en"
                ? `Removed **${cleared}** queued tracks.`
                : `Se quitaron **${cleared}** canciones pendientes.`
              : language === "en"
                ? "There were no queued tracks to clear."
                : "No habia canciones pendientes para limpiar."
          )
        ]
      });
    }
  };
}
