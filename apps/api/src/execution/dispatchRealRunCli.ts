import { CommandHandler, PersistenceService } from "@foundry/persistence";
import { executionDispatchConfig, operationalDatabasePath } from "../operationalConfig";
import { ExecutionDispatcher } from "./executionDispatcher";
import { runEntrypoint } from "./dispatchRealRun";

/**
 * `AC-111` real-run entrypoint — the executable shell (AC-111).
 *
 * Deliberately thin. Everything decidable lives in `dispatchRealRun.ts`,
 * which is injected with its dependencies so the tests exercise the whole
 * entrypoint end to end against a substituted backend. This file exists
 * only to wire the **operational** objects — the same
 * `PersistenceService`, the same `CommandHandler`, the same database path,
 * and the same committed configuration the running service uses.
 *
 * It is not a route and it is not reachable from the browser. Starting a
 * real run is a deliberate act at a terminal, by a person who typed the
 * build id and a pin.
 *
 *   # dry run (default — reads only, changes nothing)
 *   pnpm --filter @foundry/api exec node dist/ac111-dispatch-real-run.js \
 *     --build-id <buildId> --pin-sha256 <sha256>
 *
 *   # one real run (spends money, consumes the authorization)
 *   … same flags … --execute-real-run
 */

const dbPath = operationalDatabasePath();
const persistence = new PersistenceService(dbPath);
const commands = new CommandHandler(persistence);
const config = executionDispatchConfig();

const operatorId = process.env.FOUNDRY_OPERATOR_ID ?? "operator-1";

try {
  const result = await runEntrypoint(process.argv.slice(2), {
    persistence,
    config,
    actor: { actorType: "operator", actorId: operatorId, authenticated: true },
    dispatch: (pinSha256) =>
      new ExecutionDispatcher(persistence, commands, {
        ...config,
        expectedExecutableSha256: pinSha256,
      }).dispatch(
        // `runEntrypoint` has already validated the build id.
        process.argv[process.argv.indexOf("--build-id") + 1] as string,
        { actorType: "operator", actorId: operatorId, authenticated: true },
      ),
  });
  process.exitCode = result.exitCode;
} finally {
  persistence.close();
}
