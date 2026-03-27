import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { guildOnlyText, resolveGuildLanguage } from "../i18n";
import { createNowPlayingResponse } from "../playback-ui";

export function createNowPlayingCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("nowplaying")
      .setDescription("Muestra la cancion actual con controles rapidos."),
    async execute(interaction) {
      const language = await resolveGuildLanguage(context, interaction.guild?.id);

      if (!interaction.guild) {
        await interaction.reply({
          content: guildOnlyText(language),
          ephemeral: true
        });
        return;
      }

      const snapshot = context.playbackManager.getQueue(interaction.guild.id);
      const [plan, settings] = await Promise.all([
        context.accessService.getPlan(interaction.guild.id),
        context.guildSettingsRepository.getByGuildId(interaction.guild.id)
      ]);
      await interaction.reply(
        await createNowPlayingResponse(snapshot, {
          layout: "full",
          meta: { plan, settings, language }
        })
      );
      await context.playbackPanelService.registerFromInteractionReply(
        interaction,
        interaction.guild.id
      );
    }
  };
}
