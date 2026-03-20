import { env } from "./config/env";
import { pool } from "./db/pool";
import { createApp } from "./app";

const app = createApp();
const server = app.listen(env.PORT, () => {
  console.log(`Backend listening on port ${env.PORT}`);
});

const shutdown = async () => {
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
};

process.on("SIGINT", () => {
  void shutdown();
});

process.on("SIGTERM", () => {
  void shutdown();
});
