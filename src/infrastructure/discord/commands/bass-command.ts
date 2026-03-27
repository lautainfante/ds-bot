import { SlashCommandBuilder } from "discord.js";
import { FeatureAccessError } from "../../../domain/errors/feature-access-error";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { guildOnlyText, premiumErrorMessage, resolveGuildLanguage } from "../i18n";

export function createBassCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("bass")
      .setDescription("Configura el bass boost. Premium.")
      .addIntegerOption((option) =>
        option
          .setName("value")
          .setDescription("Intensidad entre 0 y 20")
          .setMinValue(0)
          .setMaxValue(20)
          .setRequired(true)
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

      try {
        await context.accessService.ensureCapability(
          interaction.guild.id,
          "bass",
          context.env.premiumPortalUrl
        );
      } catch (error) {
        if (error instanceof FeatureAccessError) {
          await interaction.reply({
            content: premiumErrorMessage(language, error),
            ephemeral: true
          });
          return;
        }

        throw error;
      }

      const value = interaction.options.getInteger("value", true);
      const settings = await context.guildSettingsRepository.getByGuildId(interaction.guild.id);
      const updated = { ...settings, bassBoost: value };
      await context.guildSettingsRepository.save(updated);
      await context.playbackManager.setSettings(updated);

      await interaction.reply(
        language === "en" ? `Bass boost updated to ${value}.` : `Bass boost actualizado a ${value}.`
      );
    }
  };
}
