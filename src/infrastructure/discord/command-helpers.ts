import {
  ChannelType,
  ChatInputCommandInteraction,
  GuildMember,
  VoiceBasedChannel
} from "discord.js";
import { UserFacingError } from "../../domain/errors/user-facing-error";

export async function requireGuildMember(
  interaction: ChatInputCommandInteraction
): Promise<GuildMember | null> {
  if (!interaction.inGuild() || !interaction.guild) {
    await interaction.reply({
      content: "Este comando solo funciona dentro de un servidor.",
      ephemeral: true
    });
    return null;
  }

  const member = interaction.member instanceof GuildMember
    ? interaction.member
    : await interaction.guild.members.fetch(interaction.user.id);

  return member;
}

export async function requireVoiceChannel(
  interaction: ChatInputCommandInteraction
): Promise<{ member: GuildMember; voiceChannelId: string; voiceChannel: VoiceBasedChannel } | null> {
  const member = await requireGuildMember(interaction);

  if (!member) {
    return null;
  }

  const voiceChannel = member.voice.channel;
  const voiceChannelId = voiceChannel?.id;

  if (!voiceChannel || !voiceChannelId) {
    await interaction.reply({
      content: "Tenes que estar en un canal de voz para usar este comando.",
      ephemeral: true
    });
    return null;
  }

  if (voiceChannel.type === ChannelType.GuildStageVoice) {
    throw new UserFacingError(
      "Este bot no esta preparado para Stage Channels. Probalo en un canal de voz normal."
    );
  }

  if ("full" in voiceChannel && voiceChannel.full) {
    throw new UserFacingError("Ese canal de voz esta lleno. Libera un lugar o usa otro canal.");
  }

  if ("joinable" in voiceChannel && !voiceChannel.joinable) {
    throw new UserFacingError(
      "No tengo permisos para entrar a ese canal de voz. Revisa `Ver canal` y `Conectar`."
    );
  }

  if ("speakable" in voiceChannel && !voiceChannel.speakable) {
    throw new UserFacingError(
      "Puedo entrar al canal, pero no tengo permiso para hablar. Revisa `Hablar` en el canal de voz."
    );
  }

  return { member, voiceChannelId, voiceChannel };
}

export function formatDuration(durationMs: number): string {
  const totalSeconds = Math.floor(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
