export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export function createLogger(): Logger {
  return {
    info(message, meta) {
      console.log(formatMessage("INFO", message, meta));
    },
    warn(message, meta) {
      console.warn(formatMessage("WARN", message, meta));
    },
    error(message, meta) {
      console.error(formatMessage("ERROR", message, meta));
    }
  };
}

function formatMessage(level: string, message: string, meta?: Record<string, unknown>): string {
  const prefix = `[${new Date().toISOString()}] [${level}] ${message}`;

  if (!meta) {
    return prefix;
  }

  return `${prefix} ${JSON.stringify(meta)}`;
}

