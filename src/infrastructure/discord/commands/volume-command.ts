import { SlashCommandBuilder } from "discord.js";
import { FeatureAccessError } from "../../../domain/errors/feature-access-error";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { guildOnlyText, premiumErrorMessage, resolveGuildLanguage } from "../i18n";

export function createVolumeCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("volume")
      .setDescription("Configura el volumen. Premium.")
      .addIntegerOption((option) =>
        option
          .setName("value")
          .setDescription("Valor entre 1 y 150")
          .setMinValue(1)
          .setMaxValue(150)
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
          "volume",
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
      const updated = { ...settings, volume: value };
      await context.guildSettingsRepository.save(updated);
      await context.playbackManager.setSettings(updated);

      await interaction.reply(
        language === "en" ? `Volume updated to ${value}%.` : `Volumen actualizado a ${value}%.`
      );
    }
  };
}
