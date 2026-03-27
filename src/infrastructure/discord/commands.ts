import { SlashCommand } from "./command";
import { CommandContext } from "./command-context";
import { createBassCommand } from "./commands/bass-command";
import { createClearCommand } from "./commands/clear-command";
import { createDockCommand } from "./commands/dock-command";
import { createGrantPremiumCommand } from "./commands/grant-premium-command";
import { createHelpCommand } from "./commands/help-command";
import { createLanguageCommand } from "./commands/language-command";
import { createLoopCommand } from "./commands/loop-command";
import { createNightcoreCommand } from "./commands/nightcore-command";
import { createNowPlayingCommand } from "./commands/nowplaying-command";
import { createPauseCommand } from "./commands/pause-command";
import { createPingCommand } from "./commands/ping-command";
import { createPlanCommand } from "./commands/plan-command";
import { createPlayCommand } from "./commands/play-command";
import { createQueueCommand } from "./commands/queue-command";
import { createRemoveCommand } from "./commands/remove-command";
import { createResumeCommand } from "./commands/resume-command";
import { createShuffleCommand } from "./commands/shuffle-command";
import { createSkipCommand } from "./commands/skip-command";
import { createStopCommand } from "./commands/stop-command";
import { createSourcesCommand } from "./commands/sources-command";
import { createVolumeCommand } from "./commands/volume-command";

export function buildCommands(context: CommandContext): SlashCommand[] {
  return [
    createHelpCommand(context),
    createLanguageCommand(context),
    createDockCommand(context),
    createPingCommand(context),
    createPlayCommand(context),
    createNowPlayingCommand(context),
    createQueueCommand(context),
    createRemoveCommand(context),
    createShuffleCommand(context),
    createClearCommand(context),
    createLoopCommand(context),
    createSkipCommand(context),
    createStopCommand(context),
    createPauseCommand(context),
    createResumeCommand(context),
    createSourcesCommand(context),
    createVolumeCommand(context),
    createBassCommand(context),
    createNightcoreCommand(context),
    createPlanCommand(context),
    createGrantPremiumCommand(context)
  ];
}
