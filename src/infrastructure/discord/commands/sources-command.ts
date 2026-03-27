import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { resolveGuildLanguage } from "../i18n";
import { createBotEmbed } from "../ui";

export function createSourcesCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("sources")
      .setDescription("Muestra el estado de integracion por proveedor."),
    async execute(interaction) {
      const language = await resolveGuildLanguage(context, interaction.guild?.id);
      await interaction.reply({
        embeds: [
          createBotEmbed(
            language === "en" ? "Available sources" : "Fuentes disponibles",
            language === "en"
              ? "Current source status by provider."
              : "Estado actual del bot por proveedor.",
            {
            fields: [
              {
                name: language === "en" ? "Enabled" : "Habilitadas",
                value: ["YouTube", "YouTube Music (`music.youtube.com`)"].join("\n")
              },
              {
                name: language === "en" ? "Disabled" : "Deshabilitadas",
                value: ["Spotify", "SoundCloud"].join("\n")
              }
            ]
          })
        ]
      });
    }
  };
}
