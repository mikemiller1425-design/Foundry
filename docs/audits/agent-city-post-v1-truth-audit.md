# Agent City — Post-V1 Truth Audit

**Type:** Independent read-only audit
**Date:** 2026-08-03
**Audited commit:** `3cdd539` (working tree clean at audit time)
**Auditor:** Claude Code, under operator instruction
**Method:** Documentation read against source, tests executed, no files under audit modified

---

## 0. Authority and standing of this document

This document has **no authority**. It amends nothing.

- **Foundry Foundation 1.0 is frozen.** Nothing here changes a principle, domain term, ADR, or mission scope.
- **Agent City V1 is complete.** `FBL-001`–`FBL-035` including `FBL-021A` are historical completed authority and are not reopened, renumbered, or re-graded by this audit.
- **Finding 6 is open technical debt**, carried forward exactly as `FOUNDATION_VERSION.md` and `docs/evidence/fbl-035/operator-final-approval.md` record it.
- **Future Registry concepts are inactive** and are not promoted anywhere in this document.

A finding here becomes actionable only if the operator ratifies a V1.1 mission baseline. See `docs/proposals/agent-city-v1.1-mission-proposal.md`.

## 0.1 What was executed

`pnpm -r run test` was run against `3cdd539` on 2026-08-03 and passed: **813 tests / 78 files, 0 failures** (contracts 56, ui 18, world-model 7, event-types 14, runtime-adapters 128, persistence 135, agent-city 411, api 44). This reproduces the count in `docs/evidence/fbl-035/v1-acceptance-report.md`. Browser, WebKit, and performance suites were **not** re-run; claims about them in this audit are sourced from the FBL-033/034/035 evidence records, not re-verified.

## 0.2 Severity and disposition scales

| Severity | Meaning |
| --- | --- |
| **BLOCKER** | A governing or entry-point document is materially false, or a promised capability cannot be performed at all. Must be resolved before V1.1 work begins. |
| **MAJOR** | Materially misleading, or a real gap that a complete real build would hit. |
| **MINOR** | Accurate-but-stale, cosmetic, or narrow. |
| **INFO** | Recorded fact, no defect asserted. |

| Class | Meaning |
| --- | --- |
| **Documentation correction** | The system is right; the writing is wrong. No behavior change. |
| **Defect** | Behavior does not match a document that was authoritative when it was written. |
| **Hardening** | Behavior is as specified, but insufficient for real operation. |
| **New scope** | Neither wrong nor insufficient — simply not part of V1. Requires a new mission baseline. |

**Counts:** 53 findings — **9 BLOCKER, 29 MAJOR, 10 MINOR, 5 INFO**. Five findings carry no separate class line: PV1-010 is the capability inventory, and PV1-044, PV1-045, PV1-050, PV1-051 are cross-references to findings stated in full elsewhere; of the 48 classed findings: 11 documentation correction, 6 defect (four pure, two combined), 18 hardening, 13 new scope, 1 operator-dependent.

---

## 1. Documentation that contradicts current implementation status

The single largest category. Twelve documents (§14 consolidates them) are false about project status; three state in the present tense that Agent City has no code and that implementation is blocked.

### PV1-001 — `README.md` declares implementation blocked and the application non-existent — **BLOCKER**

- **Evidence:** `README.md:77` ("`apps/agent-city/     Agent City application (not implemented yet)`"), `README.md:94–98` (Foundation **1.0-rc1**, Application code **None**, Dependencies installed **None**, Implementation **Blocked**), `README.md:100–110` ("## Implementation blocked … Do not write application code, install dependencies, scaffold Next.js…").
- **Current behavior:** The repository contains a complete Next.js application, a backend service, six shared packages, and 813 passing tests. `FOUNDATION_VERSION.md` records Foundation 1.0 and V1 complete as of 2026-08-01.
- **Claimed behavior:** Foundation is 1.0-rc1, awaiting a specification audit; no application code exists; all implementation is prohibited.
- **Risk:** The repository's front door instructs any new reader or agent to refuse to work on the codebase that surrounds it, and misidentifies the foundation version. It is the most-read file and the most wrong.
- **Disposition:** Rewrite the "Current status" table and delete the "Implementation blocked" section; correct the repository map. Do this in a documentation-only rung before any V1.1 feature work.
- **Class:** Documentation correction.

### PV1-002 — `docs/01-mission/active-mission.md` still describes a pre-implementation mission — **BLOCKER**

- **Evidence:** `docs/01-mission/active-mission.md:3` (`Foundation: 1.0-rc1`), `:4` ("Mission status: Active (documentation only; implementation blocked pending audit)"), `:28–31` (status table: application code "Not started — **blocked**"), stop condition ("No application code may start until the foundation audit is reviewed").
- **Current behavior:** The mission is complete and approved. `FOUNDATION_VERSION.md` names this exact file as "Active mission document."
- **Claimed behavior:** The mission is documentation-only and implementation has not begun.
- **Risk:** Highest-priority document in the stated authority order (`README.md` § "Documentation authority order", priority 1) directly contradicts `FOUNDATION_VERSION.md`, which is the *other* priority-1 document. Two priority-1 documents disagree with each other about whether the product exists.
- **Disposition:** Add a completion status block; retire the pre-implementation status table and stop condition. Under the change-control rule this is a clarification of operational status, not a scope amendment — but it touches a Foundation 1.0 document and therefore needs explicit operator authorization.
- **Class:** Documentation correction.

### PV1-003 — `CONTRIBUTING.md` prohibits dependency installation and application code — **MAJOR**

- **Evidence:** `CONTRIBUTING.md:18`, `CONTRIBUTING.md:29` (rule 8).
- **Current behavior:** Dependencies are installed; `pnpm-lock.yaml` is 118 KB; eight workspace projects build.
- **Claimed behavior:** Foundation is 1.0-rc1 and implementation is blocked pending audit.
- **Risk:** A contributor following the stated rules cannot legitimately touch the repository.
- **Disposition:** Correct status paragraph and rule 8.
- **Class:** Documentation correction.

### PV1-004 — Fourteen active documents carry the stale `Foundation: 1.0-rc1` header — **MAJOR**

- **Evidence:** `docs/00-foundry/{vision,glossary,principles}.md`, `docs/01-mission/{active-mission,v1-scope,exclusions}.md`, `docs/02-specification/{domain-model,event-model,world-model,interface-model,v1-acceptance}.md`, `docs/03-architecture/implementation-plan.md`, `docs/04-future/registry.md`. Only `docs/03-architecture/foundry-build-ladder.md` reads `Foundation: 1.0`.
- **Current behavior:** `FOUNDATION_VERSION.md` records Foundation **1.0**, approved 2026-07-30.
- **Claimed behavior:** Every specification document self-identifies as a release candidate.
- **Risk:** A reader cannot tell from any specification document that it is the frozen 1.0 text. Version provenance of the frozen baseline is unverifiable from the documents themselves.
- **Disposition:** Single mechanical header correction across all fourteen, in one reviewed change, with no body edits.
- **Class:** Documentation correction.

### PV1-005 — `docs/03-architecture/implementation-plan.md` is marked "Planning only — implementation blocked pending audit" — **MAJOR**

- **Evidence:** `docs/03-architecture/implementation-plan.md:5`; all 18 stages are written in the future tense; stage 18's gate ("All mandatory tests pass; V1 complete") was reached on 2026-08-01.
- **Current behavior:** All 18 stages executed via `FBL-001`–`FBL-035`.
- **Claimed behavior:** Nothing has started.
- **Risk:** Priority-6 authority document contradicts priority-1. Low practical risk (the Build Ladder superseded it operationally) but it is still an active document.
- **Disposition:** Mark superseded-by-ladder and complete; do not rewrite the stage content.
- **Class:** Documentation correction.

