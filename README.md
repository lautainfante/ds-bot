# Discord Music Bot

Bot de musica para Discord en TypeScript con plan `free` y `premium`.

## Stack

- `discord.js` para slash commands y eventos
- `@discordjs/voice` para voz
- `yt-dlp` como extractor principal para YouTube y YouTube Music
- `youtubei.js` como fallback de compatibilidad
- `ffmpeg-static` + `prism-media` para transcodificacion y filtros

## Desarrollo local

1. Copia `.env.example` a `.env`.
2. Completa las variables.
3. Instala dependencias con `npm.cmd install`.
4. Inicia en desarrollo con `npm.cmd run dev`.

Validaciones:

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run test
```

## Variables de entorno

Obligatorias:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_OWNER_ID`
- `REGISTER_COMMANDS_ON_START=true`

Opcionales:

- `DISCORD_GUILD_ID` para staging o pruebas rapidas
- `PREMIUM_PORTAL_URL`
- `PREMIUM_GUILD_IDS`
- `YOUTUBE_API_KEY`
- `YT_DLP_PATH` por defecto `/usr/local/bin/yt-dlp`
- `YT_DLP_COOKIES_PATH` recomendado en produccion: `/opt/ds-bot/secrets/youtube-cookies.txt`
- `YT_DLP_COOKIES_BASE64` solo como compatibilidad si no quieres montar archivo

## Pipeline de audio

El flujo de produccion queda deliberadamente simple:

1. `yt-dlp` abre el stream de audio por stdout
2. `ffmpeg` lo transcodifica a PCM
3. si `yt-dlp` falla, el bot intenta `youtubei.js`

No se usa:

- resolucion directa con `yt-dlp -g`
- `PO token`
- `bgutil`

## Docker

El repo incluye:

- [Dockerfile](/C:/Users/usuario/Desktop/Develop/ds-bot/Dockerfile)
- [docker-compose.yml](/C:/Users/usuario/Desktop/Develop/ds-bot/docker-compose.yml)

Build local:

```bash
docker build -t ds-bot .
```

## Produccion en Hetzner VPS

Target recomendado:

- Ubuntu 24.04 LTS
- 2 vCPU
- 4 GB RAM

Layout operativo:

- codigo: `/opt/ds-bot/app`
- env: `/opt/ds-bot/app/.env`
- cookies: `/opt/ds-bot/app/secrets/youtube-cookies.txt`

Pasos:

1. Instala Docker y Docker Compose plugin.
2. Clona el repo en `/opt/ds-bot/app`.
3. Crea `secrets/youtube-cookies.txt` con cookies Netscape de YouTube.
4. Copia `.env.example` a `.env` y ajusta valores.
5. Levanta el bot:

```bash
docker compose up -d --build
```

Ver logs:

```bash
docker compose logs -f bot
```

Reiniciar:

```bash
docker compose restart bot
```

Con `restart: unless-stopped`, el bot vuelve a levantar tras reinicio de la VPS.

## Cookies de YouTube

Si YouTube pide validacion adicional, exporta cookies en formato Netscape y guardalas en:

```text
/opt/ds-bot/app/secrets/youtube-cookies.txt
```

Luego reinicia el contenedor:

```bash
docker compose restart bot
```

`YT_DLP_COOKIES_BASE64` sigue soportado, pero no es el camino principal para produccion.

## Criterio de operacion

El deploy principal pensado para este repo es VPS simple con Docker. Railway queda fuera del camino principal para evitar complejidad adicional alrededor de YouTube.
