import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { guildOnlyText, resolveGuildLanguage } from "../i18n";
import { createBotEmbed } from "../ui";

export function createResumeCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("resume")
      .setDescription("Reanuda la reproduccion."),
    async execute(interaction) {
      const language = await resolveGuildLanguage(context, interaction.guild?.id);

      if (!interaction.guild) {
        await interaction.reply({
          content: guildOnlyText(language),
          ephemeral: true
        });
        return;
      }

      const resumed = context.playbackManager.resume(interaction.guild.id);
      await context.playbackPanelService.refreshGuild(interaction.guild.id);
      await interaction.reply({
        embeds: [
          createBotEmbed(
            resumed
              ? language === "en" ? "Playback resumed" : "Reproduccion reanudada"
              : language === "en" ? "Nothing to resume" : "Nada para reanudar",
            resumed
              ? language === "en" ? "The player is playing again." : "El player volvio a sonar."
              : language === "en" ? "There was nothing paused." : "No habia nada pausado."
          )
        ]
      });
    }
  };
}
