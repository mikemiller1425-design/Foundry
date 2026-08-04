import { CommandHandler, PersistenceService } from "@foundry/persistence";
import {
  assertNoEnvironmentOverrides,
  realRunDatabasePath,
  realRunDispatchConfig,
} from "../operationalConfig";
import { ExecutionDispatcher } from "./executionDispatcher";
import { REAL_RUN_ACTOR, runEntrypoint } from "./dispatchRealRun";

/**
 * `AC-111` real-run entrypoint — the executable shell.
 *
 * Deliberately thin, and deliberately **input-free beyond argv**.
 * Everything decidable lives in `dispatchRealRun.ts`, which is injected
 * with its dependencies so the tests exercise the entrypoint end to end
 * against a substituted backend.
 *
 * It is not a route and it is not reachable from the browser. Starting a
 * real run is a deliberate act at a terminal, by a person who typed the
 * build id and a pin.
 *
 * ## Three corrections, recorded here because they were real defects
 *
 * 1. **`process.argv` is never read after parsing.** The first version
 *    re-read it inside the dispatch closure to recover the build id, so
 *    duplicate `--build-id` flags could make the preflight inspect one
 *    build while the dispatch targeted another — a paid run against
 *    something the operator never reviewed. `runEntrypoint` now hands the
 *    validated values to `dispatch`, and duplicate flags are refused.
 * 2. **No environment input at all.** The first version read
 *    `FOUNDRY_DB_PATH`, `FOUNDRY_CLAUDE_PATH`, `FOUNDRY_GIT_PATH`, and
 *    `FOUNDRY_OPERATOR_ID`, while the documentation claimed three accepted
 *    inputs. Those are refused now, by name, rather than ignored.
 * 3. **No impersonation.** The first version marked
 *    `FOUNDRY_OPERATOR_ID` as `authenticated: true` with no
 *    `PrincipalRegistry` verification — a shell variable asserting
 *    operator authority. See `REAL_RUN_ACTOR`.
 *
 * ## The canonical invocation
 *
 *   # dry run (default — reads only, changes nothing)
 *   pnpm --filter @foundry/api ac-111:dispatch \
 *     --build-id <buildId> --pin-sha256 <sha256>
 *
 *   # one real run (spends money, consumes the authorization)
 *   … same flags … --execute-real-run
 *
 * **No `--` separator.** pnpm forwards it as a literal argument, which
 * this entrypoint then correctly refuses as unrecognised. The refusal was
 * the right behaviour — an argument parser that silently skipped tokens it
 * did not understand would be the actual defect — but the documented
 * command was wrong, and an operator following it could not run a dry run
 * at all.
 *
 * The package script builds immediately before running, so the reviewed
 * source and the executed bundle cannot drift apart by operator memory.
 */

const environmentCheck = assertNoEnvironmentOverrides();
if (!environmentCheck.ok) {
  console.error(`REFUSED: ${environmentCheck.reason}`);
  console.error(`  ${environmentCheck.correctiveAction}`);
  process.exit(2);
}

const dbPath = realRunDatabasePath();
const persistence = new PersistenceService(dbPath);
const commands = new CommandHandler(persistence);
const config = realRunDispatchConfig();

try {
  const result = await runEntrypoint(process.argv.slice(2), {
    persistence,
    config,
    databasePath: dbPath,
    actor: REAL_RUN_ACTOR,
    dispatch: (buildId, pinSha256) =>
      new ExecutionDispatcher(persistence, commands, {
        ...config,
        expectedExecutableSha256: pinSha256,
      }).dispatch(buildId, REAL_RUN_ACTOR),
  });
  process.exitCode = result.exitCode;
} finally {
  persistence.close();
}
