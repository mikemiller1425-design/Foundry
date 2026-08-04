#!/usr/bin/env node
/**
 * Foundry — one-command local operation (AC-104).
 *
 * `pnpm dev` brings up both processes, in a deterministic order, with a
 * health gate between them, and takes both down cleanly on Ctrl-C.
 *
 * Before this script the operator had to: install; build the API; start
 * it on :4000; read a credential out of its stdout; start the frontend
 * with `NEXT_PUBLIC_FOUNDRY_API_URL` set; open a browser; paste the
 * credential. Seven manual steps across two terminals, documented in two
 * files, with an undocumented ordering dependency (PV1-027).
 *
 * What this script deliberately does NOT do, because those are AC-105:
 *
 * - It does not change how the application resolves its runtime mode.
 *   `NEXT_PUBLIC_FOUNDRY_API_URL` is still inlined by Next at build time;
 *   this script only chooses whether to pass that existing variable to the
 *   frontend child process. A built artifact remains mode-locked (PV1-028).
 * - It does not hand the operator credential to the browser. The token is
 *   surfaced in the ready banner because the API already prints it, but
 *   the operator still pastes it. Removing that step is AC-105's job.
 *
 * No process supervisor, no Docker, no production packaging — those are
 * prohibited work for this rung.
 */

import { spawn } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

/**
 * Where the credential handoff lives. Git-ignored; removed on shutdown.
 * The API port is appended so concurrent launchers never share a file —
 * see `writeCredentialHandoff`.
 */
const HANDOFF_DIR = ".foundry";
const HANDOFF_FILE = "operator-credential";
let handoffFileToRemove = null;

/**
 * Both servers bind loopback only.
 *
 * The frontend now serves the credential-handoff route, so a server
 * reachable from the LAN would hand an operator credential to whoever
 * asked. This is a tightening, not a weakening — and it keeps the handoff
 * honest about being local.
 */
const LOOPBACK_HOST = "127.0.0.1";

/** Defaults live here and are mirrored in `.env.example` and the quickstart. */
const DEFAULTS = {
  API_PORT: 4000,
  WEB_PORT: 3000,
  HEALTH_TIMEOUT_MS: 60_000,
  WEB_TIMEOUT_MS: 120_000,
  SHUTDOWN_GRACE_MS: 8_000,
};

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/**
 * Loads `.env` if the operator created one from `.env.example`.
 *
 * Node's own loader, so this adds no dependency and no bespoke parser.
 * Real environment variables already set take precedence, which is what an
 * operator overriding a single value on the command line expects.
 */
function loadDotEnv() {
  const envPath = join(ROOT, ".env");
  if (!existsSync(envPath)) return false;
  const before = { ...process.env };
  try {
    process.loadEnvFile(envPath);
  } catch (err) {
    fail(
      `Could not read ${envPath}`,
      err instanceof Error ? err.message : String(err),
      "Fix the file's syntax (KEY=value per line), or delete it to fall back to defaults.",
    );
  }
  // Restore anything that was already exported: `.env` is a default source,
  // not an override, or `PORT=4001 pnpm dev` would silently do nothing.
  for (const [key, value] of Object.entries(before)) process.env[key] = value;
  return true;
}

function parseArgs(argv) {
  const args = { mock: false, apiPort: null, webPort: null, production: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--mock") args.mock = true;
    else if (arg === "--prod" || arg === "--production") args.production = true;
    else if (arg === "--api-port") args.apiPort = Number(argv[++i]);
    else if (arg === "--web-port") args.webPort = Number(argv[++i]);
    else if (arg === "--help" || arg === "-h") args.help = true;
    else fail(`Unknown option: ${arg}`, null, "Run `pnpm dev --help` for the supported options.");
  }
  return args;
}

