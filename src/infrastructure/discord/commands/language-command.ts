import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { GuildLanguage, guildOnlyText, languageLabel, resolveGuildLanguage } from "../i18n";
import { createBotEmbed } from "../ui";

export function createLanguageCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("language")
      .setDescription("Cambia el idioma del servidor.")
      .addStringOption((option) =>
        option
          .setName("value")
          .setDescription("Idioma del bot")
          .setRequired(true)
          .addChoices(
            { name: "Espanol", value: "es" },
            { name: "English", value: "en" }
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

      const value = interaction.options.getString("value", true) as GuildLanguage;
      const settings = await context.guildSettingsRepository.getByGuildId(interaction.guild.id);
      const updated = { ...settings, language: value };
      await context.guildSettingsRepository.save(updated);
      await context.playbackPanelService.refreshGuild(interaction.guild.id);

      const nextLanguage = value;
      await interaction.reply({
        embeds: [
          createBotEmbed(
            nextLanguage === "en" ? "Language updated" : "Idioma actualizado",
            nextLanguage === "en"
              ? `The server language is now **${languageLabel(nextLanguage, value)}**.`
              : `El idioma del servidor ahora es **${languageLabel(nextLanguage, value)}**.`
          )
        ]
      });
    }
  };
}
