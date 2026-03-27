# Discord Music Bot

Base en TypeScript para un bot de musica de Discord con dos planes:

- `free`: puede reproducir, buscar, encolar y administrar cola.
- `premium`: desbloquea volumen, bass boost y modo nightcore.

## Fuentes soportadas

- YouTube
- YouTube Music (links `music.youtube.com`)

Fuentes no implementadas en este proyecto:

- Spotify
- SoundCloud

## Stack

- `discord.js` para slash commands y eventos.
- `@discordjs/voice` para voz.
- `play-dl` para resolucion de YouTube.
- `yt-dlp` como backend principal de extraccion para YouTube y YouTube Music.
- `ffmpeg-static` + `prism-media` para filtros y transformaciones.

## Estructura

```text
src/
  application/    # casos de uso y puertos
  domain/         # entidades, reglas y policy free/premium
  infrastructure/ # Discord, audio, providers y repos
  shared/         # logger/utilidades
```

## Arranque

1. Copia `.env.example` a `.env` y completa los valores.
2. Instala dependencias con `npm.cmd install`.
3. Inicia en desarrollo con `npm.cmd run dev`.

Si PowerShell bloquea `npm`, usa `npm.cmd`.

Variables:

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_GUILD_ID` recomendado para desarrollo, registra comandos instantaneamente en tu servidor
- `DISCORD_OWNER_ID`
- `PREMIUM_PORTAL_URL`
- `PREMIUM_GUILD_IDS`
- `REGISTER_COMMANDS_ON_START`
- `YOUTUBE_API_KEY` opcional por ahora
- `YT_DLP_PATH` opcional si no usas `tools/yt-dlp.exe`
- `YT_DLP_COOKIES_PATH` opcional si tienes un `cookies.txt`
- `YT_DLP_COOKIES_BASE64` opcional para Railway/Render si prefieres pegar el archivo codificado

## Deploy 24/7

Este bot ya queda listo para deploy con Docker. El repo incluye [Dockerfile](/C:/Users/usuario/Desktop/Develop/ds-bot/Dockerfile), que:

- compila TypeScript
- instala dependencias de produccion
- descarga `yt-dlp` para Linux
- arranca con `node dist/index.js`

### Variables minimas en produccion

- `DISCORD_TOKEN`
- `DISCORD_CLIENT_ID`
- `DISCORD_OWNER_ID`
- `DISCORD_GUILD_ID` opcional si quieres registro rapido en un servidor de pruebas
- `PREMIUM_PORTAL_URL` opcional
- `PREMIUM_GUILD_IDS` opcional
- `REGISTER_COMMANDS_ON_START=true`
- `YT_DLP_PATH` opcional, por defecto el contenedor usa `/usr/local/bin/yt-dlp`
- `YT_DLP_COOKIES_PATH` opcional si montas un archivo de cookies
- `YT_DLP_COOKIES_BASE64` recomendado en Railway cuando YouTube pide login

### Cookies de YouTube en Railway

Si Railway o el datacenter de tu host recibe el error `Sign in to confirm you're not a bot`, configura cookies para `yt-dlp`.

1. Exporta tus cookies de YouTube en formato Netscape (`cookies.txt`).
2. Convierte ese archivo a base64.
3. Carga el resultado en Railway como `YT_DLP_COOKIES_BASE64`.
4. Redeploy.

Ejemplo en PowerShell para generar el base64:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\ruta\cookies.txt"))
```

Tambien puedes montar un archivo y usar `YT_DLP_COOKIES_PATH`, pero en Railway normalmente es mas simple usar `YT_DLP_COOKIES_BASE64`.

### Railway

Recomendado si quieres subirlo rapido y olvidarte del servidor:

1. Sube el repo a GitHub.
2. Crea un proyecto nuevo en Railway.
3. Conecta el repo.
4. Railway detecta el `Dockerfile` y lo usa para build.
5. Carga las variables del `.env` en el panel de Variables.
6. Deja una sola replica/instance.

### Render

Usa un `Background Worker` o un `Private Service`, no un sitio estatico.

1. Sube el repo a GitHub.
2. Crea un `Background Worker`.
3. Selecciona Docker como metodo de deploy.
4. Carga variables de entorno.
5. Desactiva cualquier healthcheck HTTP, porque este bot no expone servidor web.

### VPS

Si quieres pagar menos y tener control total:

1. Crea una VPS Ubuntu o Debian.
2. Instala Docker.
3. Clona el repo.
4. Ejecuta:

```bash
docker build -t ds-bot .
docker run -d --name ds-bot --restart unless-stopped --env-file .env ds-bot
```

Con eso el bot vuelve a levantarse solo si reinicia la maquina.

## Monetizacion

La monetizacion se resolvio con una capa de entitlements desacoplada:

- `GuildSubscriptionRepository` decide si un servidor es `FREE` o `PREMIUM`.
- `FeaturePolicy` bloquea solo features premium.
- Hoy hay una implementacion en memoria y un comando administrativo para conceder premium.

Para cobrar de verdad, conecta Stripe, Mercado Pago, Paddle o el modelo de monetizacion de Discord sobre el repositorio de suscripciones sin tocar el reproductor ni los comandos.

## Siguientes pasos recomendados

- Reemplazar los repositorios en memoria por PostgreSQL o Redis.
- Agregar webhooks de pago para activar/desactivar premium.
- Registrar telemetria y limites por guild.
- Agregar dashboard web para onboarding y upsell.
