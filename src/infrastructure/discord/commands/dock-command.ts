import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { guildOnlyText, resolveGuildLanguage } from "../i18n";
import { createBotEmbed } from "../ui";

export function createDockCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("dock")
      .setDescription("Crea o mueve el player dock fijo a este canal."),
    async execute(interaction) {
      const language = await resolveGuildLanguage(context, interaction.guild?.id);

      if (!interaction.guild) {
        await interaction.reply({
          content: guildOnlyText(language),
          ephemeral: true
        });
        return;
      }

      await interaction.reply({
        embeds: [
          createBotEmbed(
            language === "en" ? "Dock updated" : "Dock configurado",
            language === "en"
              ? "I will create or move the fixed player dock to this channel."
              : "Voy a crear o mover el player dock fijo a este canal."
          )
        ],
        ephemeral: true
      });

      await context.playbackPanelService.createOrMoveDock(interaction, interaction.guild.id);
    }
  };
}
