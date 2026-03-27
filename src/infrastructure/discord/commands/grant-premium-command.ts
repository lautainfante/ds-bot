import { SlashCommandBuilder } from "discord.js";
import { PlanTier } from "../../../domain/enums/plan-tier";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { guildOnlyText, planLabel, resolveGuildLanguage } from "../i18n";

export function createGrantPremiumCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("grant-premium")
      .setDescription("Otorga premium a este servidor. Solo owner.")
      .addBooleanOption((option) =>
        option
          .setName("enabled")
          .setDescription("Activa o desactiva premium")
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

      if (!context.env.discordOwnerId || interaction.user.id !== context.env.discordOwnerId) {
        await interaction.reply({
          content: language === "en" ? "Unauthorized." : "No autorizado.",
          ephemeral: true
        });
        return;
      }

      const enabled = interaction.options.getBoolean("enabled", true);
      await context.subscriptionRepository.setPlan(
        interaction.guild.id,
        enabled ? PlanTier.PREMIUM : PlanTier.FREE
      );

      await interaction.reply({
        content: language === "en"
          ? `Server plan updated to ${planLabel(enabled ? PlanTier.PREMIUM : PlanTier.FREE, language)}.`
          : `Plan del servidor actualizado a ${planLabel(enabled ? PlanTier.PREMIUM : PlanTier.FREE, language)}.`,
        ephemeral: true
      });
    }
  };
}
