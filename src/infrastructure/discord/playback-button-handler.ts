import { ButtonInteraction } from "discord.js";
import { LoopMode } from "../music/guild-playback-manager";
import { ButtonHandler } from "./button-handler";
import { CommandContext } from "./command-context";
import { resolveGuildLanguage } from "./i18n";
import { PLAYBACK_BUTTON_IDS, createNowPlayingResponse } from "./playback-ui";

export function createPlaybackButtonHandler(context: CommandContext): ButtonHandler {
  return {
    canHandle(customId) {
      return customId.startsWith("player:");
    },
    async execute(interaction: ButtonInteraction) {
      const language = await resolveGuildLanguage(context, interaction.guildId ?? undefined);

      if (!interaction.guildId) {
        await interaction.reply({
          content: language === "en"
            ? "This control only works inside a server."
            : "Este control solo funciona dentro de un servidor.",
          ephemeral: true
        });
        return;
      }

      const [action, pageToken] = interaction.customId.split(":").slice(1);

      switch (action) {
        case "pause":
          context.playbackManager.pause(interaction.guildId);
          break;
        case "resume":
          context.playbackManager.resume(interaction.guildId);
          break;
        case "skip":
          context.playbackManager.skip(interaction.guildId);
          break;
        case "stop":
          context.playbackManager.stop(interaction.guildId);
          break;
        case "loop":
          context.playbackManager.setLoopMode(
            interaction.guildId,
            getNextLoopMode(context.playbackManager.getQueue(interaction.guildId).loopMode)
          );
          break;
        case "shuffle":
          context.playbackManager.shuffleQueue(interaction.guildId);
          break;
        case "clear":
          context.playbackManager.clearQueue(interaction.guildId);
          break;
        case "remove-next":
          context.playbackManager.removeFromQueue(interaction.guildId, 1);
          break;
        case "page-prev":
          context.playbackPanelService.setPage(interaction.guildId, Math.max(0, Number(pageToken) - 1));
          break;
        case "page-next":
          context.playbackPanelService.setPage(interaction.guildId, Number(pageToken) + 1);
          break;
        case "refresh":
          break;
        default:
          await interaction.reply({
            content: language === "en" ? "I do not recognize that button." : "No reconozco ese boton.",
            ephemeral: true
          });
          return;
      }

      const snapshot = context.playbackManager.getQueue(interaction.guildId);
      const page = context.playbackPanelService.getPage(interaction.guildId);
      const layout = context.playbackPanelService.isDockMessage(
        interaction.guildId,
        interaction.message.id
      )
        ? "dock"
        : "full";
      const [plan, settings] = await Promise.all([
        context.accessService.getPlan(interaction.guildId),
        context.guildSettingsRepository.getByGuildId(interaction.guildId)
      ]);

      await interaction.update(
        await createNowPlayingResponse(snapshot, {
          page,
          layout,
          meta: { plan, settings }
        })
      );
      await context.playbackPanelService.refreshGuild(interaction.guildId);
    }
  };
}

function getNextLoopMode(current: LoopMode): LoopMode {
  switch (current) {
    case "off":
      return "track";
    case "track":
      return "queue";
    default:
      return "off";
  }
}
