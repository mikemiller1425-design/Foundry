# V1 Acceptance Report — Agent City

**Rung:** FBL-035 — Complete V1 acceptance verification (terminal rung)
**Date:** 2026-08-01
**Commit under test:** `1b1689a`
**Authority:** `docs/02-specification/v1-acceptance.md` (entire document); `docs/01-mission/active-mission.md` § "Completion gate"; `docs/01-mission/exclusions.md`
**Machine:** Apple M4 Pro (12 CPU / 16 GPU cores), 24 GB, macOS 25.5.0; primary display Samsung LS49C95xU (native 5120×1440)

**Status (final automated run, 2026-08-01, at `7dc7a23` — after FBL-021A and the FBL-034 reopening):**

- ✅ **Chromium acceptance suite clean:** 378 passed / 0 failed / 3 skipped.
- ✅ **Unit + integration:** 813 passed. Typecheck 8/8, lint clean, production build passing.
- ✅ **Performance:** 16/16, every budget met at all three target viewports **and** the supplementary HiDPI configuration.
- ✅ **Finding 4 closed** — `jump to world object` implemented as **FBL-021A**; no "not yet available" assertion remains.
- ✅ **Finding 5 closed** — camera-settling race repaired deterministically; three consecutive full runs (377 / 377 / 378), two under CPU contention.
- ✅ **F-12** verified by the authorized single re-execution; evidence unchanged.
- ⚠️ **Safari/WebKit automation is not clean:** 372 passed / 6 failed. Three are the operator-classified configuration-dependent Tab issue (finding 3a); **three are newly surfaced and unclassified** (§7, finding 6).
- ⏳ **Operator sign-off not performed** (§9).

**V1 is not declared complete by this report.**

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

### Rerun after the narrow copy correction

The gate was rerun in full after the §7 finding-4 copy corrections:

| Gate | Result |
| --- | --- |
| Typecheck / lint / production build | ✅ exit 0 |
| Unit + integration | ✅ **791 passed**, exit 0 |
| Browser suite, 3 viewports | ⛔ **362 passed, 1 failed**, 3 skipped — `shell-selection.spec.ts:23` (finding 5) |
| Performance suite, 4 configurations | ✅ **16 passed**, exit 0 |

**The rerun is not clean.** One intermittent failure stands; see §7, finding 5.

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

### Finding 2 — F-12 re-executed and verified (RESOLVED)

F-12 requires one controlled Claude Code stage through the adapter with logs, exit status, outputs, and evidence.

Originally this report recorded that the FBL-028 run was **not** repeated, because that authorization was narrow and recorded as exhausted. The operator subsequently authorized **exactly one** re-execution for final acceptance verification, under the same restrictions. It was performed on 2026-08-01 and **succeeded**.

Evidence: `docs/evidence/fbl-035/f12-verification/` (`evidence.json`, `stdout.txt`, `stderr.txt`, `diff.patch`, `tests.txt`, `agentrun.sqlite`). Written to a **separate directory** so the original FBL-028 evidence is untouched — confirmed unmodified by `git status` and unchanged on disk.

Every authorized restriction was met, verified from the captured evidence rather than asserted:

| Restriction | Evidence |
| --- | --- |
| Disposable, non-sensitive fixture repository only | `fixtureRoot: /var/folders/…/T/foundry-fbl028-6IzCab` — a fresh temp directory |
| No Foundry repository execution target | fixture root is outside the repository |
| R0–R2 only | `riskClass: R2`, `policyId: fbl-028-controlled-claude-code` |
| FBL-027 adapter boundary mandatory | executed via `ClaudeCodeAdapter` → `runControlledStage` |
| Identical fixed task and containment policy | same `agentRunId`, task, and profile as FBL-028 |
| No destructive actions | `writeScope.changedPaths: ["src/taskStore.js"]`, `unauthorizedPaths: []`, `withinScope: true` |
| Independent validation mandatory | 12/12 fixture tests passed, exit 0 — verdict: *"Success determined by Foundry's own validation, not by the runtime's self-report."* |
| Full evidence capture | six artifacts listed above |
| Expires after one run | one run performed; the persisted-log duplicate guard refuses another against the same database |

The run was also recorded through the ordinary command path: `agentrun.started` and `agentrun.completed` persisted, terminal state `completed`.

**The authorization is now spent.** No further controlled Claude Code execution is authorized.

### Finding 3 — Safari/WebKit coverage gap (RESOLVED — no product defect)

