import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { guildOnlyText, resolveGuildLanguage } from "../i18n";
import { createBotEmbed } from "../ui";

export function createStopCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("stop")
      .setDescription("Detiene la reproduccion y limpia la cola."),
    async execute(interaction) {
      const language = await resolveGuildLanguage(context, interaction.guild?.id);

      if (!interaction.guild) {
        await interaction.reply({
          content: guildOnlyText(language),
          ephemeral: true
        });
        return;
      }

      const stopped = context.playbackManager.stop(interaction.guild.id);
      await context.playbackPanelService.refreshGuild(interaction.guild.id);
      await interaction.reply({
        embeds: [
          createBotEmbed(
            stopped
              ? language === "en" ? "Player stopped" : "Player detenido"
              : language === "en" ? "Nothing to stop" : "Nada para detener",
            stopped
              ? language === "en"
                ? "Playback stopped and the queue was cleared."
                : "Se detuvo la reproduccion y se limpio la cola."
              : language === "en"
                ? "There was no active session."
                : "No habia una sesion activa."
          )
        ]
      });
    }
  };
}
