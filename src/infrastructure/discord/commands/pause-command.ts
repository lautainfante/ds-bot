import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { guildOnlyText, resolveGuildLanguage } from "../i18n";
import { createBotEmbed } from "../ui";

export function createPauseCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("pause")
      .setDescription("Pausa la reproduccion."),
    async execute(interaction) {
      const language = await resolveGuildLanguage(context, interaction.guild?.id);

      if (!interaction.guild) {
        await interaction.reply({
          content: guildOnlyText(language),
          ephemeral: true
        });
        return;
      }

      const paused = context.playbackManager.pause(interaction.guild.id);
      await context.playbackPanelService.refreshGuild(interaction.guild.id);
      await interaction.reply({
        embeds: [
          createBotEmbed(
            paused
              ? language === "en" ? "Playback paused" : "Reproduccion pausada"
              : language === "en" ? "Nothing to pause" : "Nada para pausar",
            paused
              ? language === "en" ? "The player is now paused." : "El player quedo en pausa."
              : language === "en" ? "There was no audio playing." : "No habia audio reproduciendose."
          )
        ]
      });
    }
  };
}