function resolveConfig(args) {
  const apiPort = args.apiPort ?? Number(process.env.PORT ?? DEFAULTS.API_PORT);
  const webPort = args.webPort ?? Number(process.env.FOUNDRY_WEB_PORT ?? DEFAULTS.WEB_PORT);
  if (!Number.isInteger(apiPort) || apiPort <= 0) {
    fail(`Invalid API port: ${apiPort}`, null, "Set PORT to a positive integer.");
  }
  if (!Number.isInteger(webPort) || webPort <= 0) {
    fail(`Invalid web port: ${webPort}`, null, "Set FOUNDRY_WEB_PORT to a positive integer.");
  }
  if (apiPort === webPort) {
    fail(
      `The API and the frontend are both configured for port ${apiPort}`,
      null,
      "Set PORT and FOUNDRY_WEB_PORT to different values.",
    );
  }
  return {
    apiPort,
    webPort,
    // Mock mode simply withholds the existing variable; it changes nothing
    // about how the app resolves its mode (that is AC-105).
    apiUrl: args.mock ? null : `http://127.0.0.1:${apiPort}`,
    production: args.production,
  };
}

// ---------------------------------------------------------------------------
// Output
// ---------------------------------------------------------------------------

const colour = process.stdout.isTTY && !process.env.NO_COLOR;
const dim = (s) => (colour ? `\u001b[2m${s}\u001b[0m` : s);
const bold = (s) => (colour ? `\u001b[1m${s}\u001b[0m` : s);
const green = (s) => (colour ? `\u001b[32m${s}\u001b[0m` : s);
const red = (s) => (colour ? `\u001b[31m${s}\u001b[0m` : s);
const yellow = (s) => (colour ? `\u001b[33m${s}\u001b[0m` : s);

function step(n, total, message) {
  console.log(`${dim(`[${n}/${total}]`)} ${message}`);
}

/**
 * Every failure states what went wrong, why, and what to do about it.
 * A launch script that dies with a stack trace has handed the operator a
 * debugging task instead of an instruction.
 */
function fail(what, detail, action) {
  console.error(`\n${red("✖ Foundry could not start.")}`);
  console.error(`  ${bold("Problem:")}  ${what}`);
  if (detail) console.error(`  ${bold("Detail:")}   ${detail}`);
  if (action) console.error(`  ${bold("Do this:")}  ${action}`);
  console.error("");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Child processes
// ---------------------------------------------------------------------------

const children = [];

/**
 * Spawned in their own process groups so shutdown can signal the whole
 * tree. `pnpm` → `next` → `next-server` is three processes deep; killing
 * only the pnpm wrapper orphans the server and leaves the port bound.
 */
function launch(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd ?? ROOT,
    env: { ...process.env, ...options.env },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  const record = { name, child, exited: false, exitCode: null };
  children.push(record);

  child.on("exit", (code, signal) => {
    record.exited = true;
    record.exitCode = code;
    if (!shuttingDown && code !== 0) {
      console.error(
        `\n${red(`✖ ${name} exited unexpectedly`)} (code ${code}${signal ? `, signal ${signal}` : ""}).`,
      );
      void shutdown(1);
    }
  });
  child.on("error", (err) => {
    fail(`Could not start ${name}`, err.message, "Check that pnpm and node are on PATH.");
  });

  const prefix = dim(`[${name}]`);
  const relay = (stream, sink) => {
    let buffer = "";
    stream.on("data", (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (options.onLine) options.onLine(line);
        if (!options.quiet) sink(`${prefix} ${line}`);
      }
    });
  };
  relay(child.stdout, (l) => console.log(l));
  relay(child.stderr, (l) => console.error(l));

  return record;
}

let shuttingDown = false;

/**
 * SIGINT contract: signal both trees, wait, escalate once, exit.
 *
 * Exits 0 on an operator-initiated stop — Ctrl-C is a successful end to a
 * dev session, not a failure, and a non-zero exit there would make any
 * wrapping script think the launch had broken.
 */
