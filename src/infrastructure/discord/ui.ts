import {
  ActionRowBuilder,
  APIEmbedField,
  ButtonBuilder,
  ButtonStyle,
  ColorResolvable,
  EmbedBuilder
} from "discord.js";

const BRAND_COLOR: ColorResolvable = 0xf59e0b;

export function createBotEmbed(
  title: string,
  description?: string,
  options?: {
    color?: ColorResolvable;
    fields?: APIEmbedField[];
  }
): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setColor(options?.color ?? BRAND_COLOR)
    .setTitle(title)
    .setFooter({
      text: "Discord Music"
    })
    .setTimestamp();

  if (description) {
    embed.setDescription(description);
  }

  if (options?.fields?.length) {
    embed.addFields(options.fields);
  }

  return embed;
}

export function createUpgradeComponents(
  upgradeUrl?: string
): ActionRowBuilder<ButtonBuilder>[] | undefined {
  if (!upgradeUrl) {
    return undefined;
  }

  return [
    new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setLabel("Ver premium")
        .setStyle(ButtonStyle.Link)
        .setURL(upgradeUrl)
    )
  ];
}