### PV1-006 — Four package READMEs claim "no implementation" for fully implemented packages — **MAJOR**

- **Evidence:** `packages/contracts/README.md:5–7`, `packages/event-types/README.md:5–7`, `packages/ui/README.md:5–7`, `packages/world-model/README.md:5–7` — each reads "Reserved package placeholder. No implementation in Foundation v1.0."
- **Current behavior:** `packages/contracts` holds 15 entity schemas plus the closed 84-entry command vocabulary (56 tests); `packages/event-types` holds the full event envelope and 12 event families (14 tests); `packages/ui` ships the panel primitives (18 tests); `packages/world-model` holds the nine buildings, three agents, vehicle, roads, and visual-state tables (7 tests).
- **Claimed behavior:** All four are empty placeholders.
- **Risk:** The four packages that *define the shared contract* advertise themselves as non-existent. `packages/persistence` and `packages/runtime-adapters` READMEs are accurate, which makes the inconsistency look deliberate rather than stale.
- **Disposition:** Rewrite the four Status sections to match their implemented contents.
- **Class:** Documentation correction.

### PV1-007 — `apps/agent-city/README.md` status stops at FBL-026 — **MAJOR**

- **Evidence:** `apps/agent-city/README.md:13` — describes `FBL-001`–`FBL-022` and `FBL-023`–`FBL-026` as the completed frontier, with "each further rung still requires its own separate, explicit operator authorization."
- **Current behavior:** V1 is complete through `FBL-035`.
- **Claimed behavior:** Nine further rungs remain unauthorized.
- **Risk:** Reads as an in-flight project rather than a completed mission; understates Inspector validation, approval workflow, upgrade, recovery, accessibility, and performance work that all landed afterwards.
- **Disposition:** Update status paragraph.
- **Class:** Documentation correction.

### PV1-008 — `apps/api/README.md` security caveat is materially false in both directions — **MAJOR**

- **Evidence:** `apps/api/README.md:7` (status stops at FBL-026) and `:9` ("V1 has no authentication system … The optional `actor` on a command is a caller-asserted claim, not a verified identity, so actor-sensitive guards (notably F-05's Inspector-only validation) are only as trustworthy as the caller"). Contradicted by `apps/api/src/app.ts:180–200` (bearer credential resolved through `PrincipalRegistry`, `403 actor_mismatch` on contradiction), `apps/api/src/main.ts:30–55` (per-boot agent and operator credential minting), and `packages/contracts/src/commands.ts` comment block, which explicitly records that FBL-029 replaced the caller-asserted model.
- **Current behavior:** Identity is established by a backend-issued bearer token; an anonymous caller cannot pass the Inspector guard; a body `actor` disagreeing with the credential is refused.
- **Claimed behavior:** No authentication exists and F-05 is trust-based.
- **Risk:** Understates the control that makes F-05 real, while simultaneously omitting the *actual* limitations (wildcard CORS, unauthenticated reads, plaintext transport, non-expiring tokens in `localStorage` — see §9). A reader gets a wrong picture of the security posture in both directions.
- **Disposition:** Rewrite the status and security sections against `app.ts`, `main.ts`, and `operatorCredential.ts` as they now stand.
- **Class:** Documentation correction.

### PV1-009 — `docs/handoffs/002-frontend-foundation.md` names `FBL-003` as next eligible — **MINOR**

- **Evidence:** `docs/handoffs/002-frontend-foundation.md:6`.
- **Current behavior:** All rungs closed.
- **Claimed behavior:** `FBL-003` is next.
- **Risk:** Low — the file self-identifies as reference material that grants no authority.
- **Disposition:** Add a historical-record banner. Do not rewrite.
- **Class:** Documentation correction.

---

## 2. Implemented capabilities

### PV1-010 — Verified capability inventory — **INFO**

Everything below was confirmed by reading source and running the unit/integration suite.

| Capability | Where | Authority |
| --- | --- | --- |
| Ultrawide shell: system bar, left nav, world host, live intelligence, timeline, command strip, collapsible/resizable panels | `apps/agent-city/src/components/shell/`, `packages/ui/src/panel/` | Backend-independent |
| 3D neighborhood: 9 buildings, 3 residences, 3 agents, roads, vehicle, cargo, Lighthouse, selection, camera rig, environment | `apps/agent-city/src/components/world/` | Renders projection |
| Event timeline with filter, autoscroll pause, payload inspect, jump-to-world-object, 10k-event virtualization | `apps/agent-city/src/components/timeline/` | Renders projection |
| Deterministic mock runtime: 1,043-line canonical script, replay, speed, reset, recorded-run fixture diffing | `apps/agent-city/src/lib/mock-runtime/` | Stand-in authority (principle 3a) |
| Shared contracts: 15 entities, 84 command types, full event vocabulary, `V1RiskClassSchema` = R0–R2 only | `packages/contracts/`, `packages/event-types/` | Contract |
| Persistence: transactional idempotent event append, entity projection, world-state snapshot, subscriber fan-out | `packages/persistence/` | **Backend-authoritative** |
| Transition enforcement: per-entity transition graphs plus named invariant guards; rejection carries reason + corrective action, zero mutation | `packages/persistence/src/{transitionGraphs,commandHandler}.ts` | **Backend-authoritative** |
| Credentialed identity: per-boot agent and operator principals; `403 actor_mismatch` | `packages/persistence/src/principals.ts`, `apps/api/src/app.ts` | **Backend-authoritative** |
| HTTP surface: health, world-state, entities, events, SSE stream with `Last-Event-ID` replay, commands | `apps/api/src/{app,eventStream}.ts` | **Backend-authoritative** |
| Runtime policy boundary: deny-by-default command allowlist, no-regex argument rules, environment allowlist, symlink-resolving path containment, timeouts, output caps, evidence capture, redaction | `packages/runtime-adapters/` | **Backend-authoritative** |
| Controlled Claude Code adapter: fixed argv, R2 ceiling, tool restriction, post-hoc write-scope diff, independent test validation | `packages/runtime-adapters/src/adapters/claudeCodeAdapter.ts`, `.../controlledStage/` | **Backend-authoritative** |
| Backend-mode frontend: SSE subscription, snapshot reconcile, stale labeling, mutation lockout while disconnected, operator credential entry | `apps/agent-city/src/lib/backend/` | Projection of backend |

---

## 3. Mock-only capabilities

### PV1-011 — The entire V1 workflow sequence exists only as a hardcoded frontend script — **MAJOR**

- **Evidence:** `apps/agent-city/src/lib/mock-runtime/script.ts` (1,043 lines; `buildCanonicalScript(seed)` emits the whole objective→plan→build→failure→repair→validation→approval→transfer→completion→upgrade sequence as literal events); `apps/agent-city/src/lib/mock-runtime/__fixtures__/v1-canonical-run.json`. `apps/api/src/` contains an HTTP server and three one-off scripts — no scheduler, planner, or stage driver of any kind.
- **Current behavior:** Opening the app plays a deterministic recording. No backend participates; nothing is decided at runtime.
- **Claimed behavior:** `docs/01-mission/active-mission.md` § "Mission statement" — "one human operator can supervise one AI-assisted software-build workflow."
- **Risk:** This is compliant with ADR-001 and principle 3a and was the correct V1 design. But it means the demonstrated workflow is a *recording of* a workflow, and no code path exists that would produce the same sequence from real work. Any reading of V1 as "the workflow runs" is wrong.
- **Disposition:** Retain the mock runtime permanently as a deterministic mode (it is the regression baseline). Build the real path beside it, not in place of it.
- **Class:** New scope.

