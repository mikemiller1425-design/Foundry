# V1 Acceptance Report — Agent City

**Rung:** FBL-035 — Complete V1 acceptance verification (terminal rung)
**Date:** 2026-08-01
**Commit under test:** `1b1689a`
**Authority:** `docs/02-specification/v1-acceptance.md` (entire document); `docs/01-mission/active-mission.md` § "Completion gate"; `docs/01-mission/exclusions.md`
**Machine:** Apple M4 Pro (12 CPU / 16 GPU cores), 24 GB, macOS 25.5.0; primary display Samsung LS49C95xU (native 5120×1440)

**Status: Chromium automated verification COMPLETE and PASSING. Three issues OPEN against Safari/WebKit (§7, finding 3). Operator sign-off NOT performed (§9).**

**V1 is not declared complete by this report.** Two things stand in the way, and both need an operator decision rather than an assistant judgement: the Safari findings, and the personal end-to-end journey this rung requires.

This report covers what the assistant executed and verified. Field 10 of this rung requires the operator to perform the complete primary journey personally, end-to-end and unassisted. That has not happened and is not claimed anywhere in this document.

---

## 1. Unified suite result

Field 9 requires every automated test named across FBL-001–FBL-034 run **together as one suite**. All six gates were executed sequentially in a single run against `1b1689a`.

| Gate | Command | Result |
| --- | --- | --- |
| 1. Typecheck | `pnpm typecheck` | ✅ 8/8 projects, exit 0 |
| 2. Lint | `pnpm lint` | ✅ 0 errors, 0 warnings, exit 0 |
| 3. Production build | `pnpm build` | ✅ all projects, exit 0 |
| 4. Unit + integration | `pnpm test` | ✅ **791 passed**, exit 0 |
| 5. Browser suite, 3 target viewports | `playwright test` | ✅ **363 passed**, 3 skipped, 0 failed, exit 0 |
| 6. Performance suite, 4 configurations | `playwright test --config=playwright.perf.config.ts` | ✅ **16 passed**, exit 0 |

**Unit + integration breakdown:** contracts 56 · ui 18 · world-model 7 · event-types 14 · runtime-adapters 128 · persistence 135 · agent-city 389 · api 44 = **791**.

**The 3 skipped tests were then executed** — see §7, finding 1. They pass. Total automated tests executed for this report: **1,173**.

## 2. Functional tests — F-01 through F-12

Every requirement is mapped to the tests that actually prove it. Where the acceptance ID is not annotated in the code, the mapping was verified by reading the tests, not inferred from naming.

