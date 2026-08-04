import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * AC-111 — tests at the **CLI shell boundary**.
 *
 * Both corrected defects lived in `dispatchRealRunCli.ts`, not in
 * `runEntrypoint`, so unit tests of the latter could not have caught
 * either. These spawn the real bundled entrypoint as a subprocess and
 * assert what an operator at a terminal would actually observe.
 *
 * **Nothing here invokes Claude Code, calls a model, consumes an
 * authorization, or spends money.** Every case refuses before dispatch:
 * the prohibited-environment check and the argument parser both run
 * before a database is opened or a backend is reached, and no case passes
 * `--execute-real-run` against an authorized build.
 */

const API_ROOT = path.join(import.meta.dirname, "..", "..");
const BUNDLE = path.join(API_ROOT, "dist", "ac111-dispatch-real-run.js");
const VALID_PIN = "a".repeat(64);

function buildEntrypoint(): void {
  execFileSync("node", ["build.mjs"], { cwd: API_ROOT, stdio: "pipe" });
}

/**
 * Runs the bundled entrypoint. The environment is scrubbed of every
 * prohibited variable unless a case deliberately sets one, so an exported
 * value in the developer's own shell cannot make these tests lie.
 */
function runCli(
  args: readonly string[],
  extraEnv: Record<string, string> = {},
): { status: number | null; stdout: string; stderr: string } {
  const env = { ...process.env };
  for (const name of ["FOUNDRY_DB_PATH", "FOUNDRY_CLAUDE_PATH", "FOUNDRY_GIT_PATH", "FOUNDRY_OPERATOR_ID"]) {
    delete env[name];
  }
  const result = spawnSync("node", [BUNDLE, ...args], {
    env: { ...env, ...extraEnv },
    encoding: "utf8",
    timeout: 60_000,
  });
  return { status: result.status, stdout: result.stdout ?? "", stderr: result.stderr ?? "" };
}

describe("AC-111 CLI shell — the canonical command builds before it runs (defect 3)", () => {
  it("the ac-111:dispatch script builds the entrypoint before executing it", () => {
    const pkg = JSON.parse(readFileSync(path.join(API_ROOT, "package.json"), "utf8")) as {
      scripts: Record<string, string>;
    };
    const script = pkg.scripts["ac-111:dispatch"];
    expect(script).toBeDefined();

    // The build must come first, and both halves must be in the one
    // command — documenting "build first if dist is stale" made the
    // reviewed source and the executed bundle separable by memory.
    const buildIndex = script!.indexOf("build.mjs");
    const runIndex = script!.indexOf("dist/ac111-dispatch-real-run.js");
    expect(buildIndex).toBeGreaterThanOrEqual(0);
    expect(runIndex).toBeGreaterThanOrEqual(0);
    expect(buildIndex).toBeLessThan(runIndex);
    expect(script).toContain("&&");
  });

  it("actually regenerates the bundle — the build step is run for real", () => {
    // Deliberately does NOT delete the bundle first. An earlier version
    // did, which opened a window where a concurrent test run found it
    // missing — a shared build artifact must not be removed by a test.
    // Re-running the build and observing a fresh write proves the same
    // thing without the race.
    const before = existsSync(BUNDLE) ? statSync(BUNDLE).mtimeMs : 0;

    // The first half of the canonical script, run for real.
    buildEntrypoint();

    expect(existsSync(BUNDLE)).toBe(true);
    expect(statSync(BUNDLE).size).toBeGreaterThan(0);
    expect(statSync(BUNDLE).mtimeMs).toBeGreaterThanOrEqual(before);
  });
});

describe("AC-111 CLI shell — defect 1: duplicate flags are refused", () => {
  it.each([
    ["--build-id", ["--build-id", "build-a", "--build-id", "build-b", "--pin-sha256", VALID_PIN]],
    ["--pin-sha256", ["--build-id", "build-a", "--pin-sha256", VALID_PIN, "--pin-sha256", VALID_PIN]],
    [
      "--execute-real-run",
      ["--build-id", "build-a", "--pin-sha256", VALID_PIN, "--execute-real-run", "--execute-real-run"],
    ],
  ])("refuses a duplicated %s at the shell", (flag, args) => {
    if (!existsSync(BUNDLE)) buildEntrypoint();
    const result = runCli(args);

    expect(result.status).toBe(2);
    const output = `${result.stdout}${result.stderr}`;
    expect(output).toContain("more than once");
    expect(output).toContain(flag);
    // Nothing was inspected, reserved, or dispatched.
    expect(output).not.toContain("PREFLIGHT");
    expect(output).not.toContain("EXECUTING");
  });

  it("refuses a duplicated --build-id even with --execute-real-run present", () => {
    if (!existsSync(BUNDLE)) buildEntrypoint();
    const result = runCli([
      "--build-id",
      "build-a",
      "--build-id",
      "build-b",
      "--pin-sha256",
      VALID_PIN,
      "--execute-real-run",
    ]);
    expect(result.status).toBe(2);
    expect(`${result.stdout}${result.stderr}`).not.toContain("EXECUTING");
  });
});

