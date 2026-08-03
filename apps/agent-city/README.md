# Agent City

Agent City is the first Foundry spatial application.

```text
Foundry Platform
└── Agent City
    └── V1 Operational Neighborhood
```

## Status

Foundation is **1.0**. **Agent City V1 is complete** — `FBL-001` through `FBL-035`, including the `FBL-021A` amendment rung, are closed, each under its own operator authorization, with final operator approval recorded on 2026-08-01 (`docs/evidence/fbl-035/operator-final-approval.md`).

The full V1 placeholder neighborhood (Lighthouse, residences, operational buildings, roads, the utility vehicle, and the three agents) is wired to a deterministic mock runtime whose events drive every 2D panel and 3D world object, and the complete primary user journey — objective through build completion and the Warehouse Level 1→2 upgrade — runs end-to-end on that mock runtime. Behind it sit persistence (`FBL-023`), the backend API (`FBL-024`, `apps/api`), backend-authoritative state machines (`FBL-025`), realtime delivery (`FBL-026`), the runtime-adapter policy boundary (`FBL-027`), one controlled Claude Code execution (`FBL-028`), independent Inspector validation (`FBL-029`), the human approval workflow (`FBL-030`), the capability-based Warehouse upgrade (`FBL-031`), restart and recovery (`FBL-032`), accessibility and reduced motion (`FBL-033`), and ultrawide performance validation (`FBL-034`).

The V1 Build Ladder has reached its **terminal stop** and grants no standing authorization. Further implementation requires a new reviewed mission baseline. See `docs/03-architecture/foundry-build-ladder.md`.

This app can also run as a live projection of backend truth over SSE.

**The runtime is selectable — at build time.** The deterministic mock runtime (`src/lib/mock-runtime/`, ADR-001 / Principle 3a) is the **default** — it is what every test and the demo mode run against, with no backend required. Setting `NEXT_PUBLIC_FOUNDRY_API_URL` points the app at a real `apps/api` instance instead:

```sh
NEXT_PUBLIC_FOUNDRY_API_URL=http://localhost:4000 pnpm --filter @foundry/agent-city dev
```

**Important limitation:** `src/app/page.tsx` reads this variable at module scope, and Next.js inlines `NEXT_PUBLIC_*` values **at build time**. A `next build` artifact is therefore permanently mock-mode or permanently backend-mode; switching requires a rebuild. The command above works in development only. See `docs/audits/agent-city-post-v1-truth-audit.md` PV1-028.

In backend mode the app subscribes to `/events/stream`, reconciles from `/world-state` on connect and reconnect, and submits commands to `/commands` (where FBL-025 enforces them). On disconnect it labels the projection stale, shows the Lighthouse as `disconnected`, and disables every mutation control until the stream is restored — it never invents authoritative events while offline.

**What backend mode does not yet do.** Against a fresh `apps/api`, `/world-state` returns the initial projection with no project, build, stages, or approvals, and there is no operator surface for submitting an objective — so the world is empty and nothing can create work. The six persistent command-bar controls send `demo.*` command types, which are not in the closed `COMMAND_TYPES` vocabulary; the backend rejects them with `400` and the current rejection handler does not surface that, so those controls fail **silently** in backend mode. `building.selected` is emitted only by the mock runtime. These are recorded as PV1-012, PV1-013, and PV1-052 in the Post-V1 truth audit; the projection machinery itself works as described.

## Run locally

From the repository root:

```sh
pnpm install
pnpm dev
```

That starts the API and this app together, in that order, and prints the operator credential — see [`docs/operations/quickstart.md`](../../docs/operations/quickstart.md). It is the documented way to run Foundry (`AC-104`). Add `--mock` to run this app alone against the deterministic mock runtime, with no API and no credential:

```sh
pnpm dev --mock
```

To run only this app, without the launcher:

```sh
pnpm --filter @foundry/agent-city dev
```

Then open `http://localhost:3000`. Started this way the app uses the mock runtime unless `NEXT_PUBLIC_FOUNDRY_API_URL` is set in the real environment; the root launcher is what normally sets it.

**Configuration:** every variable, its default, and its effect is enumerated in [`.env.example`](../../.env.example) — the single place.

## Demonstration: observing the complete V1 primary journey

The demo starts automatically on page load (`demo.start`, at 1x speed) and runs the deterministic canonical script end-to-end with no further input required. To observe it as an operator:

1. **Open the app.** The build begins running immediately — the top-left "World objects" panel and bottom timeline populate as events arrive.
2. **(Optional) Speed it up.** The speed selector in the persistent command bar at the very bottom of the screen (1×/2×/4×) changes only playback pacing, never event order or content — 4× is a comfortable speed for watching the whole journey in under a minute.
3. **Watch the intentional failure.** Within the first few seconds, the `frontend_implementation` stage in the left navigation's "Stages" list turns **blocked**, the "Current build" status reads **blocked**, and the Construction Office (3D) and Cargo crate (3D, beside the Warehouse) both show a matching blocked signal. Click the stage row to see the exact failed requirement and evidence in the detail panel.
4. **Watch the repair.** The Builder retries automatically; the stage recovers to running, then completed, and the build status leaves "blocked."
5. **Watch independent validation.** Once the package physically arrives at QA (via the Warehouse→QA transfer), the QA building goes active and the Inspector agent validates — never the Builder.
6. **Watch for the approval request.** The Lighthouse (3D) turns to its "Attention required" (yellow) signal, and an **Approval card** appears in the top-right of the world region with the risk class, reason, evidence, and Approve/Reject/Request-revision controls. Click **Approve** to let the journey continue (Reject/Request revision are also wired — see `docs/02-specification/event-model.md` § Approval).
7. **Watch the transfer.** Only after your approval does the final transfer to the Deployment Dock start; the utility vehicle (3D) and the matching road segment are the only things that ever move, and only once `transfer.started` has fired.
8. **Watch build completion.** "Current build" status reads **completed**, and shortly after, the Warehouse becomes upgrade-eligible from the same 10-successful-package seeded-history rule (`docs/02-specification/domain-model.md` § "Warehouse Level 2 prerequisites"), is auto-approved by the mock operator authority, and completes — the Warehouse's 3D model and its detail-panel `level:` field both flip from 1 to 2 in the same event (`upgrade.completed`), never before it.

At every one of these transitions, the **left navigation, right live-intelligence panel, bottom event timeline, and selected-object detail panel together communicate the same facts the 3D world does** — what's running, who's working, what's blocked, what failed, what needs approval, what completed, and what happens next — entirely without the 3D canvas, per Principle 23.

Other useful controls in the persistent command bar:

- **Pause / Resume** — freezes/resumes scheduling without reordering or losing events.
- **Reset** — clears all state and starts over from `system.started`.
- **Replay** — re-emits the identical seeded sequence deterministically from scratch (same seed unless a new one is supplied).

The bottom event timeline itself additionally offers severity/entity/type filters and "Pause autoscroll," for inspecting any specific event's payload.

A complete, checked-in recording of one full canonical run (every event plus the final world state) lives at `src/lib/mock-runtime/__fixtures__/v1-canonical-run.json` — regenerated and diffed on every test run (`recordedRun.test.ts`), and intended as the baseline a real backend's equivalent run can later be compared against (FBL-031).

## Testing

```sh
pnpm --filter @foundry/agent-city test        # unit tests (Vitest + Testing Library)
pnpm --filter @foundry/agent-city test:e2e    # browser tests (Playwright, all 3 target viewports)
```

**Run the browser suite at `--workers=3`.** Several specs drive the demo at 4× speed and assert on real elapsed progress (approval appearing, the canonical run completing), so they are sensitive to machine load. Playwright's default worker count on a larger machine over-subscribes the CPU and starves those timers, producing failures that are contention artifacts rather than real regressions:

```sh
pnpm --filter @foundry/agent-city exec playwright test --workers=3
```

The single most relevant test for the complete journey is `src/lib/mock-runtime/v1PrimaryJourney.test.ts` (every numbered step of `docs/02-specification/v1-acceptance.md`'s "Primary user journey," asserted in order against the real mock runtime) and `e2e/shell-v1-primary-journey.spec.ts` (the same journey, live in a real browser, including reduced-motion and 2D-only-comprehension variants).

## Authority

- `FOUNDATION_VERSION.md`
- `docs/01-mission/active-mission.md`
- `docs/01-mission/v1-scope.md`
- `docs/01-mission/exclusions.md`
- `docs/02-specification/`
- `docs/03-architecture/foundry-build-ladder.md`

The V1 Build Ladder is closed at its terminal rung. Any further implementation work requires a new reviewed mission baseline; completed `FBL-*` rungs are historical and are never reopened, renumbered, or re-graded.
