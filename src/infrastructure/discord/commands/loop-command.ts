import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { LoopMode } from "../../music/guild-playback-manager";
import { guildOnlyText, resolveGuildLanguage } from "../i18n";
import { createBotEmbed } from "../ui";

export function createLoopCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("loop")
      .setDescription("Configura el modo loop.")
      .addStringOption((option) =>
        option
          .setName("mode")
          .setDescription("Modo de loop")
          .setRequired(true)
          .addChoices(
            { name: "Apagado", value: "off" },
            { name: "Tema", value: "track" },
            { name: "Cola", value: "queue" }
          )
      ),
    async execute(interaction) {
      const language = await resolveGuildLanguage(context, interaction.guild?.id);

      if (!interaction.guild) {
        await interaction.reply({
          content: guildOnlyText(language),
          ephemeral: true
        });
        return;
      }

      const mode = interaction.options.getString("mode", true) as LoopMode;
      context.playbackManager.setLoopMode(interaction.guild.id, mode);
      await context.playbackPanelService.refreshGuild(interaction.guild.id);

      await interaction.reply({
        embeds: [
          createBotEmbed(
            language === "en" ? "Loop updated" : "Loop actualizado",
            language === "en"
              ? `Current mode: **${formatLoopLabel(mode, language)}**`
              : `Modo actual: **${formatLoopLabel(mode, language)}**`
          )
        ]
      });
    }
  };
}

function formatLoopLabel(mode: LoopMode, language: "es" | "en"): string {
  switch (mode) {
    case "track":
      return language === "en" ? "Track" : "Tema";
    case "queue":
      return language === "en" ? "Queue" : "Cola";
    default:
      return language === "en" ? "Off" : "Apagado";
  }
}
