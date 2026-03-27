import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { guildOnlyText, resolveGuildLanguage } from "../i18n";
import { createBotEmbed } from "../ui";

export function createSkipCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("skip")
      .setDescription("Salta la cancion actual."),
    async execute(interaction) {
      const language = await resolveGuildLanguage(context, interaction.guild?.id);

      if (!interaction.guild) {
        await interaction.reply({
          content: guildOnlyText(language),
          ephemeral: true
        });
        return;
      }

      const skipped = context.playbackManager.skip(interaction.guild.id);
      await context.playbackPanelService.refreshGuild(interaction.guild.id);
      await interaction.reply({
        embeds: [
          createBotEmbed(
            skipped
              ? language === "en" ? "Track skipped" : "Track salteado"
              : language === "en" ? "Nothing to skip" : "Nada para saltear",
            skipped
              ? language === "en" ? "The current song was skipped." : "La cancion actual fue salteada."
              : language === "en" ? "Nothing is currently playing." : "No hay nada reproduciendose."
          )
        ]
      });
    }
  };
}
