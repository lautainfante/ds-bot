import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { guildOnlyText, resolveGuildLanguage } from "../i18n";
import { createBotEmbed } from "../ui";

export function createRemoveCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("remove")
      .setDescription("Quita una cancion de la cola.")
      .addIntegerOption((option) =>
        option
          .setName("position")
          .setDescription("Posicion dentro de la cola, empezando en 1")
          .setMinValue(1)
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

      const position = interaction.options.getInteger("position", true);
      const removed = context.playbackManager.removeFromQueue(interaction.guild.id, position);

      if (!removed) {
        await interaction.reply({
          embeds: [
            createBotEmbed(
              language === "en" ? "Could not remove track" : "No pude quitar esa cancion",
              language === "en"
                ? "That queue position does not exist."
                : "La posicion indicada no existe en la cola."
            )
          ],
          ephemeral: true
        });
        return;
      }

      await context.playbackPanelService.refreshGuild(interaction.guild.id);

      await interaction.reply({
        embeds: [
          createBotEmbed(
            language === "en" ? "Track removed" : "Cancion removida",
            language === "en"
              ? `Removed **${removed.title}** from the queue.`
              : `Se quito **${removed.title}** de la cola.`
          )
        ]
      });
    }
  };
}
