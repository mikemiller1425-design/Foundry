import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { PersistenceService } from "@foundry/persistence";
import { createApp } from "./app";

const DEFAULT_DB_PATH = join(import.meta.dirname, "..", "data", "foundry.sqlite");
const dbPath = process.env.FOUNDRY_DB_PATH ?? DEFAULT_DB_PATH;
const port = Number(process.env.PORT ?? 4000);

mkdirSync(dirname(dbPath), { recursive: true });

const persistence = new PersistenceService(dbPath);
const server = createApp(persistence);

server.listen(port, () => {
  console.log(`@foundry/api listening on :${port} (db: ${dbPath})`);
});

function shutdown(): void {
  server.close(() => {
    persistence.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
