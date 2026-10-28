import "dotenv/config";
import { runWorker } from "./platform/worker";
import { disconnectPrisma } from "./database/client";
import { closeControlPool } from "./platform/store";
const stop = new AbortController();
process.once("SIGTERM", () => stop.abort());
process.once("SIGINT", () => stop.abort());
runWorker(stop.signal)
  .catch(() => {
    console.error("Worker stopped with an error");
    process.exitCode = 1;
  })
  .finally(async () => {
    await disconnectPrisma();
    await closeControlPool();
  });