### PV1-012 — The persistent command bar silently does nothing in backend mode — **MAJOR / defect**

- **Evidence:** `apps/agent-city/src/components/controls/CommandBar.tsx:25–27` sends `demo.start` / `demo.pause` / `demo.resume` / `demo.set_speed` / `demo.reset` / `demo.replay`; `packages/contracts/src/commands.ts` `COMMAND_TYPES` contains no `demo.*` entry; `apps/api/src/app.ts:168–175` returns `400 {error, message, issues}` for a body failing `CommandRequestSchema`; `apps/agent-city/src/lib/backend/BackendRuntimeProvider.tsx:76–79` sets a rejection only when `outcome?.accepted === false` — a key the 400 body does not contain, so the rejection is cleared to `null`.
- **Current behavior:** In backend mode every command-bar button posts an unknown command type, receives a 400, and produces **no user-visible feedback whatsoever**.
- **Claimed behavior:** `docs/02-specification/interface-model.md` § "Persistent command input" lists these six as the V1 command set; `v1-acceptance.md` F-07 requires "rejected commands visible."
- **Risk:** A control that fails silently is the exact failure mode `operatorCredential.ts` explicitly argues against for approvals ("An operator whose approval button quietly does nothing has no way to tell 'not authorized' from 'backend down'"). The same reasoning was not applied here. F-07's "rejected commands visible" holds in mock mode only.
- **Disposition:** Two independent fixes — (a) make the backend-mode rejection handler surface any non-2xx response, not only a shaped `accepted:false`; (b) decide whether demo control is a backend concept at all, and if not, disable those controls in backend mode with a stated reason.
- **Class:** Defect.

### PV1-013 — `building.selected` is emitted only by the mock runtime — **MINOR / defect**

- **Evidence:** `apps/agent-city/src/lib/backend/BackendRuntimeProvider.tsx:132–133` (`selectBuilding` and `clearSelection` are empty callbacks); `apps/agent-city/src/lib/mock-runtime/runtime.ts:222–241` emits `building.selected` with a re-selection dedup guard.
- **Current behavior:** Selection *visuals* work in both modes (`AppShell` holds selection in local React state, correctly — selection carries no operational authority per `world-model.md`). But in backend mode the declared `building.selected` event never reaches the timeline.
- **Claimed behavior:** `event-model.md` declares `building.selected` with "Backend effect: None on operational truth."
- **Risk:** Low. A declared event has no producer in the mode that will become primary; the timeline is less complete in backend mode than in mock mode.
- **Disposition:** Either emit it backend-side or record that it is a mock-only UI event.
- **Class:** Defect.

### PV1-014 — The Warehouse upgrade is auto-approved in the default demo — **MAJOR**

- **Evidence:** `apps/agent-city/src/lib/mock-runtime/script.ts:752–812` emits `upgrade.eligible` → `upgrade.requested` → `upgrade.approved` → `upgrade.started` → `upgrade.completed` as scripted events with no operator input; `apps/agent-city/README.md:45` states the upgrade "is auto-approved by the mock operator authority."
- **Current behavior:** The operator watches the upgrade approve itself.
- **Claimed behavior:** `docs/01-mission/v1-scope.md` § "Required workflow" step 18 — "Operator approves upgrade." `v1-acceptance.md` journey step 14 — "operator approves."
- **Risk:** A required *governance act* is demonstrated as an automated event. The `upgrade.approved` guard exists backend-side and `FBL-031`'s operator observation exercised it through the seeded path — so the capability is real — but the default operating mode does not require the human. Principle 14 ("Humans govern") is satisfied by the backend, not by the demo.
- **Disposition:** In V1.1, the upgrade approval must be an operator gate on the real path. Leave the mock script unchanged (it is the frozen regression baseline).
- **Class:** New scope (the V1 behavior is as-scripted; making the human act is the change).

### PV1-015 — Batch intake at Warehouse Level 2 is mock-only by specification — **INFO**

- **Evidence:** `docs/02-specification/v1-acceptance.md` F-11 — "capacity 25→100; **batch intake in mock**."
- **Current behavior/claimed behavior:** Agree. The capability change is real backend state; the batch-intake *behavior* is only ever exercised in the mock.
- **Risk:** None to V1. Recorded so V1.1 does not mistake the capacity number for exercised throughput.
- **Disposition:** No action.
- **Class:** New scope.

---

## 4. Backend-authoritative capabilities

### PV1-016 — Backend authority is real, complete, and unreachable in normal operation — **MAJOR**

- **Evidence:** `packages/persistence/src/commandHandler.ts`, `transitionGraphs.ts`, `worldStateProjection.ts`; `apps/api/src/app.ts`; 135 + 44 passing tests. Against this: `apps/agent-city/src/app/page.tsx:9` — the backend is used only when `NEXT_PUBLIC_FOUNDRY_API_URL` is set, and it is set nowhere in the repository except in the FBL-035 verification command line.
- **Current behavior:** The default application run (`pnpm --filter @foundry/agent-city dev`, or the production build the operator approved at `localhost:4500`) uses the mock runtime. The authoritative backend is off unless deliberately configured, built for, and started.
- **Claimed behavior:** Principle 1 and ADR-002 — "Backend state owns operational truth." Principle 3a permits the mock stand-in "until a persisted backend exists." A persisted backend now exists.
- **Risk:** The condition principle 3a was written for has lapsed, but the default configuration still uses the stand-in. This is not a violation — 3a does not mandate cutover — but the plain reading of ADR-002 is not what the running application does.
- **Disposition:** V1.1 makes backend mode the default for real operation and keeps the mock as an explicitly-selected deterministic mode.
- **Class:** New scope.

### PV1-017 — No automated test exercises the frontend against a live `apps/api` — **MAJOR**

- **Evidence:** `apps/agent-city/playwright.config.ts` starts only the Next.js server; `apps/agent-city/e2e/shell-realtime-connection.spec.ts:81` skips unless `NEXT_PUBLIC_FOUNDRY_API_URL` is set; `docs/evidence/fbl-035/v1-acceptance-report.md:138–144` records that those three tests were skipped on every run since FBL-026 and were finally executed against `http://backend.test` — a hostname that never resolves.
- **Current behavior:** F-10's browser proof exercises the **disconnected** path against an unreachable host. No test ever connects the frontend to the real backend, reconciles a snapshot, replays via `Last-Event-ID`, or round-trips a command.
- **Claimed behavior:** `v1-acceptance.md` F-10 — "Disconnect disables mutations and shows disconnected/stale; **restore reconciles**." The restore half is proved only by `packages/persistence` and `apps/api` unit tests, never across the wire.
- **Risk:** The integration seam between the two deliverables has zero automated coverage. PV1-012 is exactly the kind of defect this gap conceals — and it was found by reading, not by a test.
- **Disposition:** V1.1 must add a real two-process integration suite. This is the single highest-value test-coverage gap in the repository.
- **Class:** Hardening.

---

## 5. Test / fixture / seed-only capabilities

### PV1-018 — Operator demonstrations of backend capability depend on seed scripts shipped in the product — **MAJOR**

- **Evidence:** `apps/api/package.json` scripts `fbl-029:seed` and `fbl-031:seed`; `apps/api/src/fbl029/seedStage.ts` (forces a QA stage to `validating` by appending five literal events); `apps/api/src/fbl031/seedUpgradeReady.ts` (appends `build.started` + `build.completed` to reach the tenth successful package).
- **Current behavior:** The only way to reach Inspector validation or upgrade eligibility against the real backend is to run a rung-named script that writes fabricated history. Both scripts are honest about this and go through `appendEvent` without weakening any guard — that is to their credit — but they fabricate the *precondition*, not the decision.
- **Claimed behavior:** `docs/03-architecture/foundry-build-ladder.md` FBL-029 field 10 and FBL-031 field 10 present these as operator observations of the capability.
- **Risk:** Rung-scoped scaffolding is permanently installed in a shipped service's script surface. A reader cannot distinguish "the system reached this state" from "a script asserted this state."
- **Disposition:** V1.1 replaces both with a real orchestrated build reaching those states on its own, then retires the scripts.
- **Class:** Hardening.