`v1-acceptance.md` § "Test environment" names **current Chrome and Safari**. Every rung from FBL-001 to FBL-034 specified Chromium-based Playwright projects only, so Safari had never been covered by automation. Running the full suite against WebKit (`playwright.webkit.config.ts`) produced **356 passed, 7 failed** across three issues.

Because Playwright's WebKit is not Safari, those results were **not** treated as conclusive. The operator performed a manual observation in **real macOS Safari**, maximized on the 49-inch 5120×1440 display, with the Tab-highlight setting enabled, and reported:

- **A — Keyboard: PASS.** Tab and Shift+Tab reached the critical controls, focus stayed visible, Enter/Space activated controls, focus left the 3D canvas normally, no keyboard trap.
- **B — Lighthouse selection: PASS.** With the camera settled, selection worked reliably — also after pan/zoom and after Reset View. Selection ring, left navigation, and detail panel all matched. No settled-camera product defect.
- **C — Rendering: PASS.** Full ultrawide fill; all world objects, panels, ground, fog, lighting, agents, roads, and vehicle rendered; animation continuous for 30+ seconds tracking the timeline; no blank canvas, corruption, clipping, tearing, or stale frames; multiple objects selected correctly.
- **Primary journey: PASS** — usable and responsive at normal desk distance in real Safari.

**Classification:**

| # | Issue | Classification |
| --- | --- | --- |
| 3a | `<button>` elements not reached by Tab in Playwright WebKit | **Safari configuration/automation-dependent.** Not a confirmed product defect — real Safari with the Tab-highlight setting enabled reaches every critical control. |
| 3b | Lighthouse pointer selection fails | **Automation-only moving-target race.** Not a settled-camera product defect. Independently corroborated: the same race reproduced in **Chromium** during this rerun — see finding 5. |
| 3c | Canvas pixel readback fails at 5120×1440 | **WebKit test-instrumentation behaviour.** Not a real Safari rendering defect: the readback path depends on `preserveDrawingBuffer`, which is enabled only in test builds, and real Safari rendered the world correctly at that exact resolution. |

Per operator direction, **FBL-006, FBL-014, and FBL-015 are not reopened.** The WebKit config is retained so the gap stays reproducible and visible rather than silently dropped.

### Finding 4 — `jump to world object` is a mandatory V1 capability that was never implemented (OPEN, BLOCKING)

Investigating the stale developer-facing copy surfaced something larger than copy.

`interface-model.md` § "Bottom event timeline" specifies the region as: *"Chronological feed with filter (severity/entity/type), pause autoscroll, payload inspect, **jump to world object**, history after reload."* FBL-009's own objective names it too.

**It does not exist.** A search of application source for any jump/focus-from-timeline implementation returns nothing. What ships is a permanently disabled control reading *"Jump to world object — not yet available"*, with the tooltip *"Not available — no 3D world object exists yet (build ladder rung FBL-016+)"* — a reason that was true at FBL-009 and has been false since FBL-016–FBL-021 completed.

How it fell through the ladder, precisely:

- **FBL-009** named jump-to-world-object in its objective, but its acceptance criteria (field 11) and required tests (field 9) did not include it, and its stop condition was an explicit *"Hard stop before mapping events onto the 3D world (FBL-021)"*. It closed legitimately against its own stop condition.
- **FBL-021** — the rung that made the world event-aware, and the only point at which the jump becomes implementable — never claimed it. Its objective covers wiring events to surfaces, not a timeline→world navigation control.
- **No other rung mentions it.** It is named exactly once in the entire ladder, at line 227.

Two tests actively pin the gap as correct: `EventTimeline.test.tsx:187` and `shell-timeline.spec.ts:147` both assert the control reads *"not yet available"*. That is why every gate passed — the suite encodes the absence as expected behaviour.

**Which acceptance requirement this violates:** no F-01–F-12 or V-01–V-08 line names it, which is exactly why the §2/§3 matrix passed. It violates the **Definition of done — "documentation matches implementation"** and `active-mission.md`'s completion gate — *"documentation matches behavior"*. The specification documents a capability the implementation does not have.

**Not corrected here, deliberately.** The stale wording is a symptom; rewriting it would conceal the gap rather than close it. Implementing the capability is feature work, which this rung prohibits and which the operator's instruction ("do not invent a new feature") forbids. It requires an operator decision (§9).