| ID | Requirement | Proving tests | Result |
| --- | --- | --- | --- |
| **F-01** | Demo start/pause/resume/speed/reset/replay without corrupting order | `runtime.test.ts` — "demo.pause stops advancing; demo.resume continues from exactly the same cursor with no reorder/loss", "demo.set_speed changes pacing only, never event content or order"; `CommandBar.test.tsx` (6 tests, bounded commands + disabled states); `commands.test.ts` "accepts each of the six exhaustive demo commandTypes"; `shell-controls.spec.ts:10`; `shell-v1-primary-journey.spec.ts:223` (replay produces identical outcome) | ✅ |
| **F-02** | Every building/agent selectable via pointer and keyboard; navigator sync | `shell-agents.spec.ts:56` (pointer hit target + navigator sync), `:87` (navigator→canvas sync), `:99` (Escape clears); `shell-selection.spec.ts:23` (Lighthouse pointer), keyboard selection tests; `shell-residences`, `shell-operational-buildings`, `shell-vehicle` equivalents; `shell-accessibility.spec.ts:136` "every canvas object has a navigator equivalent" | ✅ |
| **F-03** | Frontend cannot force stage completion, transfer readiness, approval, or upgrade completion | `commandHandler.test.ts` — transition-graph enforcement, "rejects Agent.Depart on an agent that was never assigned, with zero mutation", "rejects reopening a completed stage without a Revision"; `inspectorValidation.test.ts` "credential decides identity" + "rejects a request with a fabricated credential"; `ApprovalCredential.test.tsx` (6 tests — the browser holds no agent credential and resolution is disabled without an operator one); `runtime.test.ts` "rejects an unknown commandType and does not mutate state" | ✅ |
| **F-04** | Mandatory failed/pending requirement blocks stage completion and transfer readiness | `commandHandler.test.ts:142` `describe("CommandHandler — BuildStage / F-04 mandatory requirements")` | ✅ |
| **F-05** | Builder cannot produce `stage.validation_passed`; Inspector path required | `script.test.ts:76` "F-05: only the Inspector ever authors stage.validation_started/passed — the Builder cannot self-certify"; `commandHandler.test.ts:201` `describe("CommandHandler — F-05 Builder self-certification rejected")`; `inspectorValidation.test.ts:136` "rejects the same request with the Builder credential" | ✅ |
| **F-06** | Pending approval pauses gated transition; approve/reject/revision paths defined | `runtime.test.ts:210` `describe("MockRuntime — approval gating (F-06)")`; `approvalActions.test.ts` (rejected + revision-requested event builders); `approvalWorkflow.test.ts` (persistence + api); `shell-controls.spec.ts:69` keyboard-only approve, `:92` reject | ✅ |
| **F-07** | Agent/build pause-resume record commands/events; rejected commands visible | `runtime.test.ts` pause/resume cursor integrity and command-event emission; `CommandBar.test.tsx:105` "shows the rejection reason when a command is rejected"; `shell-controls.spec.ts:10` "Pause/Resume are typed, bounded commands with visible feedback" | ✅ |
| **F-08** | Event history survives reload and reconstructs projection | `persistenceService.test.ts:76` "restart reconstruction … reproduces an identical WorldState and entity set (F-08)"; `recovery.test.ts` (23 tests organised by reachable state — mid-build, blocked, pending approval, resolved approval, failed validation, in-progress and timed-out AgentRun, all four upgrade states) | ✅ |
| **F-09** | Duplicate events do not duplicate cargo, timeline rows, agents, or transfers | `reconcile.test.ts:21` `describe("mergeEvents — duplicate delivery safety (F-09)")`; `commandHandler.test.ts:336` idempotency; `persistenceService.test.ts:57`; `v1AcceptanceInvariants.test.ts` — full-journey duplication and interleaved duplicate delivery leave final WorldState unchanged; `EventTimeline.test.tsx` "a duplicated event id never produces a duplicate row" | ✅ |
| **F-10** | Disconnect disables mutations and shows disconnected/stale; restore reconciles | `connectionState.test.ts:37` stale labeling; `ConnectionBanner.test.tsx` (3 describes: stale labeling, mutation controls disabled, Lighthouse shows disconnected); `CommandBar.test.tsx:130`; `backendClient.test.ts` (resume from last event id, backoff reset); **browser-level:** `shell-realtime-connection.spec.ts` ×3 viewports — see §7 finding 1 | ✅ |
| **F-11** | Warehouse upgrade from real metrics; capacity 25→100; batch intake in mock | `v1PrimaryJourney.test.ts` steps 17–19 (eligibility from seeded history, operator approval, `upgrade.started`/`completed`), asserting `capacity_100` absent before and present after; `worldStateReducer.test.ts:117` asserts `["capacity_100", "batch_intake"]`; `warehouseUpgrade.test.ts` (persistence, eligibility computed from real metrics); `shell-operational-buildings.spec.ts:100` (level 1 → level 2 only after real `upgrade.completed`) | ✅ |
| **F-12** | One controlled Claude Code stage via adapter with logs/exit/outputs/evidence | `controlledStage.test.ts:78` `describe("controlled stage (F-12)")` + 128 runtime-adapter tests (boundary, policy, containment: paths/commands/environment); **real execution** performed at FBL-028 with captured evidence — see §7 finding 2 | ✅ |

## 3. Visual-to-operational consistency — V-01 through V-08

