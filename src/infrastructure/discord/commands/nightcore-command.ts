import { SlashCommandBuilder } from "discord.js";
import { FeatureAccessError } from "../../../domain/errors/feature-access-error";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { guildOnlyText, premiumErrorMessage, resolveGuildLanguage } from "../i18n";

export function createNightcoreCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("nightcore")
      .setDescription("Activa o desactiva nightcore. Premium.")
      .addBooleanOption((option) =>
        option
          .setName("enabled")
          .setDescription("Activa o desactiva el modo")
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
          "nightcore",
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

      const enabled = interaction.options.getBoolean("enabled", true);
      const settings = await context.guildSettingsRepository.getByGuildId(interaction.guild.id);
      const updated = { ...settings, nightcore: enabled };
      await context.guildSettingsRepository.save(updated);
      await context.playbackManager.setSettings(updated);

      await interaction.reply(
        language === "en"
          ? `Nightcore ${enabled ? "enabled" : "disabled"}.`
          : `Nightcore ${enabled ? "activado" : "desactivado"}.`
      );
    }
  };
}