async function shutdown(code = 0) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`\n${dim("Shutting down…")}`);

  // The credential it holds dies with the API that minted it; leaving the
  // file behind would only invite a later session to trust a dead token.
  removeCredentialHandoff();

  for (const record of children) {
    if (record.exited) continue;
    try {
      process.kill(-record.child.pid, "SIGTERM");
    } catch {
      try {
        record.child.kill("SIGTERM");
      } catch {
        // Already gone.
      }
    }
  }

  const deadline = Date.now() + DEFAULTS.SHUTDOWN_GRACE_MS;
  while (Date.now() < deadline && children.some((r) => !r.exited)) {
    await sleep(100);
  }

  for (const record of children) {
    if (record.exited) continue;
    console.log(dim(`  ${record.name} did not stop in time — forcing.`));
    try {
      process.kill(-record.child.pid, "SIGKILL");
    } catch {
      // Already gone.
    }
  }
  await sleep(150);

  console.log(dim("Stopped."));
  process.exit(code);
}

// ---------------------------------------------------------------------------
// Readiness
// ---------------------------------------------------------------------------

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * True when nothing is listening on the port, as seen from loopback.
 *
 * Probes by *connecting*, not by binding. Binding to `127.0.0.1` reports a
 * port free when an existing listener is bound to the IPv6 wildcard `*` —
 * which is how Node's own `server.listen(port)` binds. The false "free"
 * then let the launcher start a second API, fail to bind, and health-check
 * the *other* process's API, reporting a healthy launch that was not ours.
 *
 * Connecting asks the question that actually matters: can something answer
 * on this port on loopback, which is exactly where the health gates look.
 */
async function isPortFree(port) {
  const { connect } = await import("node:net");
  return new Promise((resolve) => {
    const socket = connect({ port, host: "127.0.0.1" });
    let settled = false;
    const done = (free) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(free);
    };
    socket.setTimeout(1500);
    socket.once("connect", () => done(false));
    socket.once("timeout", () => done(true));
    socket.once("error", () => done(true));
  });
}

async function waitFor(label, url, timeoutMs, check) {
  const deadline = Date.now() + timeoutMs;
  let lastError = "no response yet";
  while (Date.now() < deadline) {
    if (shuttingDown) return false;
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
      if (await check(res)) return true;
      lastError = `HTTP ${res.status}`;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
    }
    await sleep(400);
  }
  fail(
    `${label} did not become ready within ${Math.round(timeoutMs / 1000)}s`,
    `Last attempt at ${url}: ${lastError}`,
    "Read the log lines above — the process prints its own error. Then run `pnpm dev` again.",
  );
  return false;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

