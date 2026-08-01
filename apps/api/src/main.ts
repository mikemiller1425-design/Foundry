import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { PersistenceService, PrincipalRegistry } from "@foundry/persistence";
import { WORLD_AGENTS } from "@foundry/world-model";
import { createApp } from "./app";

const DEFAULT_DB_PATH = join(import.meta.dirname, "..", "data", "foundry.sqlite");
const dbPath = process.env.FOUNDRY_DB_PATH ?? DEFAULT_DB_PATH;
const port = Number(process.env.PORT ?? 4000);

mkdirSync(dirname(dbPath), { recursive: true });

const persistence = new PersistenceService(dbPath);

/**
 * FBL-029: mint one credential per V1 agent at startup.
 *
 * Tokens are generated fresh each boot and held only in memory — they are
 * never persisted and never written to the event log, so replaying
 * history cannot leak one. They are printed once, here, because a
 * single-operator local deployment has no other delivery channel; that
 * is a deliberate V1 limitation, recorded rather than hidden.
 *
 * These are *agent* credentials. The browser never receives one, which
 * is precisely why a command from the frontend cannot pass the Inspector
 * check no matter what it puts in its payload.
 */
const principals = new PrincipalRegistry();
const agentCredentials = WORLD_AGENTS.map((agent) => ({
  id: agent.id,
  role: agent.role,
  token: principals.issueAgentCredential(agent.id),
}));

/**
 * FBL-030: the human operator's credential.
 *
 * Resolving an approval is the governance act (principle 14), so it
 * requires an authenticated operator — an agent credential will not do,
 * however genuine. Like the agent tokens this is per-process, in-memory,
 * and never persisted; unlike them it is meant to reach a browser, which
 * is why it is printed for the operator to paste in rather than baked
 * into the client bundle at build time.
 */
const operatorId = process.env.FOUNDRY_OPERATOR_ID ?? "operator-1";
const operatorToken = principals.issueOperatorCredential(operatorId);

const server = createApp(persistence, principals);

server.listen(port, () => {
  console.log(`@foundry/api listening on :${port} (db: ${dbPath})`);
  console.log("credentials (this process only; not persisted):");
  for (const credential of agentCredentials) {
    console.log(`  ${credential.role.padEnd(10)} ${credential.id.padEnd(18)} ${credential.token}`);
  }
  console.log(`  ${"operator".padEnd(10)} ${operatorId.padEnd(18)} ${operatorToken}`);
});

function shutdown(): void {
  // Long-lived SSE streams never end on their own, so `close()` alone
  // would wait forever for them — drop them explicitly first.
  server.closeAllConnections();
  server.close(() => {
    persistence.close();
    process.exit(0);
  });
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
