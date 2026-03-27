import { ButtonInteraction } from "discord.js";

export interface ButtonHandler {
  canHandle(customId: string): boolean;
  execute(interaction: ButtonInteraction): Promise<void>;
}
