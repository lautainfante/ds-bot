import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  Collection,
  Events,
  REST,
  Routes
} from "discord.js";
import { AppEnv } from "../../config/env";
import { UnsupportedSourceError } from "../../domain/errors/unsupported-source-error";
import { UserFacingError } from "../../domain/errors/user-facing-error";
import { Logger } from "../../shared/logger";
import { ButtonHandler } from "./button-handler";
import { SlashCommand } from "./command";

export class DiscordBot {
  private readonly commands = new Collection<string, SlashCommand>();
  private readonly buttonHandlers: ButtonHandler[];

  constructor(
    private readonly client: Client,
    commands: SlashCommand[],
    buttonHandlers: ButtonHandler[],
    private readonly env: AppEnv,
    private readonly logger: Logger
  ) {
    for (const command of commands) {
      this.commands.set(command.data.name, command);
    }
    this.buttonHandlers = buttonHandlers;

    this.client.once(Events.ClientReady, async (readyClient) => {
      this.logger.info("Discord bot connected", {
        user: readyClient.user.tag
      });

      if (this.env.registerCommandsOnStart) {
        await this.registerCommands();
      }
    });

    this.client.on(Events.InteractionCreate, async (interaction) => {
      if (interaction.isChatInputCommand()) {
        await this.handleChatCommand(interaction);
        return;
      }

      if (interaction.isButton()) {
        await this.handleButtonInteraction(interaction);
      }
    });
  }

  async start(): Promise<void> {
    await this.client.login(this.env.discordToken);
  }

  private async registerCommands(): Promise<void> {
    const rest = new REST().setToken(this.env.discordToken);
    const payload = [...this.commands.values()].map((command) => command.data.toJSON());
    const route = this.env.discordGuildId
      ? Routes.applicationGuildCommands(this.env.discordClientId, this.env.discordGuildId)
      : Routes.applicationCommands(this.env.discordClientId);

    await rest.put(route, { body: payload });

    this.logger.info("Slash commands registered", {
      total: payload.length,
      scope: this.env.discordGuildId ? "guild" : "global",
      guildId: this.env.discordGuildId
    });
  }

  private async handleChatCommand(interaction: ChatInputCommandInteraction): Promise<void> {
    const command = this.commands.get(interaction.commandName);

    if (!command) {
      return;
    }

    try {
      await command.execute(interaction);
    } catch (error) {
      if (error instanceof UserFacingError) {
        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(error.message);
        } else {
          await interaction.reply({
            content: error.message,
            ephemeral: true
          });
        }

        return;
      }

      if (error instanceof UnsupportedSourceError) {
        const content = error.documentationUrl
          ? `${error.message}\nDocs: ${error.documentationUrl}`
          : error.message;

        if (interaction.deferred || interaction.replied) {
          await interaction.editReply(content);
        } else {
          await interaction.reply({
            content,
            ephemeral: true
          });
        }

        return;
      }

      this.logger.error("Command execution failed", {
        command: interaction.commandName,
        error: error instanceof Error ? error.message : "unknown",
        stack: error instanceof Error ? error.stack : undefined
      });

      const content = "Ocurrio un error ejecutando el comando.";

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(content);
      } else {
        await interaction.reply({
          content,
          ephemeral: true
        });
      }
    }
  }

  private async handleButtonInteraction(interaction: ButtonInteraction): Promise<void> {
    const handler = this.buttonHandlers.find((candidate) =>
      candidate.canHandle(interaction.customId)
    );

    if (!handler) {
      return;
    }

    try {
      await handler.execute(interaction);
    } catch (error) {
      this.logger.error("Button execution failed", {
        customId: interaction.customId,
        error: error instanceof Error ? error.message : "unknown",
        stack: error instanceof Error ? error.stack : undefined
      });

      const content = "Ocurrio un error ejecutando el boton.";

      if (interaction.replied || interaction.deferred) {
        await interaction.editReply(content);
      } else {
        await interaction.reply({
          content,
          ephemeral: true
        });
      }
    }
  }
}