describe("AC-111 CLI shell — defect 2: no hidden environment inputs", () => {
  it.each(["FOUNDRY_DB_PATH", "FOUNDRY_CLAUDE_PATH", "FOUNDRY_GIT_PATH", "FOUNDRY_OPERATOR_ID"])(
    "refuses to start with %s set, naming it",
    (name) => {
      if (!existsSync(BUNDLE)) buildEntrypoint();
      const result = runCli(["--build-id", "build-a", "--pin-sha256", VALID_PIN], {
        [name]: name === "FOUNDRY_OPERATOR_ID" ? "not-the-operator" : "/tmp/elsewhere",
      });

      expect(result.status).toBe(2);
      const output = `${result.stdout}${result.stderr}`;
      expect(output).toContain("REFUSED");
      expect(output).toContain(name);
      // Refused, not ignored: an operator who exported it learns so.
      expect(output).toMatch(/spends money against whatever store it opens/i);
      expect(output).not.toContain("PREFLIGHT");
    },
  );

  it("refuses once, listing every prohibited variable that is set", () => {
    if (!existsSync(BUNDLE)) buildEntrypoint();
    const result = runCli(["--build-id", "build-a", "--pin-sha256", VALID_PIN], {
      FOUNDRY_DB_PATH: "/tmp/a.sqlite",
      FOUNDRY_OPERATOR_ID: "someone",
    });
    const output = `${result.stdout}${result.stderr}`;
    expect(output).toContain("FOUNDRY_DB_PATH");
    expect(output).toContain("FOUNDRY_OPERATOR_ID");
  });

  it("an empty prohibited variable is not treated as set", () => {
    if (!existsSync(BUNDLE)) buildEntrypoint();
    const result = runCli(["--build-id", "build-a", "--pin-sha256", VALID_PIN], {
      FOUNDRY_DB_PATH: "",
    });
    // Reaches the preflight rather than the environment refusal.
    expect(`${result.stdout}${result.stderr}`).toContain("PREFLIGHT");
  });
});

describe("AC-111 CLI shell — argument surface and dry-run default", () => {
  it("refuses every policy-widening flag by name", () => {
    if (!existsSync(BUNDLE)) buildEntrypoint();
    for (const [flag, value] of [
      ["--budget", "50"],
      ["--model", "opus"],
      ["--tools", "Bash"],
      ["--executable-path", "/bin/sh"],
    ] as const) {
      const result = runCli(["--build-id", "b", "--pin-sha256", VALID_PIN, flag, value]);
      expect(result.status).toBe(2);
      expect(`${result.stdout}${result.stderr}`).toContain(flag);
    }
  });

  it("defaults to a dry run that names its database and dispatches nothing", () => {
    if (!existsSync(BUNDLE)) buildEntrypoint();
    const result = runCli(["--build-id", "build-that-does-not-exist", "--pin-sha256", VALID_PIN]);

    const output = `${result.stdout}${result.stderr}`;
    expect(output).toContain("PREFLIGHT (dry run)");
    expect(output).toContain("database");
    // The fixed canonical store, not anything from the environment.
    expect(output).toContain(path.join("apps", "api", "data", "foundry.sqlite"));
    expect(output).toContain("DRY RUN. Nothing was reserved");
    expect(output).not.toContain("EXECUTING");
  });

  it("requires a well-formed pin before anything else happens", () => {
    if (!existsSync(BUNDLE)) buildEntrypoint();
    const result = runCli(["--build-id", "b", "--pin-sha256", "too-short"]);
    expect(result.status).toBe(2);
    expect(`${result.stdout}${result.stderr}`).toContain("64 lowercase hex");
  });
});