| ID | Requirement | Proving tests | Result |
| --- | --- | --- | --- |
| **V-01** | Ten-second comprehension using labeled regions | `shell-v1-primary-journey.spec.ts:28` "every major transition is comprehensible within ten seconds: running, who's working, blocked, failed, needs approval, completed, upgrade"; `:132` "2D-only comprehension … without reading the 3D world"; `shell-layout.spec.ts` mandatory-region presence per viewport | ✅ |
| **V-02** | Meaningful motion/states match backend; no false completion during animation | `v1AcceptanceInvariants.test.ts:14` — Warehouse never reports level 2 or `capacity_100` before `upgrade.completed` **at every prefix of the canonical script**; `shell-vehicle.spec.ts:92` "never reports in_transit … without transfer.started backing it — no fabricated motion"; `runtime.test.ts:244` rejection does not fabricate progress; `agentPosition.test.ts`, `roadNetwork.test.ts`, `vehiclePosition.test.ts` (return null rather than fabricate) | ✅ |
| **V-03** | Every meaningful animation has text equivalent | `v1AcceptanceInvariants.test.ts:97` "every event in the complete run has a non-empty, non-throwing textual equivalent"; `eventProjectionMap.test.ts:21` (every entry has a non-empty `textualEquivalent`); `eventToWorldMapping.test.ts:227`; reduced-motion e2e across `shell-lighthouse`, `shell-camera`, `shell-selection`, `shell-event-to-world-mapping`, `shell-v1-primary-journey` | ✅ |
| **V-04** | Cargo remains incomplete while intentional requirement failed | `shell-event-to-world-mapping.spec.ts:32` (browser, matched against timeline text); `eventToWorldMapping.test.ts:20`; `cargoState.test.ts:54` | ✅ |
| **V-05** | Vehicle cannot depart before `transfer.started` | `shell-event-to-world-mapping.spec.ts:52` (browser); `eventToWorldMapping.test.ts:66`; `vehiclePosition.test.ts:37`; `v1PrimaryJourney.test.ts:152` | ✅ |
| **V-06** | Lighthouse states distinct and labeled | `lighthouseVisuals.test.ts` / `lighthouseState.test.ts` (state distinctness); `colorIndependence.test.ts` (20 tests — no state lacks a label, no two states share one); `shell-lighthouse.spec.ts:32`, `:41` (textual status reflects real runtime state through a full run), `:88` (rendered at its own reported position) | ✅ |
| **V-07** | Warehouse visual level changes only after `upgrade.completed` | `warehouseUpgrade.test.ts:391` `describe("FBL-031 — V-07: nothing visible changes before completion")`; `recovery.test.ts:411` "upgrading: recovers at Level 1 with capacity 25 — V-07 survives a restart"; `v1AcceptanceInvariants.test.ts:14` (every script prefix) | ✅ |
| **V-08** | Ultrawide uses full screen; world remains dominant | `shell-layout.spec.ts:18` "uses the full viewport with no app-wide max-width clipping" (×3 viewports), `:46` "central world region remains dominant by width", `:58` "no mandatory region collapses to zero size"; `page.test.tsx:22` "has no app-wide max-width utility on the shell root" | ✅ |

## 4. Remaining acceptance sections

