import { join } from "node:path";
import type { DispatchConfig } from "./execution/executionDispatcher";

/**
 * Deployment configuration, split by what may vary (AC-111).
 *
 * ## Why there are two definitions and not one
 *
 * The running API genuinely needs a movable database: `scripts/dev.mjs`,
 * every integration test, and the isolated verification instances all set
 * `FOUNDRY_DB_PATH`, and taking that away would break them for no gain.
 *
 * The **paid real-run entrypoint** needs the opposite property. It spends
 * money against whatever store it opens, so "which database" must not be
 * answerable by an environment variable that happens to be exported in the
 * shell that invoked it. A run that debits a real account against the
 * wrong store is not a configuration mistake, it is a loss.
 *
 * So the two are separated deliberately, and the real-run side is **fixed
 * in committed source with no environment input at all**.
 *
 * ## Why the real-run entrypoint refuses rather than ignoring
 *
 * Silently ignoring `FOUNDRY_DB_PATH` would be its own defect: an operator
 * who exported it believes it took effect, and would read the preflight as
 * describing the store they meant. Refusing, and naming the variable, is
 * the only answer that cannot be misread. The same applies to
 * `FOUNDRY_CLAUDE_PATH`, `FOUNDRY_GIT_PATH`, and `FOUNDRY_OPERATOR_ID`.
 */

/** Environment variables the real-run entrypoint refuses to run alongside. */
export const REAL_RUN_PROHIBITED_ENV = [
  "FOUNDRY_DB_PATH",
  "FOUNDRY_CLAUDE_PATH",
  "FOUNDRY_GIT_PATH",
  "FOUNDRY_OPERATOR_ID",
] as const;

/** The canonical operational database. Fixed; no environment input. */
export function realRunDatabasePath(): string {
  return join(import.meta.dirname, "..", "data", "foundry.sqlite");
}

/**
 * The API service's database.
 *
 * Still `FOUNDRY_DB_PATH`-overridable, exactly as it always has been —
 * this is the general configuration, and moving it is a normal thing to
 * do. It defaults to the same canonical path the real-run entrypoint
 * fixes, so an unconfigured deployment has one database, not two.
 */
export function apiDatabasePath(): string {
  return process.env.FOUNDRY_DB_PATH ?? realRunDatabasePath();
}

/**
 * The invariant execution policy for a real controlled run.
 *
 * Every value is a committed literal. Nothing here reads the environment,
 * and nothing here is reachable from the command line — changing any of it
 * is a reviewable diff.
 *
 * `expectedExecutableSha256` is deliberately absent: the operator supplies
 * the pin per invocation, and its absence is a refusal rather than a
 * default. A pin baked in here would be a pin nobody chose.
 *
 * The budget is absent for a different reason: it is not policy. It is the
 * operator's decision, carried on the persisted `ExecutionAuthorization`,
 * and read from there and nowhere else (H-3).
 */
export function realRunDispatchConfig(): Omit<DispatchConfig, "expectedExecutableSha256"> {
  return {
    executablePath: "/opt/homebrew/lib/node_modules/@anthropic-ai/claude-code/bin/claude.exe",
    gitExecutablePath: "/usr/bin/git",
    nodeExecutablePath: process.execPath,
    model: "sonnet",
    timeoutMs: 10 * 60_000,
    validationTimeoutMs: 2 * 60_000,
    maxStdoutBytes: 1024 * 1024,
    maxStderrBytes: 1024 * 1024,
    maxEvidenceBytes: 8 * 1024 * 1024,
  };
}

export type EnvironmentOverrideCheck =
  | { ok: true }
  | { ok: false; present: readonly string[]; reason: string; correctiveAction: string };

/**
 * Refuses to proceed when any prohibited variable is set.
 *
 * Checked before anything is read or computed, so an operator whose shell
 * carries a stale export learns it immediately rather than after a run has
 * already opened the wrong store.
 */
export function assertNoEnvironmentOverrides(
  environment: Record<string, string | undefined> = process.env,
): EnvironmentOverrideCheck {
  const present = REAL_RUN_PROHIBITED_ENV.filter(
    (name) => environment[name] !== undefined && environment[name] !== "",
  );
  if (present.length === 0) return { ok: true };

  return {
    ok: false,
    present,
    reason: `The real-run entrypoint refuses to run with ${present.join(", ")} set. This entrypoint spends money against whatever store it opens and invokes whatever binary it is pointed at, so neither may be decided by an environment variable that happens to be exported in the calling shell. Ignoring these silently would be worse: you would believe they took effect.`,
    correctiveAction: `Unset ${present.join(", ")} and re-run. The database, executable, and Git paths are fixed in \`apps/api/src/operationalConfig.ts\`; changing one is a reviewable diff, not an export.`,
  };
}