*What was corrected:* two genuinely stale strings with no feature implications — the top system bar's `"Placeholder — populated at a later build ladder rung."` (that region is populated: connection state and layout reset), and the world region's claim that *"event-to-world mapping is build ladder rung FBL-021+"* (FBL-021 is complete). Neither was asserted by any test; affected gates were rerun.

### Finding 5 — the Chromium acceptance gate is not clean (OPEN, BLOCKING)

The rerun produced **one failure**: `shell-selection.spec.ts:23` — "pointer click on the Lighthouse selects it" — at 3840×1080.

The signature is identical to finding 3b: the Lighthouse marker's reported screen position changes between reads (`38.40 / 72.46` → `55.08 / 31.75`), so the camera is still settling when the test computes where to click and the click lands off-target. The Lighthouse itself does not move; the **camera** does, during its focus animation.

This is the same moving-target race class repaired in FBL-034 for agents and the vehicle. That rung fixed the instances that were failing at the time; this one was not failing then and was left untouched. It is **intermittent** — it passed in the previous acceptance run and across three consecutive FBL-034 runs, two under deliberate CPU contention.

Its appearance in Chromium independently **confirms** the operator's classification of 3b as automation-only rather than Safari-specific: the race is engine-independent and lives in the test, not the product.

**Consequence:** FBL-035 field 12 requires *"a full clean run passes with zero reopened items outstanding."* An intermittent failure is not a clean run, so this rung cannot close while it stands. The repair is the same deterministic stable-state synchronization used in FBL-034 — settle the camera before reading the marker position — and is test-side only, touching no application code. **Not applied**, pending authorization (§9).

### Finding 4 — CLOSED: `jump to world object` implemented (FBL-021A)

Implemented as an amendment rung, `FBL-021A — Timeline-to-world-object navigation closure`, per the ladder's own amendment rule and without renumbering. **The specification was implemented, not weakened.**

Resolution is by declared identifier only — `entityId` where the entity *is* a world object, or a named `IdSchema` payload field where the contract declares the relationship. A test asserts that the display name `"Architect"` resolves to nothing, because a jump that guesses is worse than one that is unavailable. `transfer.completed`, `upgrade.completed` and every project-level event stay unavailable **with a stated reason**, rendered as text with `aria-describedby` rather than a `title` tooltip. Agents gained camera focus they never had, resolved from their live position. Navigation emits no operational event.

22 new tests; the two that pinned "not yet available" were replaced with tests of the real capability, verified across all three target viewports.

### Finding 5 — CLOSED: camera-settling race repaired (FBL-034 reopened)

`stableProjectedPosition()` waits until a marker's projected coordinates stop changing before they are read and clicked. **No timeout raised, no retry added, no production camera behaviour changed.**

Before: 4 failures in 36 runs (11%). After: 72/72. Three consecutive full-suite runs — idle 377, six burners plus a looping unit suite 377, twelve burners with all cores saturated 378 — all zero failures.

A second instance of the same defect was found *by* the contention run (`shell-lighthouse.spec.ts:88`) and repaired identically.

### Finding 6 — NEW: three unclassified Safari/WebKit automation failures (OPEN)

The final WebKit run is **372 passed / 6 failed**, down from 7. What changed is informative:

- **The camera-settling repair fixed WebKit too.** The original finding 3b (`shell-selection.spec.ts:23` pointer click) and finding 3c (`shell-lighthouse.spec.ts:88` pixel readback) now **pass** under WebKit. That confirms 3c was the same camera race rather than a `preserveDrawingBuffer` limitation, as §9 of the FBL-034 evidence anticipated.
- **Three remaining failures are finding 3a** (`shell-panels.spec.ts:20`, all three viewports) — the `<button>`-not-Tab-reachable issue the operator classified as Safari configuration-dependent after observing real Safari PASS. Expected to persist in Playwright's WebKit; **classification preserved, not re-opened.**
- **Three are newly surfaced and have no classification:** `shell-selection.spec.ts:150` ("selecting the Lighthouse moves the camera to focus on it", 5120×1440 and 3840×1080) and `shell-event-to-world-mapping.spec.ts:119` ("every meaningful visual transition has a readable timeline equivalent", 5120×1440).

These three were masked before — the suite failed earlier for other reasons at those viewports. They have **not** been diagnosed and are **not** classified. They may be further instances of the same camera-timing class, or WebKit-specific behaviour, or real defects; saying which without evidence is exactly the shortcut this ladder forbids.