| Section | Verification | Result |
| --- | --- | --- |
| Ten-second comprehension | V-01 above; the seven questions are each asserted in `shell-v1-primary-journey.spec.ts:28` | ✅ |
| Primary user journey (15 steps) | `v1PrimaryJourney.test.ts` — step-by-step, including the B-01 transfer detail (Inspector validation begins only after the Warehouse→QA transfer's receipt; the QA→Dock leg is the only approval-gated one); `shell-v1-primary-journey.spec.ts` end-to-end in browser | ✅ |
| Ultrawide layout | `shell-layout.spec.ts`, `shell-panels.spec.ts` (resize/collapse/reset, keyboard and pointer), `shell-camera.spec.ts` (horizontal space, bounds) | ✅ |
| Persistence | `recovery.test.ts` (23 tests by reachable state), `persistenceService.test.ts`, `sessionPersistence` reload path | ✅ |
| Failure and recovery | `commandHandler.test.ts` (structured rejection, zero mutation), `agentRunLifecycle.test.ts`, `warehouseUpgrade.test.ts` (failed upgrade retains prior capability), runtime-adapter timeout/termination tests | ✅ |
| Idempotency | F-09 above; `v1AcceptanceInvariants.test.ts` full-journey replay and interleaved duplicates | ✅ |
| Accessibility | `shell-accessibility.spec.ts` (7 tests × 3 viewports), `colorIndependence.test.ts` (20 tests), `shell-panels.spec.ts` focus tests | ✅ |
| Reduced motion | Reduced-motion variants across `shell-lighthouse`, `shell-camera`, `shell-selection`, `shell-event-to-world-mapping`, `shell-v1-primary-journey`, `shell-accessibility` | ✅ |
| Performance | FBL-034 suite, 16 tests across 4 viewport configurations; all budgets met (`docs/evidence/fbl-034/performance-measurements.md`) | ✅ |

## 5. Excluded features remain unimplemented

Verified against `docs/01-mission/exclusions.md` by searching application and package **source** (excluding tests and docs).

| Exclusion | Verification |
| --- | --- |
| Full city / multiple districts / company campuses / Academy | `WORLD_BUILDINGS` contains exactly `lighthouse`, `construction_office`, `construction_site`, `warehouse`, `qa`, `deployment_dock`, and 3 × `home` — matching `world-model.md` ("Three residences only"). Zero source references to district, campus, or academy. |
| Agent hiring pipeline / decorative citizens | Exactly 3 agents in `WORLD_AGENTS`. The only "citizen" references are negative assertions in comments ("never decorative citizens, never more than three"). |
| Opportunity Center / Market Intelligence / Strategic Planning | Zero source references. |
| Economy simulation / autonomous spending | Zero economy references. The only "spend" references are a **hard ceiling** (`--max-budget-usd`) on Claude Code API cost — a bound on spending, the opposite of autonomous spending. |
| Complex traffic / weather / building interiors | Only negative assertions in comments ("no textures, no weather, no day/night"; "no interior"). |
| Multiplayer / land purchasing / multiple simultaneous businesses | Zero references. ("land" matches only `travelAndWork` and a comment about scroll position.) |
| External publishing / job applications | Zero references. |
| Destructive filesystem actions | `runtime-adapters/src/containment/` — `paths.ts`, `commands.ts`, `environment.ts` with dedicated tests; write confinement detected and denied. |
| Full OpenClaw integration / broad third-party integrations | Zero OpenClaw references. Runtime dependencies are minimal: agent-city uses only React/Next/three/@react-three-fiber plus workspace packages; api uses **only** workspace packages. |
| Advanced agent training / large upgrade trees / photorealistic assets | Single Warehouse L1→L2 upgrade only; all geometry procedural low-poly. |
| **R3–R5 risk-class actions** | `V1RiskClassSchema = z.enum(["R0", "R1", "R2"])` — R3–R5 are **unrepresentable in the type system**, not merely rejected at runtime. |
| Unrestricted natural-language shell execution from the command bar | `DemoCommandSchema` is a closed discriminated union of exactly six commands; the command bar renders buttons, not a text input. `commands.test.ts` asserts the set is exhaustive and rejects anything outside it. |
| Archive as implementation authority / Future Registry as active scope | No source references to `docs/archive/` or the Future Registry. |

## 6. Documentation matches implementation

Spot-verified where the documentation makes checkable claims:

- **World model** — `world-model.md`'s building and agent inventory matches `WORLD_BUILDINGS` / `WORLD_AGENTS` exactly, including "Three residences only".
- **Target resolutions** — `interface-model.md` lists 5120×1440 (preferred), 3840×1080 (supported), 2560×1440 (usable fallback); `playwright.config.ts` runs precisely these three projects.
- **Demo command set** — `event-model.md`'s six demo control commands match `DemoCommandSchema` exactly.
- **Backend mode** — `README.md` documents `NEXT_PUBLIC_FOUNDRY_API_URL`, the `/events/stream` subscription, `/world-state` reconciliation, and the disconnect behaviour; all four were exercised by the F-10 browser run in §7.
- **Build ladder** — every rung FBL-001–FBL-034 carries an implementation record and an operator acceptance entry; the status header was corrected at `1b1689a` (it had still read "FBL-029 and later are not authorized" after those rungs closed).

## 7. Findings

Two findings. Neither is an open defect.

### Finding 1 — a mandatory requirement's browser-level test had never executed

`shell-realtime-connection.spec.ts` carries `test.skip(!process.env.NEXT_PUBLIC_FOUNDRY_API_URL, …)`. Because the default suite builds against the mock runtime, these 3 tests (1 test × 3 viewports) were **skipped on every run since FBL-026** — and they are the browser-level proof of **F-10**, a mandatory functional requirement. Their screenshot baselines had never been created, which is what made it visible: a test that had ever run would have had them.

This is precisely what a terminal acceptance rung is for. **Resolution:** the tests were executed for this report, in backend mode:

```
NEXT_PUBLIC_E2E=1 NEXT_PUBLIC_FOUNDRY_API_URL=http://backend.test pnpm exec next dev -p 4300
NEXT_PUBLIC_FOUNDRY_API_URL=http://backend.test pnpm exec playwright test e2e/shell-realtime-connection.spec.ts
```

Every functional assertion passed on the first attempt, before any baseline existed — the stale banner appears with `data-connection-status="disconnected"`, all five mutation controls (Start/Pause/Resume/Reset/Replay) are disabled, and restoring the stream clears the banner. Only the screenshot comparison failed, for want of a baseline. Baselines were then generated and a **real comparison run** was executed against them: **3 passed / 3 viewports**.

**Stated honestly:** the screenshot assertions prove nothing *on this run*, because the baselines were generated from this same build. They guard future runs. The evidence for F-10 today is the functional assertions, which passed independently of the baselines, plus the unit-level coverage listed in §2.

No application defect was found, so **no earlier rung was reopened** — the ladder requires a defect to be fixed in its owning rung, and there was no defect, only a test that had never been given the chance to run.

### Finding 2 — F-12's real controlled run was not re-executed

F-12 requires one controlled Claude Code stage through the adapter with logs, exit status, outputs, and evidence. That execution was performed at **FBL-028**, with evidence retained at `docs/evidence/fbl-028/` (`stdout.txt`, `stderr.txt`, `diff.patch`, `evidence.json`, `tests.txt`, `agentrun.sqlite`) and reviewed and approved by the operator on 2026-08-01.

It was **not re-run for this report**, deliberately. The FBL-028 approval is explicitly narrow — one controlled Builder stage, disposable non-sensitive fixture repositories only, R0–R2 only — and was recorded as **exhausted**. Re-running real Claude Code execution against a live API would require fresh operator authorization, which has not been given. The adapter's behaviour is covered by 128 automated runtime-adapter tests including `controlledStage.test.ts (F-12)`; the *real* execution is evidenced by the retained FBL-028 artifacts.

If the operator wants F-12 re-executed live as part of sign-off, that needs separate authorization.

### Finding 3 — Safari/WebKit was never exercised by automation, and three issues surface there

`v1-acceptance.md` § "Test environment" names **current Chrome and Safari**. Every rung from FBL-001 to FBL-034 specified Chromium-based Playwright projects only, so **Safari has never been covered by automation** — a coverage gap, not a regression. This rung exists to catch exactly that, so the full functional suite was run against WebKit at all three target viewports (`playwright.webkit.config.ts`, added for reproducibility).

**Result: 356 passed, 7 failed, 3 skipped** — three distinct issues, each appearing at multiple viewports:

**3a. `<button>` elements are not reachable by Tab in WebKit** (`shell-panels.spec.ts:20`, all three viewports). The Tab walk reaches the resize separators and the `<select>` filters but never "Reset layout", "Collapse left navigation", "Collapse right live-intelligence", or "Collapse event timeline" — every one of which is a `<button>`. This is the long-standing macOS behaviour where buttons are outside the keyboard loop unless "Press Tab to highlight each item" / Full Keyboard Access is enabled.

*Uncertainty stated plainly:* Safari 17+ on macOS Sonoma and later enables that setting **by default**, so Playwright's WebKit build may be reproducing an older default rather than what a current Safari user experiences. This has not been verified against real Safari, and that verification is exactly what the operator's own machine can settle. It matters because the keyboard critical path is a mandatory accessibility requirement — if real Safari behaves this way, the requirement does not hold there.

**3b. Pointer selection of the Lighthouse fails** (`shell-selection.spec.ts:23`, all three viewports). The marker's reported screen position moves between polls — `26.7 / 72.5` then `60.2 / 31.8` — so the camera is still settling when the test reads the position, and the click lands somewhere else. This is the **moving-target race** class repaired for agents and the vehicle in FBL-034, here driven by camera settling rather than object motion; WebKit's different timing exposes it where Chromium's did not. It looks like a test-side race rather than an application defect, but that has not been proven, and saying so without proof is exactly the shortcut this ladder forbids.

**3c. Canvas pixel readback fails at 5120×1440 only** (`shell-lighthouse.spec.ts:88`). Likely a `preserveDrawingBuffer` / `drawImage` difference in WebKit at large buffer sizes. Not diagnosed.

**No fix was attempted, deliberately.** This rung's allowed work is test execution and reporting; a fix for any of these would reopen its owning rung (FBL-006 for the panel framework, FBL-015 for selection, FBL-014 for the Lighthouse), which is a scope decision belonging to the operator. The WebKit config is committed so the finding is reproducible rather than a claim in a document, and is kept **separate** from the default suite so the gap stays visible instead of being silenced or turning the default suite red.

## 8. Definition of done

`v1-acceptance.md` § "Definition of done":

| Condition | Status |
| --- | --- |
| All mandatory tests pass | ⚠️ **Chromium: yes** — 1,173 automated tests, 0 failures, 0 mandatory tests waived. **Safari: no** — 7 failures across 3 issues (§7, finding 3). Safari is a named target browser, so this condition is **not fully met**. |
| No TypeScript, lint, or production build errors | ✅ gates 1–3 |
| Automated tests cover transitions, idempotency, approval gates, transfer gates | ✅ `commandHandler.test.ts` / `transitionGraphs.ts`, F-09, F-06, F-04 |
| Deterministic demo completes reliably | ✅ full journey green ×3 consecutive browser runs, two under CPU contention (FBL-034) |
| One real Claude Code stage completes in the controlled adapter | ✅ FBL-028 evidence; not re-run (§7, finding 2) |
| Documentation matches implementation | ✅ §6 |
| Excluded features remain unimplemented | ✅ §5 |

`active-mission.md` § "Completion gate" — every mandatory acceptance test passes, excluded features remain unimplemented, and documentation matches behaviour. Two of the three hold unconditionally. The first holds **on Chromium only**; on Safari, a named target browser, it does not (§7, finding 3).

**Therefore V1 is not declared complete by this report.** Field 12 of this rung is explicit: it does not close until a full clean run passes with zero reopened items outstanding. Three items are outstanding.

Three ways forward, all of them the operator's call, not the assistant's:

1. **Authorize the fixes.** Each reopens its owning rung (FBL-006, FBL-015, FBL-014), is fixed there, and FBL-035 re-runs — the sequence field 12 prescribes.
2. **Verify against real Safari first.** Finding 3a in particular may be an artifact of Playwright's WebKit build rather than current Safari behaviour; a few minutes on the actual browser would settle whether there is anything to fix.
3. **Amend the acceptance spec** to state that automated coverage is Chromium-only with Safari verified manually. This is a change to Foundation 1.0's specification and, per `FOUNDATION_VERSION.md`, requires a reviewed amendment rather than a silent edit.

## 9. What is NOT established by this report

**Operator sign-off has not been performed.** Field 10 of FBL-035 requires the operator to perform the complete primary user journey personally, end-to-end, unassisted — confirming ten-second comprehension and every acceptance behaviour live, *not merely reading automated test output*. This report is automated test output. It cannot and does not substitute for that.

Until the operator performs that journey and signs off:

- FBL-035's stop condition is **not met**.
- **V1 is not complete.** The ladder's terminal stop has not been reached.

Also not established:

- Results are from one machine. Chromium is clean; Safari/WebKit has three open issues (§7, finding 3) and no rung ever covered it.
- Finding 3a has **not** been checked against real Safari, only Playwright's WebKit build. Those can differ on exactly the setting in question.
- Screenshot baselines created during this run guard future runs but prove nothing on this one (§7, finding 1).
- F-12's live execution was not repeated (§7, finding 2).
