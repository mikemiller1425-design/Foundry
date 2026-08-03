#!/usr/bin/env node
/**
 * AC-105 acceptance check for F-103 and the bundle half of F-104.
 *
 * Builds the frontend **once**, then starts that same output twice with
 * different environments and asserts it serves a different runtime mode
 * each time. That is the whole claim: mode is a run-time input, not
 * something frozen into the artifact (PV1-028).
 *
 * A unit test cannot make this claim. `resolveRuntimeSelection` being
 * correct says nothing about whether Next prerendered the page and baked
 * the answer in — which is exactly how the defect worked. Only building
 * and starting the real artifact settles it.
 *
 * Also asserts that no operator credential appears in the built client
 * bundle or in the served HTML, even while a handoff file exists.
 *
 * Run with `pnpm verify:runtime-mode`.
 */

import { spawn } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { connect } from "node:net";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const APP = join(ROOT, "apps", "agent-city");
const PORT = Number(process.env.VERIFY_MODE_PORT ?? 3440);
const API_URL = "http://127.0.0.1:4440";
const SENTINEL = "sentinel-operator-credential-do-not-embed";
const HANDOFF = join(ROOT, ".foundry", "verify-runtime-mode-credential");

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const results = [];
function check(name, passed, detail) {
  results.push({ name, passed });
  console.log(`  ${passed ? "PASS" : "FAIL"}  ${name}${detail ? `  — ${detail}` : ""}`);
}

function portFree(port) {
  return new Promise((resolve) => {
    const s = connect({ port, host: "127.0.0.1" });
    let done = false;
    const f = (v) => {
      if (done) return;
      done = true;
      s.destroy();
      resolve(v);
    };
    s.setTimeout(1200);
    s.once("connect", () => f(false));
    s.once("timeout", () => f(true));
    s.once("error", () => f(true));
  });
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd ?? ROOT,
      stdio: "pipe",
      env: { ...process.env, ...options.env },
    });
    let out = "";
    child.stdout.on("data", (c) => (out += c.toString()));
    child.stderr.on("data", (c) => (out += c.toString()));
    child.on("exit", (code) => (code === 0 ? resolve(out) : reject(new Error(out.slice(-2000)))));
  });
}

/** Starts `next start` on the prebuilt output and waits for it to serve. */
async function serve(env) {
  const child = spawn("pnpm", ["exec", "next", "start", "-p", String(PORT), "-H", "127.0.0.1"], {
    cwd: APP,
    stdio: "pipe",
    detached: true,
    env: { ...process.env, ...env },
  });
  const deadline = Date.now() + 90_000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/`);
      if (res.ok) return { child, html: await res.text() };
    } catch {
      // not up yet
    }
    await sleep(400);
  }
  throw new Error("next start did not serve in time");
}

async function stop(child) {
  try {
    process.kill(-child.pid, "SIGTERM");
  } catch {
    /* already gone */
  }
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline && !(await portFree(PORT))) await sleep(200);
}

function listBundleFiles(dir) {
  const files = [];
  const walk = (d) => {
    if (!existsSync(d)) return;
    for (const entry of readdirSync(d)) {
      const p = join(d, entry);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith(".js")) files.push(p);
    }
  };
  walk(dir);
  return files;
}

async function main() {
  console.log("\nAC-105 / F-103 — one build, both runtime modes\n");

  if (!(await portFree(PORT))) {
    console.error(`\nCannot run: port ${PORT} is in use. Set VERIFY_MODE_PORT and retry.\n`);
    process.exit(1);
  }

  // A handoff file exists throughout, so the bundle check is meaningful
  // rather than vacuous.
  mkdirSync(join(ROOT, ".foundry"), { recursive: true, mode: 0o700 });
  writeFileSync(HANDOFF, SENTINEL, { mode: 0o600 });

  console.log("  building once…\n");
  await run("pnpm", ["exec", "next", "build"], {
    cwd: APP,
    env: { FOUNDRY_API_URL: "", NEXT_PUBLIC_FOUNDRY_API_URL: "" },
  });

  let backendHtml;
  let mockHtml;

  // --- Same artifact, backend mode -----------------------------------------
  {
    const { child, html } = await serve({
      FOUNDRY_API_URL: API_URL,
      NEXT_PUBLIC_FOUNDRY_API_URL: "",
      FOUNDRY_OPERATOR_CREDENTIAL_FILE: HANDOFF,
    });
    backendHtml = html;
    check(
      "built artifact serves BACKEND mode when FOUNDRY_API_URL is set",
      html.includes("credential-panel"),
    );
    check(
      "the served HTML contains no operator credential",
      !html.includes(SENTINEL),
      "credential is fetched over loopback, never server-rendered",
    );
    const handoffRes = await fetch(`http://127.0.0.1:${PORT}/api/operator-credential`);
    const handoffBody = await handoffRes.json();
    check("the loopback handoff route serves the credential", handoffBody.credential === SENTINEL);
    await stop(child);
  }

  // --- Same artifact, no rebuild, mock mode --------------------------------
  {
    const { child, html } = await serve({
      FOUNDRY_API_URL: "",
      NEXT_PUBLIC_FOUNDRY_API_URL: "",
      FOUNDRY_OPERATOR_CREDENTIAL_FILE: HANDOFF,
    });
    mockHtml = html;
    check(
      "the SAME artifact serves MOCK mode when FOUNDRY_API_URL is empty",
      !html.includes("credential-panel"),
    );
    await stop(child);
  }

  check(
    "no rebuild occurred between the two modes",
    Boolean(backendHtml) && Boolean(mockHtml) && backendHtml !== mockHtml,
    "one `next build`, two `next start` runs",
  );

  // --- F-104: nothing in the client bundle ---------------------------------
  const bundles = listBundleFiles(join(APP, ".next", "static"));
  const leaked = bundles.filter((f) => readFileSync(f, "utf-8").includes(SENTINEL));
  check(
    "no operator credential in the client bundle",
    leaked.length === 0,
    `${bundles.length} bundle files scanned`,
  );
  const publicEnvLeak = bundles.filter((f) =>
    readFileSync(f, "utf-8").includes("NEXT_PUBLIC_FOUNDRY_OPERATOR"),
  );
  check("no NEXT_PUBLIC_* credential variable exists", publicEnvLeak.length === 0);

  rmSync(HANDOFF, { force: true });

  const passed = results.filter((r) => r.passed).length;
  const failed = results.length - passed;
  console.log(`\n  ${passed} passed, ${failed} failed, ${results.length} total\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(async (err) => {
  rmSync(HANDOFF, { force: true });
  console.error("\nverification crashed:", err.message ?? err);
  process.exit(1);
});