**Impact on the acceptance criteria:** `v1-acceptance.md` names Safari as a target browser, and the operator's real-Safari observation recorded a full PASS including the primary journey. Automated WebKit coverage is not clean. Whether that blocks V1 is an operator determination — the specification requires Safari to *work*, which real Safari does; it does not require Playwright's WebKit build to be green.

## 8. Definition of done

`v1-acceptance.md` § "Definition of done":

| Condition | Status |
| --- | --- |
| All mandatory tests pass | ⚠️ **Chromium: yes** — 378 passed / 0 failed, plus 813 unit/integration and 16 performance, no mandatory test waived. **WebKit automation: 6 failures** — 3 the classified configuration-dependent Tab issue, 3 newly surfaced and unclassified (§7, finding 6). Real Safari was observed to PASS. |
| No TypeScript, lint, or production build errors | ✅ gates 1–3 |
| Automated tests cover transitions, idempotency, approval gates, transfer gates | ✅ `commandHandler.test.ts` / `transitionGraphs.ts`, F-09, F-06, F-04 |
| Deterministic demo completes reliably | ✅ full journey green ×3 consecutive browser runs, two under CPU contention (FBL-034) |
| One real Claude Code stage completes in the controlled adapter | ✅ **Re-executed live under the operator's one-run authorization and verified** — write confinement clean, independent validation 12/12 (§7, finding 2) |
| Documentation matches implementation | ✅ **Yes.** `jump to world object` is implemented (FBL-021A); the two stale strings were corrected; world-model, target resolutions, demo command set, and backend-mode docs all re-verified against source. |
| Excluded features remain unimplemented | ✅ §5 |

`active-mission.md` § "Completion gate" — every mandatory acceptance test passes, excluded features remain unimplemented, and documentation matches behaviour. Two of the three hold unconditionally. The first holds **on Chromium only**; on Safari, a named target browser, it does not (§7, finding 3).

**Therefore V1 is not declared complete by this report.** Field 12 of this rung is explicit: it does not close until a full clean run passes with zero reopened items outstanding. Three items are outstanding.

Three ways forward, all of them the operator's call, not the assistant's:

1. **Authorize the fixes.** Each reopens its owning rung (FBL-006, FBL-015, FBL-014), is fixed there, and FBL-035 re-runs — the sequence field 12 prescribes.
2. **Verify against real Safari first.** Finding 3a in particular may be an artifact of Playwright's WebKit build rather than current Safari behaviour; a few minutes on the actual browser would settle whether there is anything to fix.
3. **Amend the acceptance spec** to state that automated coverage is Chromium-only with Safari verified manually. This is a change to Foundation 1.0's specification and, per `FOUNDATION_VERSION.md`, requires a reviewed amendment rather than a silent edit.

## 9. What is NOT established, and what the operator must decide

**V1 is not complete.** One item is open, and the operator's sign-off has not been given.

### Open item — finding 6: three unclassified WebKit automation failures

`shell-selection.spec.ts:150` (×2 viewports) and `shell-event-to-world-mapping.spec.ts:119` (×1). Not diagnosed, not classified, not waived. Options: diagnose and classify them as the earlier three were; repair them if they prove to be further camera-timing instances; or record that automated Safari coverage is advisory and real-Safari observation is the acceptance evidence. Each is an operator decision.

The three *previously* classified WebKit failures (finding 3a) remain classified as Safari configuration-dependent, on the strength of the operator's real-Safari observation. That classification is **preserved, not revisited**.

### Operator sign-off

Field 10 requires the operator to perform the complete primary user journey personally, end-to-end, unassisted — confirming ten-second comprehension and every acceptance behaviour live, *not merely reading automated test output*. This report is automated test output and cannot substitute for it.

### Also not established

- Results are from one machine. The performance suite requires a quiet one: an intermediate run taken immediately after the CPU-saturation runs reported 14.6 FPS sustained-low at HiDPI; re-measured on a settled machine it was 41.7. The recorded figures are the settled ones, and this is noted so the discrepancy is visible rather than silently dropped.
- Screenshot baselines guard future runs but prove nothing on the run that generated them.
- The F-12 authorization is **spent**: one run performed and verified, evidence unchanged (`evidence.json` md5 `11635c1b0bd1c3703da7047a21ae351c`).
- FBL-021A's operator validation is folded into FBL-035's final journey; it has no separate observation gate.
