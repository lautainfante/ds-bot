import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { resolveGuildLanguage } from "../i18n";

export function createPingCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("ping")
      .setDescription("Comprueba si el bot esta vivo."),
    async execute(interaction) {
      const language = await resolveGuildLanguage(context, interaction.guild?.id);
      await interaction.reply(language === "en" ? "Pong." : "Pong.");
    }
  };
}
