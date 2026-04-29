# Discord Music Bot

A TypeScript Discord music bot with free and premium tiers.

## Architecture

- **Runtime**: Node.js 22 (required by @discordjs/voice >=0.19.2)
- **Language**: TypeScript with strict mode
- **Entry point**: `src/index.ts`
- **Build output**: `dist/`

## Tech Stack

- `discord.js` — slash commands and events
- `@discordjs/voice` — voice channel audio streaming
- `yt-dlp` (system-installed) — primary YouTube extractor
- `youtubei.js` — fallback audio source
- `ffmpeg` (system-installed) — audio transcoding
- `opusscript` — opus codec (fallback since native `@discordjs/opus` prebuilt isn't available for Node 22)
- `play-dl` — audio stream resolution

## Project Structure

```
src/
  index.ts              - Entry point
  app/create-app.ts     - App factory / DI composition root
  config/env.ts         - Environment variable loading
  domain/               - Domain entities, enums, errors, services
  application/          - Use case services and ports
  infrastructure/
    discord/            - Discord client, commands, event handlers
    musicrepositories/  - Audio source implementations
  shared/logger.ts      - Logger
tools/
  yt-dlp.exe            - Windows yt-dlp binary (not used on Linux)
```

## Workflows

- **Start application**: `npm run dev` — runs `tsx watch src/index.ts` (console output)

## Required Secrets

- `DISCORD_TOKEN` — Bot token from Discord Developer Portal
- `DISCORD_CLIENT_ID` — Application/Client ID from Discord Developer Portal

## Optional Secrets / Env Vars

- `DISCORD_GUILD_ID` — Test server guild ID (for staging)
- `DISCORD_OWNER_ID` — Bot owner Discord user ID
- `PREMIUM_PORTAL_URL` — URL for the premium subscription page
- `PREMIUM_GUILD_IDS` — Comma-separated guild IDs with premium access
- `REGISTER_COMMANDS_ON_START` — `true` to auto-register slash commands on startup (default: true)
- `YOUTUBE_API_KEY` — YouTube Data API key
- `YT_DLP_PATH` — Path to yt-dlp binary (default: `/usr/local/bin/yt-dlp`)
- `YT_DLP_COOKIES_PATH` — Path to Netscape cookies file for YouTube auth
- `YT_DLP_COOKIES_BASE64` — Base64-encoded YouTube cookies (alternative to file path)

## System Dependencies (Nix)

- `python3`, `gcc`, `gnumake`, `pkg-config` — for native module builds
- `ffmpeg` — audio transcoding
- `yt-dlp` — YouTube audio extraction
