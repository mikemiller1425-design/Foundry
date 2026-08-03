#!/usr/bin/env node
/**
 * AC-104 acceptance check for F-101.
 *
 * Drives the real launch command as an operator would and asserts the four
 * things F-101 names:
 *
 *   1. one command starts both processes, in deterministic order
 *   2. the API's `/health` returns 200
 *   3. the frontend serves 200
 *   4. SIGINT shuts both down cleanly
 *
 * Deliberately a script rather than a vitest case. It spawns real
 * processes, builds the API, and boots Next — tens of seconds of work with
 * real ports. Putting that in the unit suite would make the fast gate slow
 * and flaky for everyone; the ladder asks for "a scripted check" and this
 * is it. Run with `pnpm verify:launch`.
 *
 * Uses non-default ports so it never collides with a session the operator
 * already has running.
 */

import { spawn } from "node:child_process";
import { createServer } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const API_PORT = Number(process.env.VERIFY_API_PORT ?? 4410);
const WEB_PORT = Number(process.env.VERIFY_WEB_PORT ?? 3410);
const READY_TIMEOUT_MS = 180_000;
const SHUTDOWN_TIMEOUT_MS = 20_000;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, passed, detail) {
  results.push({ name, passed, detail });
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

function portFree(port) {
  return new Promise((resolve) => {
    const s = createServer();
    s.once("error", () => resolve(false));
    s.once("listening", () => s.close(() => resolve(true)));
    s.listen(port, "127.0.0.1");
  });
}

async function main() {
  console.log("\nAC-104 / F-101 — single-command launch verification\n");

  for (const [label, port] of [
    ["API", API_PORT],
    ["web", WEB_PORT],
  ]) {
    if (!(await portFree(port))) {
      console.error(
        `\nCannot run: verification ${label} port ${port} is in use.\n` +
          `Set VERIFY_API_PORT / VERIFY_WEB_PORT to free ports and retry.\n`,
      );
      process.exit(1);
    }
  }

  console.log(`  launching: pnpm dev --api-port ${API_PORT} --web-port ${WEB_PORT}\n`);
  const launcher = spawn(
    "node",
    [join("scripts", "dev.mjs"), "--api-port", String(API_PORT), "--web-port", String(WEB_PORT)],
    {
      cwd: ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      detached: true,
      env: { ...process.env, NO_COLOR: "1" },
    },
  );

  let output = "";
  let ready = false;
  const record = (chunk) => {
    const text = chunk.toString();
    output += text;
    if (text.includes("Foundry is running")) ready = true;
  };
  launcher.stdout.on("data", record);
  launcher.stderr.on("data", record);

  let launcherExited = false;
  let launcherExitCode = null;
  launcher.on("exit", (code) => {
    launcherExited = true;
    launcherExitCode = code;
  });

  // 1 + 2 + 3 — wait for the launcher's own ready signal.
  const deadline = Date.now() + READY_TIMEOUT_MS;
  while (Date.now() < deadline && !ready && !launcherExited) await sleep(500);

  if (!ready) {
    check(
      "one command reaches a ready state",
      false,
      launcherExited ? `launcher exited ${launcherExitCode}` : "timed out",
    );
    console.error("\n--- launcher output ---\n" + output.slice(-3000));
    await forceStop(launcher);
    return finish();
  }
  check("one command starts both processes and reports ready", true);

  // Deterministic ordering: the API must be reported healthy before the
  // frontend is started, never the other way round.
  const apiHealthyAt = output.indexOf("API healthy");
  const webStartAt = output.indexOf("Starting the frontend");
  check(
    "deterministic ordering — API healthy before the frontend starts",
    apiHealthyAt !== -1 && webStartAt !== -1 && apiHealthyAt < webStartAt,
    `API healthy @${apiHealthyAt}, frontend start @${webStartAt}`,
  );

  // 2 — /health returns 200, independently of the launcher's own claim.
  try {
    const res = await fetch(`http://127.0.0.1:${API_PORT}/health`);
    const body = await res.json();
    check(
      "API /health returns 200",
      res.status === 200 && body.status === "ok",
      `HTTP ${res.status}`,
    );
  } catch (err) {
    check("API /health returns 200", false, String(err));
  }

  // 3 — the frontend serves 200.
  try {
    const res = await fetch(`http://127.0.0.1:${WEB_PORT}/`);
    check("frontend serves 200", res.status === 200, `HTTP ${res.status}`);
  } catch (err) {
    check("frontend serves 200", false, String(err));
  }

  // 4 — SIGINT shuts both down cleanly.
  console.log("\n  sending SIGINT…\n");
  process.kill(-launcher.pid, "SIGINT");

  const stopDeadline = Date.now() + SHUTDOWN_TIMEOUT_MS;
  while (Date.now() < stopDeadline && !launcherExited) await sleep(200);

  check(
    "SIGINT terminates the launcher",
    launcherExited,
    launcherExited ? `exit ${launcherExitCode}` : "still running",
  );
  check("SIGINT exit status is clean (0)", launcherExitCode === 0, `exit ${launcherExitCode}`);

  if (!launcherExited) await forceStop(launcher);

  // Both ports must be released — a clean shutdown that orphans the server
  // is not a clean shutdown.
  await sleep(1500);
  check("API port released after shutdown", await portFree(API_PORT), `port ${API_PORT}`);
  check("frontend port released after shutdown", await portFree(WEB_PORT), `port ${WEB_PORT}`);

  finish();
}

async function forceStop(launcher) {
  try {
    process.kill(-launcher.pid, "SIGKILL");
  } catch {
    // Already gone.
  }
  await sleep(500);
}

function finish() {
  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log(`\n  ${passed} passed, ${failed} failed, ${results.length} total\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("\nverification crashed:", err);
  process.exit(1);
});