### PV1-019 — The real Claude Code capability targets one hardcoded fixture — **MAJOR**

- **Evidence:** `packages/runtime-adapters/src/controlledStage/fixture.ts` — `SPEC` is a literal task-store specification and `TESTS` a literal pre-written test file, created in a fresh `mkdtemp` directory each run; `ALLOWED_WRITE_PATHS = ["src/taskStore.js"]`.
- **Current behavior:** The one real Claude Code stage can only ever implement `src/taskStore.js` against a spec compiled into the package. No operator objective reaches it.
- **Claimed behavior:** `v1-scope.md` § "V1 Build Stages" stage 4 — `backend_implementation` runs "via **`claude_code`** runtime … Implements persistence/API and tests for the demo application."
- **Risk:** The fixture design is genuinely excellent — the runtime has no shell, cannot run the tests, and cannot modify them, so self-certification is structurally impossible. That property must be preserved. But the *content* is a fixed exercise, not the demonstration objective, and the mock script's `backend_implementation` stage is a simulation of a stage that in reality ran somewhere else entirely.
- **Disposition:** V1.1 keeps the "runtime cannot validate its own work" property and makes the workspace and specification operator-supplied within a bounded envelope.
- **Class:** New scope.

### PV1-020 — Playwright screenshot baselines are platform-pinned generated artifacts — **MINOR**

- **Evidence:** six tracked PNGs under `apps/agent-city/e2e/shell-realtime-connection.spec.ts-snapshots/`, all suffixed `-darwin`.
- **Current behavior:** The F-10 browser assertions compare against macOS-rendered baselines committed during FBL-035.
- **Claimed behavior:** None false. `v1-acceptance.md` § "Test environment" names macOS as primary.
- **Risk:** The suite cannot pass on any non-darwin machine; there is no fallback or documented regeneration procedure.
- **Disposition:** Document the platform pin, or scope the comparison to DOM state.
- **Class:** Hardening.

### PV1-021 — The recorded canonical run is the only cross-run regression baseline — **INFO**

- **Evidence:** `apps/agent-city/src/lib/mock-runtime/__fixtures__/v1-canonical-run.json`, diffed by `recordedRun.test.ts`.
- **Risk:** None currently. It is a mock-vs-mock baseline; `apps/agent-city/README.md` proposes it as the comparison target for a real backend run, which has never been done.
- **Disposition:** V1.1 should state whether a real run is expected to match it (it will not, and should not be forced to).
- **Class:** New scope.

---

## 6. Real Claude Code capabilities

### PV1-022 — The real Claude Code path is out-of-band, one-shot, and disconnected from the world — **MAJOR**

- **Evidence:** `apps/api/src/fbl028/runControlledStage.ts` is a standalone `main()` invoked by `pnpm --filter @foundry/api fbl-028`; it opens its own SQLite file, submits `AgentRun.Start`/`Complete` directly to a `CommandHandler` it constructs, and exits. Nothing in `apps/api/src/app.ts` or the frontend can trigger it. Its `AgentRun` is never linked to a `BuildStage`, and the world never renders it.
- **Current behavior:** A real, containment-checked, independently-validated Claude Code run exists — executed twice (FBL-028 and the FBL-035 re-verification) — as a command-line action with no relationship to the running application.
- **Claimed behavior:** `v1-acceptance.md` F-12 — "One controlled Claude Code stage via adapter with logs/exit/outputs/evidence." Satisfied literally. `v1-scope.md` stage 4 places it inside the build sequence. Not satisfied.
- **Risk:** V1's headline "real AI-assisted build" reduces to one out-of-band CLI invocation against a fixture. The operator watching the app never sees it, and the stage the app *shows* for `backend_implementation` is a scripted simulation.
- **Disposition:** V1.1's central objective — bring this path inside an orchestrated build, triggered by an authorized operator decision, rendered in the world.
- **Class:** New scope.

### PV1-023 — Re-running the FBL-028 script overwrites approved evidence in place — **MAJOR / defect**

- **Evidence:** `apps/api/src/fbl028/runControlledStage.ts:34–36` — `EVIDENCE_DIR` defaults to `<cwd>/docs/evidence/fbl-028` and `DB_PATH` to `<EVIDENCE_DIR>/agentrun.sqlite`; lines 180–196 unconditionally `writeFileSync` `evidence.json`, `diff.patch`, `stdout.txt`, `stderr.txt`, `tests.txt`.
- **Current behavior:** `pnpm --filter @foundry/api fbl-028` from the repository root writes directly into the approved evidence directory. The duplicate guard prevents a *second execution* while the same SQLite file is present — but if that DB is absent (it is git-ignored, so it is absent in any fresh clone), the guard passes and the approved evidence files are overwritten.
- **Claimed behavior:** `docs/evidence/fbl-035/operator-final-approval.md` cites `evidence.json` md5 `11635c1b0bd1c3703da7047a21ae351c` and `agentrun.sqlite` md5 `6beec0833d05b49322777b9f919a3a55` as fixed evidence of a one-time authorized run.
- **Risk:** Approved, cited, immutable-by-intent evidence sits at the default write target of a runnable script. Combined with PV1-024 this makes the FBL-028 evidence chain fragile.
- **Disposition:** Default the evidence directory outside `docs/`; require an explicit `FOUNDRY_EVIDENCE_DIR`; refuse to overwrite an existing evidence file.
- **Class:** Defect.

### PV1-024 — Cited evidence artifacts are not in the repository — **MAJOR**

- **Evidence:** `git log -- docs/evidence/fbl-028/agentrun.sqlite` returns nothing; `git status --ignored` lists both `docs/evidence/fbl-028/agentrun.sqlite` and `docs/evidence/fbl-035/f12-verification/agentrun.sqlite` as ignored by the `*.sqlite` rule in `.gitignore:56`.
- **Current behavior:** Both SQLite databases exist only on this machine. A fresh clone has the JSON, diff, and logs but not the databases whose checksums the approval record cites.
- **Claimed behavior:** `docs/evidence/fbl-035/operator-final-approval.md` presents both md5s as verifiable evidence.
- **Risk:** Two of the cited artifacts are unverifiable by anyone but the operator on this machine, and are one `rm` away from being unverifiable at all. The `.gitignore` rule that excludes them is correct in general (runtime state) and wrong for this specific directory.
- **Disposition:** Decide explicitly — either add a `!docs/evidence/**/*.sqlite` exception and commit them, or amend the approval record to cite only artifacts that are actually retained. **This is an operator decision** (see §16).
- **Class:** Documentation correction *or* hardening, depending on the operator's choice.

---

## 7. Missing orchestration for a complete real build

### PV1-025 — There is no orchestrator — **BLOCKER for V1.1, not a V1 defect**

`apps/api` is an HTTP command/query surface over an event log. Nothing decides what happens next. Every state transition in a real run would have to be POSTed by hand.