const HELP = `
${bold("Foundry — one-command local operation")}

  pnpm dev                 Start the API and the frontend (backend mode)
  pnpm dev --mock          Start the frontend against the deterministic mock runtime
  pnpm dev --api-port N    Override the API port      (default ${DEFAULTS.API_PORT}, or $PORT)
  pnpm dev --web-port N    Override the frontend port (default ${DEFAULTS.WEB_PORT}, or $FOUNDRY_WEB_PORT)
  pnpm start               Same, from a production build

Configuration: see ${bold(".env.example")} — every variable, its default, and its effect.
Quickstart:    see ${bold("docs/operations/quickstart.md")}
`;

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    console.log(HELP);
    return;
  }

  const usedDotEnv = loadDotEnv();
  const config = resolveConfig(args);
  const total = config.apiUrl ? 5 : 3;
  let n = 0;

  console.log(bold("\nFoundry — starting\n"));
  if (usedDotEnv) console.log(dim("  configuration loaded from .env\n"));

  // 1. Preflight. Ports are checked before anything is spawned so a busy
  //    port is a clear message rather than a half-started system.
  step(++n, total, "Checking ports…");
  if (config.apiUrl && !(await isPortFree(config.apiPort))) {
    fail(
      `Port ${config.apiPort} (API) is already in use`,
      null,
      `Stop whatever is listening on ${config.apiPort}, or run \`pnpm dev --api-port <other>\`.`,
    );
  }
  if (!(await isPortFree(config.webPort))) {
    fail(
      `Port ${config.webPort} (frontend) is already in use`,
      "A Next.js dev server refuses to start a second instance from the same directory.",
      `Stop the process on port ${config.webPort}, or run \`pnpm dev --web-port <other>\`.`,
    );
  }

  if (config.apiUrl) {
    // 2. Build the API. A clean clone has no dist/, and starting before the
    //    bundle exists is the ordering dependency that was undocumented.
    step(++n, total, "Building the API…");
    await runToCompletion("build", "pnpm", ["--filter", "@foundry/api", "build"]);

    // 3. Start the API and wait for it to actually answer.
    step(++n, total, `Starting the API on :${config.apiPort}…`);
    launch("api", "node", [join("apps", "api", "dist", "main.js")], {
      env: { PORT: String(config.apiPort) },
      onLine: captureCredential,
    });
    await waitFor(
      "The API",
      `http://127.0.0.1:${config.apiPort}/health`,
      DEFAULTS.HEALTH_TIMEOUT_MS,
      async (res) => res.ok && (await res.json()).status === "ok",
    );
    console.log(`      ${green("✓")} API healthy`);
  }

  // 4. Hand the operator credential to the frontend server, on this host,
  //    through a file only this user can read (AC-105). This is what
  //    removes the read-a-token-out-of-a-terminal step; the credential
  //    never enters a build, and the browser fetches it over loopback.
  const handoffPath = config.apiUrl ? writeCredentialHandoff(config.apiPort) : null;

  // 5. Only now the frontend — deterministic ordering, so it never renders
  //    against a backend that is not yet answering.
  step(++n, total, `Starting the frontend on :${config.webPort}…`);
  launch(
    "web",
    "pnpm",
    config.production
      ? ["exec", "next", "start", "-p", String(config.webPort), "-H", LOOPBACK_HOST]
      : ["exec", "next", "dev", "-p", String(config.webPort), "-H", LOOPBACK_HOST],
    {
      cwd: join(ROOT, "apps", "agent-city"),
      env: {
        // AC-105: a server-side variable, read per request, so one build
        // serves either mode. `NEXT_PUBLIC_*` is deliberately not used —
        // that prefix is inlined at build time and is the defect itself.
        FOUNDRY_API_URL: config.apiUrl ?? "",
        // Cleared explicitly so a value inherited from the operator's
        // shell cannot silently override the mode chosen here.
        NEXT_PUBLIC_FOUNDRY_API_URL: "",
        ...(handoffPath ? { FOUNDRY_OPERATOR_CREDENTIAL_FILE: handoffPath } : {}),
      },
    },
  );

  step(n + 1, total, "Waiting for the frontend…");
  await waitFor(
    "The frontend",
    `http://127.0.0.1:${config.webPort}/`,
    DEFAULTS.WEB_TIMEOUT_MS,
    async (res) => res.ok,
  );

  ready(config);
}

async function runToCompletion(name, command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: ROOT, stdio: ["ignore", "pipe", "pipe"] });
    let output = "";
    child.stdout.on("data", (c) => (output += c.toString()));
    child.stderr.on("data", (c) => (output += c.toString()));
    child.on("exit", (code) => {
      if (code !== 0) {
        fail(
          `The API ${name} step failed (exit ${code})`,
          output.trim().split("\n").slice(-6).join("\n"),
          "Run `pnpm install` if you have not yet, then `pnpm dev` again.",
        );
      }
      resolve();
    });
    child.on("error", (err) =>
      fail(
        `Could not run \`${command}\``,
        err.message,
        "Check that pnpm is installed and on PATH.",
      ),
    );
  });
}

