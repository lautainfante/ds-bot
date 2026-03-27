import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { guildOnlyText, planLabel, resolveGuildLanguage } from "../i18n";
import { createBotEmbed, createUpgradeComponents } from "../ui";

export function createPlanCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("plan")
      .setDescription("Muestra el plan del servidor."),
    async execute(interaction) {
      const language = await resolveGuildLanguage(context, interaction.guild?.id);

      if (!interaction.guild) {
        await interaction.reply({
          content: guildOnlyText(language),
          ephemeral: true
        });
        return;
      }

      const plan = await context.accessService.getPlan(interaction.guild.id);
      const embed = createBotEmbed(
        language === "en" ? "Server plan" : "Plan del servidor",
        language === "en"
          ? `Current plan: **${planLabel(plan, language)}**`
          : `Plan actual: **${planLabel(plan, language)}**`,
        {
        fields: [
          {
            name: "Free",
            value: language === "en"
              ? "Playback, search, queue, pause, resume, skip and stop"
              : "Reproduccion, busqueda, cola, pause, resume, skip y stop"
          },
          {
            name: "Premium",
            value: language === "en"
              ? "Unlocks volume, bass and nightcore"
              : "Desbloquea volume, bass y nightcore"
          }
        ]
      });

      await interaction.reply({
        embeds: [embed],
        components: createUpgradeComponents(context.env.premiumPortalUrl)
      });
    }
  };
}