| Required to drive a real build | Exists? | Where it would live |
| --- | --- | --- |
| Objective → Project/Build creation from an operator act | Command exists (`Project.Create` → `operator.objective_submitted`, `Build.Create`), no caller | Backend + UI |
| Objective → planned `BuildStage`s + `Requirement`s (Architect) | ✗ | Backend orchestrator + runtime adapter |
| Stage scheduling: start, assign agent, advance, block on failure | ✗ | Backend orchestrator |
| Requirement execution and pass/fail determination | ✗ | Backend orchestrator |
| Dispatch of a stage to a runtime adapter as an `AgentRun` | ✗ (only the standalone FBL-028 script) | Backend orchestrator |
| Retry/repair after the failure path | ✗ | Backend orchestrator |
| Transfer leg creation and advancement (3 legs) | Commands exist, no driver | Backend orchestrator |
| `approval.requested` emitted from real stage completion | Command exists, no caller | Backend orchestrator |
| Upgrade eligibility evaluation from real metrics | Command exists, no caller (`fbl-031:seed` substitutes) | Backend orchestrator |
| Agent location/travel derivation | ✗ | Backend orchestrator |

- **Risk:** Every backend guard is written and tested, and nothing in the product can reach most of them without hand-crafted commands or a seed script. The enforcement layer is complete; the layer that would exercise it does not exist.
- **Disposition:** The orchestrator is the substance of V1.1. It must be introduced as a backend component that only ever submits declared commands through the existing `CommandHandler` — never a second write path.
- **Class:** New scope.

### PV1-026 — No operator surface for submitting an objective — **BLOCKER**

- **Evidence:** `apps/agent-city/src/components/controls/CommandBar.tsx` contains six demo buttons and no text input. No component anywhere submits `Project.Create` or `Build.Create`. `packages/contracts/src/commands.ts` validates only the *envelope* — "domain-model.md names each command but does not specify per-command parameter fields" — so there is no schema for an objective's parameters.
- **Current behavior:** An operator cannot submit an objective. `operator.objective_submitted` is produced by the mock script on `demo.start` and by the two seed scripts as a literal.
- **Claimed behavior:** `v1-scope.md` § "Required workflow" step 1 — "Operator submits objective." `v1-acceptance.md` journey step 4 — "Operator submits objective; build created."
- **Risk:** The first step of the required workflow and of the acceptance journey has no implementation. It passed acceptance because the deterministic script emits the event, which is a legitimate reading of a mock-runtime demonstration — but no human act is involved anywhere in the product.
- **Disposition:** V1.1's first vertical slice. Requires a specification change (per-command parameter schemas) — see §17.
- **Class:** New scope.

---

## 8. Startup, configuration, packaging, and deployment gaps

### PV1-027 — No single documented command starts Foundry — **BLOCKER for the V1.1 objective**

- **Evidence:** root `package.json` scripts are `lint`, `lint:fix`, `format`, `format:write`, `typecheck`, `test`, `build` — no `dev`, no `start`. Startup instructions are split across `apps/api/README.md` § "Run locally" and `apps/agent-city/README.md` § "Run locally", which describe the two processes independently and never together.
- **Current behavior:** Running the real system requires: install; build the API; start the API on :4000; read the credential table from its stdout; start the frontend with `NEXT_PUBLIC_FOUNDRY_API_URL` set; open the browser; paste the operator credential. Seven manual steps across two terminals, documented in two files, with an undocumented ordering dependency.
- **Claimed behavior:** No document claims a single command exists. This is a gap, not a falsehood.
- **Risk:** Directly blocks the V1.1 mission outcome ("launches Foundry through a documented single command").
- **Disposition:** One root orchestration script plus one operator quickstart document.
- **Class:** Hardening.

### PV1-028 — Runtime mode is fixed at build time and cannot be changed in a production artifact — **MAJOR**

- **Evidence:** `apps/agent-city/src/app/page.tsx:9` reads `process.env.NEXT_PUBLIC_FOUNDRY_API_URL` at module scope. Next.js inlines `NEXT_PUBLIC_*` at build time.
- **Current behavior:** A `next build` artifact is permanently mock-mode or permanently backend-mode. Switching requires a rebuild. The operator's approved V1 artifact at `localhost:4500` is a mock-mode build.
- **Claimed behavior:** `apps/agent-city/README.md:17` — "The runtime is selectable. … Set `NEXT_PUBLIC_FOUNDRY_API_URL` to point the app at a real `apps/api` instance instead", illustrated with `pnpm dev`. True in development; false for a built artifact, and the README does not distinguish.
- **Risk:** A packaged Foundry cannot be pointed at a backend without a rebuild. Materially affects any "single command" design.
- **Disposition:** Move runtime-mode selection to request time (server-side config read, or a `/config` endpoint the client fetches).
- **Class:** Defect (documentation is materially incomplete) + hardening.

### PV1-029 — No environment template, and `.gitignore` whitelists one that does not exist — **MINOR**

- **Evidence:** `.gitignore:19–20` (`!.env.example`, `!.env.*.example`); no `.env.example` anywhere. Configuration variables `FOUNDRY_DB_PATH`, `PORT`, `FOUNDRY_OPERATOR_ID`, `NEXT_PUBLIC_FOUNDRY_API_URL`, `FOUNDRY_CLAUDE_PATH`, `FOUNDRY_GIT_PATH`, `FOUNDRY_AGENT_RUN_ID`, `FOUNDRY_EVIDENCE_DIR`, `FOUNDRY_KEEP_FIXTURE`, `FOUNDRY_STAGE_ID`, `NEXT_PUBLIC_E2E` are documented only in scattered source comments.
- **Risk:** No single place enumerates configuration.
- **Disposition:** Add `.env.example` with every variable, its default, and its effect.
- **Class:** Hardening.

### PV1-030 — No CI, and `scripts/` is empty despite being a closed rung's deliverable — **MAJOR**

