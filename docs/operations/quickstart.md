# Foundry — Operator Quickstart

**Foundation:** 1.0
**Mission:** V1.1 — Operational Readiness and First Real Build
**Rung:** `AC-104` — One-command local operation

Everything needed to go from a clean clone to a running Foundry. If you are reading any other document to get started, this one has failed.

---

## Start it

```bash
pnpm install
pnpm dev
```

That is the whole thing. `pnpm dev` builds the API, starts it, waits until it is genuinely healthy, then starts the frontend and waits until it serves — in that order, every time.

When it is ready you will see:

```text
✓ Foundry is running.

  Open      http://localhost:3000
  Mode      backend
  API       http://localhost:4000  (/health, /world-state, /events)

  Operator  credential handed to the browser automatically
            No copy-paste needed. Change or clear it in the app's
            "Operator credential" panel at any time.

  Press Ctrl-C to stop both processes.
```

Open <http://localhost:3000> and you have a working Foundry. **You do not need to copy a token** — the launcher hands the operator credential to the browser for you (`AC-105`).

## Stop it

**Ctrl-C.** Both processes are signalled, given time to exit, escalated once if they do not, and both ports are released. Ctrl-C exits `0` — stopping a dev session is a success, not a failure.

## Options

| Command | What it does |
| --- | --- |
| `pnpm dev` | API + frontend, backend mode. **The documented one command.** |
| `pnpm dev --mock` | Frontend only, against the deterministic mock runtime. No API, no credential needed. |
| `pnpm dev --api-port 4001` | Override the API port (or set `PORT`). |
| `pnpm dev --web-port 3001` | Override the frontend port (or set `FOUNDRY_WEB_PORT`). |
| `pnpm dev --help` | Show all options. |
| `pnpm start` | Same, from a production build. **One build serves either mode** — `FOUNDRY_API_URL` decides at start time, with no rebuild (`AC-105`). |

## Configuration

**Every variable, its default, and its effect is in [`.env.example`](../../.env.example).** That is the single place. If a variable is not there, no code reads it.

Copy it to `.env` and edit, or export variables in your shell. `pnpm dev` loads `.env` using Node's built-in env-file support — no dependency and no bespoke parser. Anything already exported wins, so `PORT=4001 pnpm dev` overrides the file.

**Every variable is optional.** With an empty environment, `pnpm dev` starts a working Foundry.

## The operator credential

Actions that need an authenticated operator — submitting an objective, resolving an approval — require a credential. The API mints one per boot and never persists it.

**You normally do nothing.** `pnpm dev` writes the credential to a file only your user can read (`.foundry/operator-credential`, mode `0600`, deleted on shutdown), tells the frontend server where it is, and the browser fetches it over loopback on first load. The token is never inlined into the built bundle and never appears in the page HTML.

The app's **"Operator credential"** panel, top of the left navigator, always shows where you stand:

| State | Meaning | What to do |
| --- | --- | --- |
| **Operator credential held** | Working. | Nothing. **Change** or **Clear** are there if you need them. |
| **No credential** | This browser holds none. | Press *Use this session's credential*, or paste one. |
| **Stale credential** | Held credential is from an earlier API session. Restarting the API mints a new one. | Press *Use this session's credential*. |
| **Credential rejected** | The backend refused it — it is not this session's token. | Use this session's credential, or clear and paste the right one. |
| **Backend unreachable** | The API is not answering, so nothing can be checked. | Confirm the API is running; the state re-evaluates on reconnect. |

**Manual entry is always available**, and **Change**/**Clear** mean a mistaken token is always recoverable.

If the handoff cannot be performed for any reason, the launcher prints the token and says so, and the panel falls back to manual entry. It never fails silently.

## One thing this rung deliberately does not do

**It is not a session system.** No login, no expiry, no refresh, no logout, no users — `v1-scope.md` excludes authentication as a feature and that exclusion carries forward. This is a file copied between two processes owned by the same person on the same machine, which is the smallest thing that removes the copy-paste step.

## When something goes wrong

The launcher states the problem, the detail, and what to do. The common cases:

| Message | What to do |
| --- | --- |
| `Port 4000 (API) is already in use` | Stop whatever holds it, or `pnpm dev --api-port 4001`. |
| `Port 3000 (frontend) is already in use` | A Next dev server refuses a second instance from the same directory. Stop it, or `pnpm dev --web-port 3001`. |
| `The API did not become ready within 60s` | Read the `[api]` lines above it — the API prints its own error. |
| `The API build step failed` | Run `pnpm install`, then `pnpm dev` again. |

**A restart mints new credentials.** The old token stops working. Paste the new one from the banner.

**To clear the world and start from an empty event log**, stop Foundry and delete the database:

```bash
rm apps/api/data/foundry.sqlite*
```

This is the only way to release an active project: V1 permits one active project and has no command that closes one, so a second objective is refused until the log is empty.

## Verifying the launch path

```bash
pnpm verify:launch        # F-101 — the launch path
pnpm verify:runtime-mode  # F-103 — one build, both modes
```

`verify:launch` drives the real command on non-default ports and asserts what `F-101` requires: one command starts both processes in deterministic order, `/health` returns 200, the frontend serves 200, SIGINT terminates cleanly with exit 0, and both ports are released.

`verify:runtime-mode` builds the frontend **once**, then starts that same output twice with different environments and asserts it serves backend mode and then mock mode with no rebuild — plus that no operator credential appears in the built bundle or in the served HTML.

It is a script rather than a unit test on purpose — it builds, boots, and binds real ports, which would make the fast test gate slow for everyone.

## What is running

| Process | Port | Role |
| --- | --- | --- |
| `apps/api` | 4000 | Backend authority. Owns the event log and the SQLite database; every state change goes through its command handler. |
| `apps/agent-city` | 3000 | The operator's window. A projection of backend truth over SSE — it never invents state. |

In `--mock` mode only the frontend runs, replaying a deterministic recorded scenario. That mode is the regression baseline and is not a simulation of the backend.

---

**Related:** [`.env.example`](../../.env.example) · [`docs/01-mission/agent-city-v1.1-mission.md`](../01-mission/agent-city-v1.1-mission.md) · [`docs/03-architecture/agent-city-v1.1-build-ladder.md`](../03-architecture/agent-city-v1.1-build-ladder.md)
