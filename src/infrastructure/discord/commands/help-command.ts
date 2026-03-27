import { SlashCommandBuilder } from "discord.js";
import { SlashCommand } from "../command";
import { CommandContext } from "../command-context";
import { planLabel, resolveGuildLanguage } from "../i18n";
import { createBotEmbed, createUpgradeComponents } from "../ui";

export function createHelpCommand(context: CommandContext): SlashCommand {
  return {
    data: new SlashCommandBuilder()
      .setName("help")
      .setDescription("Muestra los comandos disponibles y como usar el bot."),
    async execute(interaction) {
      const language = await resolveGuildLanguage(context, interaction.guild?.id);
      const currentPlan = interaction.guild
        ? await context.accessService.getPlan(interaction.guild.id)
        : undefined;

      const embed = createBotEmbed(
        language === "en" ? "Help center" : "Centro de ayuda",
        language === "en"
          ? "These are the available commands and what each one does."
          : "Estos son los comandos disponibles del bot y lo que hace cada uno.",
        {
          fields: [
            {
              name: language === "en" ? "Playback" : "Reproduccion",
              value: [
                language === "en" ? "`/play` searches or plays a YouTube or YouTube Music URL" : "`/play` busca o reproduce una URL de YouTube o YouTube Music",
                language === "en" ? "`/nowplaying` shows the current track and controls" : "`/nowplaying` muestra la cancion actual y controles",
                language === "en" ? "`/dock` pins the player dock in this channel" : "`/dock` fija el player dock en este canal",
                language === "en" ? "`/queue` shows the queue" : "`/queue` muestra la cola",
                language === "en" ? "`/skip` skips the current song" : "`/skip` salta la cancion actual",
                language === "en" ? "`/pause` pauses playback" : "`/pause` pausa la reproduccion",
                language === "en" ? "`/resume` resumes playback" : "`/resume` reanuda la reproduccion",
                language === "en" ? "`/stop` stops playback and clears the queue" : "`/stop` detiene y limpia la cola"
              ].join("\n")
            },
            {
              name: language === "en" ? "Queue" : "Cola",
              value: [
                language === "en" ? "`/remove` removes a queue position" : "`/remove` quita una posicion de la cola",
                language === "en" ? "`/shuffle` shuffles the upcoming queue" : "`/shuffle` mezcla la cola pendiente",
                language === "en" ? "`/clear` clears the upcoming queue" : "`/clear` limpia la cola pendiente",
                language === "en" ? "`/loop` switches between off, track and queue" : "`/loop` cambia loop entre off, track y queue"
              ].join("\n")
            },
            {
              name: language === "en" ? "Info" : "Informacion",
              value: [
                language === "en" ? "`/help` shows this help" : "`/help` muestra esta ayuda",
                language === "en" ? "`/ping` checks if the bot is alive" : "`/ping` comprueba si el bot esta vivo",
                language === "en" ? "`/sources` shows supported sources" : "`/sources` muestra fuentes soportadas",
                language === "en" ? "`/plan` shows the server plan" : "`/plan` muestra el plan del servidor",
                language === "en" ? "`/language` changes the server language" : "`/language` cambia el idioma del servidor"
              ].join("\n")
            },
            {
              name: "Premium",
              value: [
                language === "en" ? "`/volume` sets volume between 1 and 150" : "`/volume` ajusta volumen entre 1 y 150",
                language === "en" ? "`/bass` sets bass boost between 0 and 20" : "`/bass` ajusta bass boost entre 0 y 20",
                language === "en" ? "`/nightcore` enables or disables the effect" : "`/nightcore` activa o desactiva el efecto"
              ].join("\n")
            },
            {
              name: language === "en" ? "Admin" : "Admin",
              value: language === "en"
                ? "`/grant-premium` enables or disables premium for this server"
                : "`/grant-premium` activa o desactiva premium para este servidor"
            },
            {
              name: language === "en" ? "Examples" : "Ejemplos",
              value: [
                "`/play input:HOME Resonance`",
                "`/play input:https://www.youtube.com/watch?v=8GW6sLrK40k`",
                "`/volume value:80`",
                "`/nightcore enabled:true`"
              ].join("\n")
            },
            {
              name: language === "en" ? "Current plan" : "Plan actual",
              value: currentPlan
                ? `**${planLabel(currentPlan, language)}**`
                : language === "en"
                  ? "Available inside a server"
                  : "Disponible dentro de un servidor"
            }
          ]
        }
      );

      await interaction.reply({
        embeds: [embed],
        components: createUpgradeComponents(context.env.premiumPortalUrl)
      });
    }
  };
}