- **Evidence:** no `.github/`; `scripts/` contains only `.gitkeep`. `docs/03-architecture/foundry-build-ladder.md` FBL-003 field 8 lists "`scripts/` entries for typecheck/lint/test" as an expected deliverable of a rung marked ✅ Complete.
- **Current behavior:** Gates run only when a human types them. A closed rung has an undelivered listed deliverable (the *acceptance criteria* for FBL-003 were about the root scripts passing, which they do — so the rung's gate was met, but its deliverables list was not fully honored).
- **Risk:** All 813 tests, the browser suites, and the performance budgets can silently rot. Nothing prevents a regression from landing.
- **Disposition:** Add CI running typecheck, lint, build, and the unit suite. Note the FBL-003 deliverable discrepancy as a historical record only — **the rung is not reopened**.
- **Class:** Hardening.

### PV1-031 — Reserved directories remain empty placeholders — **MINOR**

- **Evidence:** `assets/.gitkeep`, `config/.gitkeep`, `scripts/.gitkeep`, `tools/.gitkeep`, `tests/.gitkeep`, all listed in `README.md:87` as "Reserved placeholders."
- **Risk:** Minimal; `assets/` being empty is the substrate of the visual debt in §11.
- **Disposition:** Populate `assets/` and `scripts/` in V1.1; leave the rest or remove them.
- **Class:** Hardening.

### PV1-032 — No packaging or deployment story, by design — **INFO**

- **Evidence:** no Dockerfile, compose file, service definition, or deployment document. `apps/api` is bundled by `build.mjs` (esbuild) into `dist/main.js`; `apps/agent-city` is a standard Next.js build.
- **Claimed behavior:** `apps/api/README.md:9` — "intended for local/trusted-network operation only." Consistent.
- **Risk:** None for V1. Production cloud deployment is explicitly excluded from V1.1 as well.
- **Disposition:** No action beyond stating the boundary.
- **Class:** New scope.

---

## 9. Security and containment limitations

### PV1-033 — Write confinement of a real Claude Code run is post-hoc detection, not prevention — **MAJOR**

- **Evidence:** `packages/runtime-adapters/src/adapters/claudeCodeAdapter.ts` layer table — "The last row is detection, not prevention"; `packages/runtime-adapters/README.md` records the same, and `docs/evidence/fbl-028/operator-approval.md` approved it narrowly and explicitly not as an OS-level sandbox.
- **Current behavior:** Invocation is fully controlled (fixed argv, no `PATH`, environment allowlist of `HOME`+`USER`, timeout, output caps). Once running, nothing in Foundry constrains the process's file descriptors; a `git diff` afterwards *detects* out-of-scope writes and fails the run.
- **Claimed behavior:** Accurately documented in source and evidence. `docs/00-foundry/principles.md` 19 permits R0–R2 "inside a controlled repository."
- **Risk:** Accepted and correctly disclosed for a disposable temp fixture. It does **not** generalize to an operator-supplied workspace, which V1.1 introduces — a real project directory raises the stakes of a detection-only control.
- **Disposition:** V1.1 must either add OS-level confinement or restrict the real build to a disposable workspace Foundry creates. **Operator decision** — see §16.
- **Class:** Hardening.

### PV1-034 — The controlled run reaches the OS credential store and the network — **MAJOR**

- **Evidence:** `claudeCodeAdapter.ts` security note — `allowNetwork: true`; "The environment allowlist does not keep the process away from the operating system's credential store. Claude Code authenticates from the macOS Keychain, which it reaches through the user session, not through any environment variable."
- **Current behavior:** As documented. Irreducible for a real run without an API-key-only mode.
- **Risk:** Correctly disclosed, genuinely unavoidable at this design point, and the honesty is exemplary. It remains the widest surface in the containment story.
- **Disposition:** Re-evaluate under V1.1's broader workspace scope; consider `ANTHROPIC_API_KEY` + `--bare` to close it.
- **Class:** Hardening.

### PV1-035 — The API is unauthenticated for reads and permissive for origins — **MAJOR**

- **Evidence:** `apps/api/src/app.ts:61–70` sets `Access-Control-Allow-Origin: *` with an inline justification; `GET /health`, `/world-state`, `/entities/*`, `/events`, `/events/stream` require no credential.
- **Current behavior:** Anyone who can reach the port reads the entire operational history and live event stream. The justification given ("agent credentials are bearer tokens the browser never holds") addresses *write* replay and is sound for that; it does not address reads.
- **Claimed behavior:** `apps/api/README.md:9` says local/trusted-network only — correct but understated; the source comment says the origin policy "must be revisited before any networked deployment."
- **Risk:** Confined to a single-operator local host. On any shared or networked host it is a full disclosure of operational state.
- **Disposition:** Bind to loopback by default; make any other bind an explicit, warned choice.
- **Class:** Hardening.

### PV1-036 — Credentials are per-boot, printed to stdout, non-expiring, and stored in `localStorage` — **MAJOR**

- **Evidence:** `apps/api/src/main.ts:51–56` prints every agent token and the operator token to the console at startup; `apps/agent-city/src/lib/backend/operatorCredential.ts` stores the operator token in `localStorage` and states plainly "there is no expiry, refresh, or logout."
- **Current behavior:** Tokens land in terminal scrollback and shell logs; the browser copy is readable by any script running on the origin; every restart invalidates the pasted token with no in-app signal beyond a failed command.
- **Claimed behavior:** Accurately documented as a deliberate minimum; `v1-scope.md` excludes authentication as a feature.
- **Risk:** Acceptable for V1's threat model. It is also the mechanism that makes the "documented single command" objective awkward — the operator must read a token out of a log.
- **Disposition:** V1.1 needs a credential handoff that does not require copy-paste from stdout, without building a session system.
- **Class:** Hardening.

### PV1-037 — No transport security, rate limiting, or audit of read access — **MINOR**

- **Evidence:** `createServer` (plain HTTP) in `apps/api/src/app.ts:38`; `MAX_BODY_BYTES = 1_000_000` is the only request-side limit.
- **Risk:** Low on loopback; unacceptable anywhere else.
- **Disposition:** State the boundary; enforce loopback binding (PV1-035).
- **Class:** Hardening.

---

## 10. Accessibility, browser, and performance debt

### PV1-038 — No automated accessibility scanner and no screen-reader verification — **MAJOR**

- **Evidence:** `docs/evidence/fbl-033/operator-observation.md` § "What this rung did not establish" — no axe or equivalent was run; no screen reader was tested; no WebGL-unavailable fallback test exists.
- **Current behavior:** 20 structural colour-independence tests and 7 keyboard e2e tests × 3 viewports, all hand-written against the named acceptance criteria.
- **Claimed behavior:** `v1-acceptance.md` § "Accessibility" requires keyboard path, visible focus, colour-not-sole-signal, reduced motion, semantic structure, canvas navigator equivalents — all covered. It does not require a WCAG audit.
- **Risk:** No falsehood; the gaps were disclosed at the time. Real accessibility beyond the enumerated criteria is unknown, and the 2D interface's role as an authoritative control surface when WebGL is unavailable is asserted by construction and never tested.
- **Disposition:** Add axe, a screen-reader smoke pass, and a WebGL-unavailable path test in V1.1.
- **Class:** Hardening.

### PV1-039 — Safari support rests on one unwitnessed operator observation — **MAJOR**

- **Evidence:** `docs/evidence/fbl-035/real-safari-observation.md` — a single session on one machine, reported by the operator, not witnessed by the assistant; classifications 3a/3b/3c derived from it. `v1-acceptance.md` § "Test environment" requires "current Chrome and Safari."
- **Current behavior:** Chromium has 378 automated assertions across three viewports. Safari has one human session.
- **Risk:** A required browser has no reproducible coverage. Any Safari regression is invisible until an operator happens to look.
- **Disposition:** Tie to PV1-043 (Finding 6). Either get WebKit automation green or record a standing, dated manual Safari check.
- **Class:** Hardening.

### PV1-040 — Frame-time tail sits near the target, on one machine only — **MINOR**

- **Evidence:** `docs/evidence/fbl-034/performance-measurements.md` § 3 — 95th-percentile frame implies ~36.9 FPS at 5120×1440, 2560×1440, and 5120×1440@2×, against a 45 FPS *target* and a 30 FPS floor. Measured on one Apple M4 Pro with one display, serial, GPU-backed, production build.
- **Current behavior:** All budgets met as written; the report itself flags the tail as the number that matters.
- **Claimed behavior:** `v1-acceptance.md` § "Performance" — "45+ FPS target in world mode; 30 FPS minimum under full panels." The floor is met; the target is not met at the tail.
- **Risk:** Headroom for V1.1's cohesive visual pass (§11) is thin and unquantified. Adding geometry could cross the floor.
- **Disposition:** Re-measure before and after any visual work; treat the 95th-percentile figure as the gating number.
- **Class:** Hardening.

### PV1-041 — The browser suite requires a documented worker cap to be reliable — **MINOR**

- **Evidence:** `apps/agent-city/README.md` § "Testing" — "**Run the browser suite at `--workers=3`**"; `apps/agent-city/playwright.config.ts` documents the SwiftShader/contention analysis at length but does not itself pin `workers`.
- **Risk:** A default `playwright test` on a large machine produces contention failures that read as regressions. The knowledge lives in prose, not in configuration.
- **Disposition:** Pin `workers` in the config, or make the README instruction the only invocation path.
- **Class:** Hardening.

---

## 11. Visual placeholder debt

### PV1-042 — The entire neighborhood is untextured primitive geometry — **MAJOR**

- **Evidence:** `apps/agent-city/src/components/world/OperationalBuilding.tsx:13–27` — five buildings are boxes differing only in dimensions and a flat hex colour; `apps/agent-city/src/components/world/ShapeGeometry.tsx` — all state indicators are eight untextured primitives (icosahedron, torus, cone, box, octahedron, tetrahedron, sphere, cylinder); `assets/` contains only `.gitkeep` — no model, texture, or material file exists in the repository.
- **Current behavior:** Buildings are distinguished by size and colour; state is carried by an indicator primitive plus a required text label. There is no shared art direction, material system, or asset pipeline.
- **Claimed behavior:** Fully compliant. `docs/02-specification/world-model.md:66` permits "simple low-poly/icon representation"; `exclusions.md` excludes photorealistic custom assets; the Build Ladder's FBL-016–FBL-020 are explicitly "placeholder geometry."
- **Risk:** No defect — this is debt against Foundry's premise that "meaningful visual elements correspond to actual operational entities" (`README.md`). Primitives correspond correctly but communicate weakly, and there is no groundwork for anything better.
- **Disposition:** One cohesive low-poly pass in V1.1, **after** the real workflow succeeds, bounded to a single neighborhood and gated on PV1-040's frame-time tail.
- **Class:** New scope.

---

## 12. Finding 6 — open

### PV1-043 — Three unclassified Playwright-WebKit failures, accepted rather than resolved — **BLOCKER for V1.1 entry**

- **Evidence:** `FOUNDATION_VERSION.md` § "Mission completion status"; `docs/evidence/fbl-035/operator-final-approval.md` § "Open at the time of approval"; `docs/03-architecture/foundry-build-ladder.md` FBL-035 verification record. Failing tests: `apps/agent-city/e2e/shell-selection.spec.ts:150` ("selecting the Lighthouse moves the FBL-012 camera to focus on it") at 5120×1440 and 3840×1080, and `apps/agent-city/e2e/shell-event-to-world-mapping.spec.ts:119` ("every meaningful visual transition has a readable timeline equivalent") at 5120×1440. WebKit stood at 372 passed / 6 failed at approval.
- **Current behavior:** Open, undiagnosed, unclassified. The operator was told they were undiagnosed, was offered investigation, and approved with them open. The approval record is explicit: "Anyone reading this later should treat those three failures as **open and uninvestigated**, not as accepted non-defects."
- **Claimed behavior:** `v1-acceptance.md` requires Safari to work, not Playwright's WebKit build to be green — which is why approval was defensible. But no document claims these are non-defects.
- **Risk:** Two of the three sit adjacent to the camera-settling race that FBL-034/FBL-021A repaired, so a fourth instance of the same class is plausible — and equally plausible is a real WebKit product defect in camera focus and in timeline/world correspondence. No failure artifact is retained in the repository (`test-results/` is git-ignored), so there is currently **no reproduction record at all**.
- **Disposition:** Resolve early in V1.1 — before feature work — by diagnosis, not by reclassification. Capture artifacts this time.
- **Class:** Defect.

---

## 13. Committed generated artifacts and repository hygiene

### PV1-044 — Cited evidence databases are untracked — **MAJOR**

See **PV1-024**. Repeated here because it is simultaneously an evidence-integrity problem and a hygiene problem.

### PV1-045 — Evidence directory is a live write target — **MAJOR**

See **PV1-023**.

### PV1-046 — `CHANGELOG.md` is a single 143 KB file — **MINOR**

- **Evidence:** `CHANGELOG.md`, 143,370 bytes, covering every rung.
- **Risk:** Editing it is increasingly error-prone, and it is the required companion to every documentation change under the change-control rule.
- **Disposition:** Consider per-mission changelog files with an index. Do not rewrite history.
- **Class:** Hardening.

### PV1-047 — Minor tree noise — **MINOR**

- **Evidence:** `docs/audits/.gitkeep` persists beside three real audits; `.DS_Store` and `docs/.DS_Store` exist locally (correctly ignored); local build outputs (`apps/agent-city/.next/`, `apps/agent-city/test-results/`, `apps/agent-city/tsconfig.tsbuildinfo`, `apps/api/dist/`) are present and correctly ignored. `prompts/build-ladder.md` is the prompt that generated the Build Ladder and carries no status marker.
- **Current behavior:** Nothing improperly tracked. `git ls-files -i -c --exclude-standard` returns empty — **no ignored file is tracked**, and the only tracked generated artifacts are the six intentional Playwright baselines (PV1-020) and two evidence `diff.patch` files (intentional).
- **Risk:** Negligible.
- **Disposition:** Remove `docs/audits/.gitkeep`; add a provenance note to `prompts/build-ladder.md`.
- **Class:** Documentation correction.

---

## 14. Materially false README and package documentation — consolidated

Every entry below is a document that a reader would act on and that is false as written at `3cdd539`.

| Document | False claim | Truth | Finding |
| --- | --- | --- | --- |
| `README.md` | Foundation 1.0-rc1; no application code; implementation blocked; `apps/agent-city` not implemented | Foundation 1.0; V1 complete; 8 projects, 813 tests | PV1-001 |
| `docs/01-mission/active-mission.md` | Mission is documentation-only; application code not started | Mission complete and operator-approved | PV1-002 |
| `CONTRIBUTING.md` | Do not install dependencies or write application code | Both done, under authorization | PV1-003 |
| 14 spec/mission docs | `Foundation: 1.0-rc1` | Foundation 1.0 | PV1-004 |
| `docs/03-architecture/implementation-plan.md` | Planning only; implementation blocked | All 18 stages executed | PV1-005 |
| `packages/contracts/README.md` | Reserved placeholder, no implementation | 15 entities, 84 commands, 56 tests | PV1-006 |
| `packages/event-types/README.md` | Reserved placeholder, no implementation | Full event vocabulary, 14 tests | PV1-006 |
| `packages/ui/README.md` | Reserved placeholder, no implementation | Panel primitives, 18 tests | PV1-006 |
| `packages/world-model/README.md` | Reserved placeholder, no implementation | World objects + visual states, 7 tests | PV1-006 |
| `apps/agent-city/README.md` | Frontier is FBL-026; nine rungs unauthorized | V1 complete through FBL-035 | PV1-007 |
| `apps/agent-city/README.md` | "The runtime is selectable" (unqualified) | Selectable at build time only | PV1-028 |
| `apps/api/README.md` | No authentication; `actor` is caller-asserted | Credentialed principals since FBL-029 | PV1-008 |

### PV1-048 — The falsehoods are concentrated in entry points — **BLOCKER**

- **Current behavior:** The three documents a newcomer reads first (`README.md`, `CONTRIBUTING.md`, `docs/01-mission/active-mission.md`) are the three most wrong.
- **Risk:** `v1-acceptance.md` § "Definition of done" requires "documentation matches implementation," and `docs/evidence/fbl-035/v1-acceptance-report.md` records that this was checked. That check evidently covered the specification-to-behavior relationship, not the status metadata in the entry-point documents. The definition-of-done clause is therefore **not fully satisfied at `3cdd539`** — narrowly, on status metadata, not on specification conformance.
- **Disposition:** This is a factual observation about the current tree, recorded for the operator. **It does not reopen FBL-035**, which is closed by operator approval; approval is the operator's to give and was given. Correct the documents in a V1.1 documentation rung.
- **Class:** Documentation correction.

---

## 15. What V1 appears to promise but cannot perform in normal operation

"Normal operation" = an operator starts the application as documented and uses it.

### PV1-049 — No real work occurs during normal operation — **BLOCKER**

- **Evidence:** PV1-011, PV1-016, PV1-022, PV1-025.
- **Claimed behavior:** `README.md` § "Core operational philosophy" — "The virtual world is never a simulation of work. It is a spatial representation of real work." `active-mission.md` — the operator "supervises one AI-assisted software-build workflow."
- **Current behavior:** By default the world is a faithful spatial representation of a deterministic recording. The one real AI-assisted execution that exists happened out-of-band, twice, against a fixture, via CLI.
- **Risk:** The gap between the platform's stated philosophy and what the running product does is the single most important fact in this audit. Every individual rung was honest about it; the aggregate reading is not obvious.
- **Disposition:** V1.1's entire reason to exist.
- **Class:** New scope.

### PV1-050 — "Operator submits objective" cannot be performed — **BLOCKER**

See **PV1-026**. Required workflow step 1 and acceptance journey step 4 have no operator-facing implementation in either runtime mode.

### PV1-051 — "Operator approves upgrade" is not performed in the default demo — **MAJOR**

See **PV1-014**. Required workflow step 18.

### PV1-052 — Backend mode presents an empty, inoperable world — **MAJOR**

- **Evidence:** With `NEXT_PUBLIC_FOUNDRY_API_URL` set against a fresh `apps/api`, `/world-state` returns the initial projection with no project, build, stages, agents in motion, or approvals; the command bar is a silent no-op (PV1-012); nothing can create work (PV1-026); the seed scripts are the only path to any non-empty state (PV1-018).
- **Claimed behavior:** `apps/agent-city/README.md:17` presents backend mode as an equal, selectable alternative — "This app can now run as a live projection of backend truth over SSE."
- **Risk:** True as far as it goes (the projection machinery genuinely works), but an operator following that instruction gets an empty world with non-functional controls and no documented next step.
- **Disposition:** V1.1 must make backend mode the operable mode.
- **Class:** Defect (documentation is materially incomplete) + new scope.

### PV1-053 — The controlled Claude Code authorization is spent — **INFO**

- **Evidence:** `docs/evidence/fbl-035/operator-final-approval.md` — "F-12 was re-executed live under a single, now-spent authorization"; Build Ladder header — the FBL-027–FBL-028 sequence is "exhausted."
- **Current behavior:** No standing authorization exists to invoke the real Claude Code path. Any V1.1 rung that runs it needs a fresh, explicit operator authorization.
- **Risk:** None; recorded so V1.1 planning does not assume standing authority.
- **Disposition:** Build the authorization gate into the V1.1 ladder explicitly.
- **Class:** New scope.

---

## 16. Decisions that require operator input

These cannot be resolved by analysis. Each changes what V1.1 would build.

1. **Evidence retention (PV1-024).** Commit the two `agentrun.sqlite` files via a `.gitignore` exception, or amend the approval record to cite only retained artifacts? Committing puts ~binary runtime state in `docs/`; amending edits an append-only approval record (permitted only as a new dated entry).
2. **Real-build workspace policy (PV1-033).** Should the V1.1 real build write into (a) a disposable workspace Foundry creates and destroys, (b) a designated scratch directory the operator nominates, or (c) a real project repository? Only (a) is defensible under detection-only write confinement. (c) should be out of scope.
3. **Amending Foundation 1.0 documents (PV1-002, PV1-004).** Correcting `active-mission.md` and the fourteen `1.0-rc1` headers touches frozen documents. The change-control rule says clarifications that do not change meaning may proceed with a CHANGELOG entry — does the operator accept these as clarifications, or require a formal amendment?
4. **Whether V1.1 is a new mission or an extension.** `FOUNDATION_VERSION.md` says further implementation "requires a new reviewed mission baseline (Future Registry promotion)." V1.1 as proposed promotes **nothing** from the Future Registry — it completes what V1 scoped. Is that a new mission baseline, or an amendment to the existing one?
5. **Finding 6 resolution standard (PV1-043).** Is "diagnosed and fixed" required, or is "diagnosed and formally classified with a reproduction artifact" sufficient to close it?
6. **Safari coverage standard (PV1-039).** Automated WebKit green, or a standing dated manual check?

---

## 17. Specification changes V1.1 would require

Recorded, not made. Each is a real change to a frozen document.

| Document | Required change | Driven by |
| --- | --- | --- |
| `docs/02-specification/domain-model.md` | `Build` § "V1 limits" reads "demo objective fixed." A real bounded objective requires this to change. | PV1-026 |
| `packages/contracts/src/commands.ts` + `domain-model.md` | Per-command parameter schemas. The envelope-only schema was correct because "domain-model.md names each command but does not specify per-command parameter fields" — an operator-submitted objective needs a typed payload. | PV1-026 |
| `docs/02-specification/event-model.md` | No event exists for plan review, execution authorization, or an operator's decision to proceed after seeing a plan. The V1.1 outcome requires at least one new operator event family. | Mission outcome |
| `docs/02-specification/v1-acceptance.md` | Superseded by a new `v1.1-acceptance.md`. V1's F-01–F-12 / V-01–V-08 remain the frozen V1 record. | Ladder terminal rung |
| `docs/01-mission/v1-scope.md` § "V1 Build Stages" | Seven fixed stage names with fixed locations and runtimes. A real objective may need a different stage count. **Recommendation: keep the seven fixed for V1.1** — a real build against a fixed stage shape is a smaller change than a real build with a dynamic plan. | PV1-025 |
| `docs/00-foundry/principles.md` 3a | Reads "until a persisted backend exists." A backend exists; principle 3a's condition has lapsed and its status should be stated. No meaning change is needed if the mock is retained as a selectable mode. | PV1-016 |
| `docs/01-mission/exclusions.md` | Unchanged. Every V1 exclusion remains excluded in V1.1, and the V1.1 proposal adds more. | — |

---

## 18. Contradictions recorded without resolution

Per instruction, these are reported, not silently reconciled.

1. **Two priority-1 documents disagree.** `FOUNDATION_VERSION.md` says complete; `docs/01-mission/active-mission.md` says implementation is blocked and has not begun. The authority order in `README.md` does not rank them against each other. Resolved in practice by the commit history and the evidence records — not by any rule in the documents.
2. **`v1-acceptance.md` "documentation matches implementation" vs. §14 of this audit.** The definition-of-done clause was recorded as satisfied at FBL-035 while twelve documents were materially false about status. Both statements are on the record; this audit does not overturn the approval.
3. **FBL-003 deliverables vs. tree.** `scripts/` entries were a listed deliverable of a closed rung and do not exist. The rung's *acceptance criteria* (root scripts pass on the tree) were met. Recorded, not reopened.
4. **`apps/agent-city/README.md` vs. `packages/contracts/src/commands.ts`.** The app README describes backend mode as fully operable; the contract package's own comments make clear the command vocabulary contains nothing the command bar sends.
5. **Principle 3a's condition vs. the default runtime.** The stated precondition for the mock stand-in ("until a persisted backend exists") no longer holds, and the default configuration was not revisited. Not a violation of the principle's text; a lapse of its premise.

---

## 19. Summary

Agent City V1 is a genuinely completed mission with an unusually honest evidence trail. Its enforcement layer, containment boundary, contract discipline, and test coverage are real and verified. Three things are true at the same time, and all three must be stated:

1. **Everything V1 claimed at the rung level was delivered**, with the single open item (Finding 6) explicitly carried rather than hidden.
2. **The entry-point documentation is materially false** about the project's status, in twelve places, including both priority-1 documents.
3. **No real work happens when the product runs.** The backend that owns truth is off by default; nothing drives a build; the one real AI execution is a CLI script against a fixture; and the operator cannot submit an objective at all.

The third point is not a failure of V1 — it is precisely the boundary V1 drew. It is the whole of what V1.1 must close.

---

**Proposals derived from this audit:**
`docs/proposals/agent-city-v1.1-mission-proposal.md` · `docs/proposals/agent-city-v1.1-build-ladder-proposal.md`
