# Agent City

Agent City is the first Foundry spatial application.

```text
Foundry Platform
└── Agent City
    └── V1 Operational Neighborhood
```

## Status

Foundation is **1.0**. `FBL-001` through `FBL-022` are complete: the full V1 placeholder neighborhood (Lighthouse, residences, operational buildings, roads, the utility vehicle, and the three agents) is wired to a deterministic mock runtime whose events drive every 2D panel and 3D world object, and the complete primary user journey — objective through build completion and the Warehouse Level 1→2 upgrade — runs end-to-end on that mock runtime. `FBL-023` (persistence) and `FBL-024` (backend API, `apps/api`) are also complete, under a new operator-authorized bounded sequence covering `FBL-023`–`FBL-026`. See `docs/03-architecture/foundry-build-ladder.md`; each further rung still requires its own separate, explicit operator authorization.

This app (`apps/agent-city`) is still not wired to the backend — everything it renders is still produced by the frontend-local, deterministic mock runtime (`src/lib/mock-runtime/`) per ADR-001 and Principle 3a, which remains the temporary stand-in operational authority for this app. A real backend now exists (`apps/api`, backed by `packages/persistence`), but connecting this app to it is not yet authorized.

## Run locally

```sh
pnpm install
pnpm --filter @foundry/agent-city dev
```

Then open `http://localhost:3000`.

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

The single most relevant test for the complete journey is `src/lib/mock-runtime/v1PrimaryJourney.test.ts` (every numbered step of `docs/02-specification/v1-acceptance.md`'s "Primary user journey," asserted in order against the real mock runtime) and `e2e/shell-v1-primary-journey.spec.ts` (the same journey, live in a real browser, including reduced-motion and 2D-only-comprehension variants).

## Authority

- `FOUNDATION_VERSION.md`
- `docs/01-mission/active-mission.md`
- `docs/01-mission/v1-scope.md`
- `docs/01-mission/exclusions.md`
- `docs/02-specification/`
- `docs/03-architecture/foundry-build-ladder.md`

Each build ladder rung beyond what is marked complete above requires its own separate, explicit operator authorization.
