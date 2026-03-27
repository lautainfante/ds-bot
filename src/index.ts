import { createApp } from "./app/create-app";

async function main(): Promise<void> {
  const app = await createApp();
  await app.start();
}

main().catch((error) => {
  console.error("Fatal startup error", error);
  process.exit(1);
});