/**
 * The API prints its per-boot credentials once, to stdout. Surfacing the
 * operator's token in the ready banner is presentation only — the operator
 * still pastes it into the browser. Removing that step is AC-105.
 */
let operatorCredential = null;
function captureCredential(line) {
  const match = /^\s*operator\s+(\S+)\s+(\S+)\s*$/.exec(line);
  if (match) operatorCredential = { id: match[1], token: match[2] };
}

/**
 * Writes the operator credential where this host's frontend server can
 * read it, and nobody else can (AC-105 / F-104).
 *
 * `0600`, under a git-ignored directory, removed on shutdown. It is a file
 * copied between two processes owned by the same user on the same machine
 * — not a session, not a token service, and not something that survives
 * the run that created it.
 *
 * **The filename carries the API port.** A fixed name made the file shared
 * state between launcher instances: a second `pnpm dev` (or a
 * `pnpm verify:launch` run) overwrote the first one's credential and then
 * deleted it on its own shutdown, silently disarming the handoff of a
 * session that was still running. Instances are now disjoint by
 * construction, and each removes only the file it wrote.
 */
function writeCredentialHandoff(apiPort) {
  if (!operatorCredential) return null;
  const dir = join(ROOT, HANDOFF_DIR);
  const path = join(dir, `${HANDOFF_FILE}-${apiPort}`);
  try {
    mkdirSync(dir, { recursive: true, mode: 0o700 });
    writeFileSync(path, operatorCredential.token, { mode: 0o600 });
    handoffFileToRemove = path;
    return path;
  } catch (err) {
    // Not fatal: manual entry still works, and the UI will say so. A
    // launcher that refused to start over a convenience would be worse.
    console.log(
      dim(
        `      credential handoff unavailable (${err instanceof Error ? err.message : String(err)}) — paste manually`,
      ),
    );
    return null;
  }
}

function removeCredentialHandoff() {
  if (!handoffFileToRemove) return;
  try {
    rmSync(handoffFileToRemove, { force: true });
  } catch {
    // Best effort; the credential it held is already invalid once the API
    // that minted it has stopped.
  }
  handoffFileToRemove = null;
}

function ready(config) {
  const mode = config.apiUrl ? "backend" : "mock";
  console.log(`\n${green(bold("✓ Foundry is running."))}\n`);
  console.log(`  ${bold("Open")}      http://localhost:${config.webPort}`);
  console.log(
    `  ${bold("Mode")}      ${mode}${mode === "mock" ? " (deterministic mock runtime)" : ""}`,
  );
  if (config.apiUrl) {
    console.log(
      `  ${bold("API")}       http://localhost:${config.apiPort}  ${dim("(/health, /world-state, /events)")}`,
    );
    if (handoffFileToRemove) {
      // The token itself is deliberately not printed: it no longer needs
      // to be read, and printing a credential nobody has to copy only puts
      // it into terminal scrollback and shell logs for no benefit.
      console.log(
        `  ${bold("Operator")}  ${green("credential handed to the browser automatically")}`,
      );
      console.log(
        dim(
          `            No copy-paste needed. Change or clear it in the app's\n` +
            `            "Operator credential" panel at any time.`,
        ),
      );
    } else if (operatorCredential) {
      console.log(
        `\n  ${bold("Operator credential")} ${dim("(this process only; not persisted)")}`,
      );
      console.log(`    ${operatorCredential.token}`);
      console.log(
        dim(
          `    ${yellow("Automatic handoff unavailable")} — paste this into the app's\n` +
            `    "Operator credential" panel to enable operator actions.`,
        ),
      );
    }
  }
  console.log(`\n  ${dim("Press Ctrl-C to stop both processes.")}\n`);
}

process.on("SIGINT", () => void shutdown(0));
process.on("SIGTERM", () => void shutdown(0));

main().catch((err) => {
  fail("Unexpected error while starting", err instanceof Error ? err.message : String(err), null);
});
