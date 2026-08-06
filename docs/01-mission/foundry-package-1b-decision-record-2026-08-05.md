# Foundry Package 1b — Operator Decision Record (ratified)

**Type:** Authoritative decision record
**Date:** 2026-08-05
**Package:** Construction Package 1b (frontend reconciliation, then the Command Center)
**Decided by:** mikemiller1425-design (human operator)
**Recorded starting point:** `7d7fff6d06745cf80133066091cb67b8a2e0baf1` — the audited frontend projection-honesty checkpoint
**Supersedes for C-1 – C-4:** `docs/01-mission/foundry-package-1b-decision-record.md` (2026-08-04)
**Resolves:** `docs/01-mission/foundry-mission-realignment-2026-08-04.md` § 6 — **C-1**, **C-2**, **C-3**, **C-4**

---

## 0. Standing

This is the **ratified** operator record for Package 1b. The 2026-08-04 record remains in place, unedited, as the first statement of these decisions. **Where the two differ, this record governs.** § 6 below lists every difference explicitly, because two of them correct a reading the earlier record stated as settled.

Corrections occur through new records, never edits — Decision 4 of `docs/01-mission/agent-city-v1.1-decision-record.md`, and Foundry principle 18.

**C-5** (buildings as economic objects) is **not decided here** and remains out of scope through Package 5.

**Nothing in this record is implemented.** It authorizes no code, no contract, no rename, and no commit beyond itself. Package 1b implementation still requires its own explicit authorization.

### Recorded starting point

The repository state these decisions attach to is **`7d7fff6`**, which contains Package 1a (`d4a9bd8`), the 2026-08-04 decision record (`0337e90`), and the eleven-path frontend projection-honesty checkpoint. The audited remaining frontend — **82 dirty paths under `apps/agent-city`**, manifest digest `e6bedfcc4814b1dd16d9521414c8463c1845762b988789543b8b6121e5f213bb` — is **unchanged and uncommitted**, and is the scope the separately authorized reconciliation will act on.

> **→ Corrected. See § 8.** This count and digest are **wrong: 82 of 83**. `e6bedfcc…` remains reproducible and no drift occurred in the 82 files it covers, but it omitted `apps/agent-city/src/lib/mock-runtime/RuntimeProvider.tsx`, which was only *partially* staged at `7d7fff6` and stayed dirty. The authoritative baseline is now the portable 83-file digest **`776d0653ffcfc86415961a94f47e80917662a3a14ba14d9978feb11d6c651b80`** (`docs/evidence/package-1b/`). The paragraph above is left unedited as the state of the record when it was written.

### How to read authority in this document

| Marking | Meaning |
| --- | --- |
| Blockquote under **Decision** | **Operator-confirmed.** Recorded as given |
| **What this settles** · **Consequences** · **Acceptance criteria** | **Operator-confirmed.** Direct entailments of the decision text |
| **(proposal)** | **Assistant-authored suggestion.** No operator authority |
| **Open — not decided here** | Recorded so it is not mistaken for settled |

---

## Decision C-1 — Status of the V1.1 mission

> **V1.1 is PAUSED — not completed, not abandoned, not superseded.**
>
> `AC-111` remains open as a historical governed-execution milestone. `AC-112` is not started. Mission-realignment packages proceed as a **separately governed track** until a future explicit operator decision reconciles them with V1.1.

**What this settles.** Four readings were available — complete, pause, abandon, supersede. **Pause is selected**, and the decision explicitly forecloses *abandoned* as well as *superseded*. A paused ladder keeps every open obligation it already carried.

**Consequences.**
- `AC-111` is **open**. It is not closed, and not closable as a side effect of any Package.
- `AC-112` is **not started**, and is not started by Package work.
- `AC-103` must still close before `AC-111` (Decision 5, V1.1 decision record). The pause lifts nothing.
- The Package track and the V1.1 ladder are **two separately governed tracks**. Package work advances no `AC-*` rung; `AC-*` rungs advance no Package.
- Identifiers are never reused, renumbered, or re-graded across either track.
- Reconciling the tracks requires a **future explicit operator decision**.
- **D-8** (disposition of `e5378aa`) remains **OPEN**, resolving at `AC-117`.

**Acceptance criteria.**
1. Every status surface reports `AC-111` as **open** and `AC-112` as **not started**.
2. No commit, document, or gate closes `AC-111` under Package authority.
3. No document presents the Package track as the successor to, or replacement for, V1.1.
4. `AC-103`'s precedence over `AC-111` is restated intact wherever the ladder is described.
5. Any reconciliation of the two tracks appears only under a **future dated operator decision**, never inferred.

---

## Decision C-2 — Operational missions and spatial traces

> **An operational mission and a spatial agent trace are distinct layers.**
>
> The **operational mission is backend-owned** and represents: briefing · approved loadout, authority, and constraints · launch · mission-specific stages and checkpoints · exceptions and operator decisions · outcome · evidence-backed debrief.
>
> **These are lifecycle facets, not one universal fixed seven-stage sequence.** Each mission type may define its own stages. A NAS inventory can be a `nas_inventory` operational mission with scan-specific stages.
>
> The **frontend spatial agent trace** represents event-supported travel, arrivals, work locations, and returns beneath an operational mission.
>
> During the separately authorized reconciliation: `missionTrace` becomes `agentTrace`; `MissionTracePanel` becomes `AgentTracePanel`; all imports, tests, test IDs, and e2e references follow the semantic rename. **Do not perform those renames in this task.**

**What this settles.** Two things, one of which corrects the earlier record.

**The layer split**: ownership, not vocabulary, is the distinguishing rule. The operational mission is backend-owned; the spatial trace renders event-supported movement *beneath* it. "Mission" belongs to the backend layer, which is why the existing frontend `missionTrace` is misnamed.

**The facet correction**: the seven items are **lifecycle facets**, not a fixed sequence every mission walks in order. The 2026-08-04 record described them as "the seven operational-mission stages," which invited a single shared stage enum. That reading is **withdrawn**. Each mission type declares its own stages; the facets describe what a mission must be able to express, not the order in which any particular mission proceeds.

**Consequences.**
- The seven facets are **backend concepts**. The frontend owns none of them.
- **Mission type is a first-class distinction.** `nas_inventory` is named as a legitimate mission type with scan-specific stages, so stages are per-type from the outset rather than retrofitted.
- The spatial trace is limited to **event-supported movement** — the standing constraint *"no visual progress without a recorded event."*
- The rename is **authorized in principle and deferred in execution**, and its scope is now explicit: symbol, panel, imports, tests, test IDs, and e2e references.
- Neither layer may be implemented under this record.

**Acceptance criteria.**
1. No code path enumerates a fixed universal seven-stage sequence, and no shared enum forces every mission through the same stages.
2. A `nas_inventory` mission declares scan-specific stages **without amending a shared stage enum**.
3. Every one of the seven facets is representable per mission type, and each is backend-owned — the frontend has no authoring path for any of them.
4. The spatial agent trace renders no movement that lacks a recorded event.
5. After the authorized reconciliation: **zero** occurrences of `missionTrace` or `MissionTracePanel` across source, tests, test IDs, and e2e specs.
6. At the reconciliation commit, the rename is a rename — no behavior change rides along with it.

**Open — not decided here.**
- **`operationalMemory` → `operationalSnapshot`.** Raised in audit, and **again absent from the operator's decision text**. `lib/runtime/operationalMemory.ts` and `operationalMemory.test.ts` remain untracked and **undisposed**; the reconciliation has no authority over them.
  **→ Decided later the same day. See § 7.1** — the rename is authorized and the "purely derived" precondition was verified as holding. This bullet is left unedited as the state of the record when § C-2 was ratified.
- Disposition of the remaining in-flight panels (operational memory, agent life, runtime readiness, world atlas) beyond the layer separation above.

**(proposal)** Each facet a mission type declares should enter the closed event/command vocabulary at the rung that emits it — the `AC-107` discipline: *an event nothing can emit is a claim the system does not honour.*

---

## Decision C-3 — Coverage honesty

> **Coverage is scoped to named sources and a defined briefing or scan interval.**
>
> **Required states:** checked · unavailable · not connected · excluded · uncertain · not yet checked.
>
> **Foundry may never make a global claim that nothing was missed.**
>
> **"No external actions occurred" is derived** when zero qualifying external-action events exist in the defined interval. A fabricated `external_action.none` event is **prohibited**.

**What this settles.** Coverage is never a property of Foundry as a whole — only of a named source over a defined interval. This makes the global claim **unrepresentable**, not merely prohibited.

A negative is **derived, never authored**. Emitting an event to represent an absence manufactures evidence for a non-occurrence — the same defect class as the `AC-111` dangling `evidenceIds`, where *a reference to evidence that does not exist reads like an audit trail*.

**Consequences.**
- Every coverage statement carries a **named source** and a **defined interval**. Either missing makes it invalid.
- The six states are **required**. The earlier record described the list as inclusive; this record states it as a requirement — **no implementation may omit any of the six.**
- **Prohibited:** any global "nothing was missed" claim, at any scope, in any wording.
- **Prohibited:** an `external_action.none` event, or any equivalent synthesized event standing for an absence.
- Unintegrated sources — email, calendar, bills, commitments — report as **not connected**, never omitted.

**Acceptance criteria.**
1. Every rendered coverage statement carries a named source and a defined interval.
2. All six states are representable and reachable; a fixture exercises each.
3. **Zero** occurrences of a global "nothing was missed" claim in any surface or string.
4. **Zero** `external_action.none` events in the vocabulary and in the persisted log.
5. "No external actions occurred" is computed at read time from zero qualifying events, demonstrated by a test where the interval contains none.
6. A source that cannot be determined reports **uncertain** rather than defaulting to a confident state.

**Open — not decided here.**
- **Two coverage vocabularies.** Package 2 is already specified with five different terms — *scanned / skipped / refused / inaccessible / not-yet-scanned* (construction map, Package 2) — and the Package 2a prompt draft adds a sixth, `unsupported`, while omitting `uncertain`. **Reconciling or explicitly mapping these against the six required states is undecided, and blocks Package 2a.**
  **→ Decided later the same day. See § 7.2** — coverage is four orthogonal dimensions, not one enum; Package 2a is no longer blocked on vocabulary. This bullet is left unedited as the state of the record when § C-3 was ratified.
- The definition of a **qualifying external-action event**, and the interval boundary rule (open/closed endpoints, and which clock).

---

## Decision C-4 — Disclosure-depth budget

> **Three disclosure levels:**
>
> 1. **World glance** — state, urgent attention, visible progress, and unmistakable outcome.
> 2. **Tactical mission** — objective, agents, autonomy, loadout, authority, stages/checkpoints, blockers, decisions, cost, and artifacts.
> 3. **Evidence/audit** — complete events, payloads, provenance, coverage, authority evidence, and diagnostics.
>
> **Normal operation must be fully usable through levels 1 and 2.** Level 3 preserves auditability but **cannot be required for ordinary decisions.**

**What this settles.** The realignment left the depth budget unspecified. This record specifies it **by content**, which survives redesign in a way a field count would not, and fixes the usability floor: levels 1 and 2 must carry ordinary operation on their own.

Level 2's enumeration now names **authority** and **stages/checkpoints** explicitly, aligning it with the C-2 operational-mission layer. The tactical view is that layer's ordinary presentation surface.

**Consequences.**
- Level 3 is **always reachable and never required for an ordinary decision.** Both halves bind.
- Content depth is a property of the content, not of operator persistence — level-3 material does not surface at level 1 by default.
- Level 1 must make outcome **unmistakable**; a completed, failed, or blocked mission is distinguishable without reading detail.

**Acceptance criteria.**
1. A complete ordinary operating loop — observe, decide, act — is demonstrable using **only** levels 1 and 2, with no level-3 entry.
2. Every figure shown at levels 1 or 2 is traceable to a persisted event **reachable at level 3**.
3. Level 3 is reachable from every level-1 and level-2 figure, and is never a precondition for an ordinary decision.
4. Level 1 distinguishes completed, failed, and blocked outcomes without opening detail.
5. Level 2 presents all eleven named elements for a mission of any type.

---

## 5. Integration-gate obligations

Recorded so a known-unverified result is never read as a passed one.

### O-1 — Two `apps/api` tests were not verified at the recorded starting point

At `7d7fff6`, the frontend checkpoint was gated in an isolated worktree built from the index, because gating in the main working tree would have exercised the uncommitted remaining frontend rather than the staged content. In that worktree, **two tests in `apps/api/src/execution/dispatchRealRunCli.shell.test.ts` did not execute**: they shell out to `pnpm --filter @foundry/api ac-111:dispatch`, which cannot resolve in a scratch worktree.

**Recorded status: NOT VERIFIED at `7d7fff6`. Not passed, not failed, not waived.**

What is established: `git diff HEAD -- apps/api` in the staged tree returned **zero files**, so `apps/api` was byte-identical to `d4a9bd8` and the checkpoint could not have affected those tests. What is **not** established is that they pass at `7d7fff6`.

**Obligation.** The Package 1 integration gate **must** execute the full `apps/api` suite in a properly provisioned environment and record the actual result. It may **not** carry `7d7fff6`'s partial figure forward, and may not treat the byte-identity argument as a substitute for execution.

**Also recorded:** the gate's full-suite figure at `7d7fff6` was **1493 passed with 2 not executed**. Any later comparison against Package 1a's 1555 must account for both the different environment and these two.

---

## 6. Differences from the 2026-08-04 record

Stated explicitly, because two are corrections rather than additions.

| # | 2026-08-04 | This record |
| --- | --- | --- |
| 1 | "The **seven operational-mission stages**"; summary read "(seven stages)" | **Correction.** They are **lifecycle facets, not a fixed sequence.** Each mission type defines its own stages |
| 2 | — | **Addition.** Mission type is first-class; `nas_inventory` named as a legitimate type with scan-specific stages |
| 3 | Six coverage states "stated as **inclusive**… a floor rather than a closed set" | **Correction.** The six are **required**. No implementation may omit any |
| 4 | Rename scoped to `missionTrace` → `agentTrace` | **Extension.** Adds `MissionTracePanel` → `AgentTracePanel`, and all imports, tests, test IDs, and e2e references |
| 5 | C-4 level 2 enumerated without authority or stages | **Extension.** Level 2 explicitly includes **authority** and **stages/checkpoints** |
| 6 | C-1 forbade reading the pause as abandonment in prose | **Clarification.** "Not abandoned" is now part of the decision text itself |
| 7 | No acceptance criteria | **Addition.** Explicit acceptance criteria for C-1 – C-4 |
| 8 | No integration-gate obligations | **Addition.** § 5, O-1 |

Unchanged: the layer-ownership rule · the prohibition on global coverage claims · the derived-negative rule · three disclosure levels · `operationalMemory` remaining undisposed · C-5 out of scope.

---

## Summary

| # | Decision | Status |
| --- | --- | --- |
| C-1 | V1.1 **PAUSED** — not completed, abandoned, or superseded. `AC-111` open, `AC-112` not started, Package track separately governed | Decided |
| C-2 | Distinct layers. Backend-owned operational mission expressed as **lifecycle facets with per-type stages**; frontend spatial agent trace. Renames authorized, execution deferred | Decided |
| C-3 | Scoped to named source + defined interval; **six required states**; no global "nothing was missed"; negatives derived, never fabricated | Decided |
| C-4 | Three levels; ordinary operation fully usable through 1–2; level 3 auditable but never required for ordinary decisions | Decided |
| C-5 | Buildings as economic objects | **Open** — out of scope through Package 5 |
| O-1 | Two `apps/api` tests unverified at `7d7fff6` | **Obligation on the Package 1 integration gate** |

**Carried open:** `operationalMemory` → `operationalSnapshot` · disposition of the remaining in-flight panels · the coverage-vocabulary conflict, which **blocks Package 2a** · "qualifying external-action event" and interval boundaries · **D-8**.

> **→ Two of these were decided later the same day. See § 7.** `operationalMemory` → `operationalSnapshot` is authorized (§ 7.1) and the coverage vocabulary is resolved as four orthogonal dimensions (§ 7.2), so Package 2a is no longer blocked on vocabulary. The line above is left unedited as the state of the record at ratification. Still open: the remaining in-flight panels · "qualifying external-action event" and interval boundaries · **C-5** · **D-8**.

---

**Companion documents:**
`docs/01-mission/foundry-package-1b-decision-record.md` (2026-08-04, superseded for C-1 – C-4) · `docs/01-mission/foundry-mission-realignment-2026-08-04.md` · `docs/03-architecture/foundry-construction-map.md` · `docs/01-mission/agent-city-v1.1-decision-record.md`

---

# 7. Clarification — 2026-08-05 — `operationalSnapshot` and the coverage vocabulary

**Type:** Append-only clarification
**Date:** 2026-08-05 (later the same day)
**Decided by:** mikemiller1425-design (human operator)
**Resolves:** two items recorded above as *Open — not decided here* — `operationalMemory` → `operationalSnapshot` (§ Decision C-2) and the coverage-vocabulary conflict (§ Decision C-3)

**Nothing above this line is rewritten.** Sections 0 – 6 stand exactly as ratified, including their "Open — not decided here" wording, which was accurate when written. This section is the later ruling; where it resolves an item recorded above as open, **this section governs**. Corrections occur through new records and appended clarifications, never edits.

---

## 7.1 — Ruling C-2.1: `operationalMemory` → `operationalSnapshot`

> **Rename the existing frontend concept:**
> `operationalMemory` → `operationalSnapshot` · `OperationalMemoryPanel` → `OperationalSnapshotPanel` · and the corresponding imports, exports, tests, test IDs, and e2e references.
>
> **Meaning.** `operationalSnapshot` is a **derived, read-only projection of persisted operational events/state at a defined cursor or point in time.**
>
> **It is not:** the Canonical Intent Registry · the Personal Constitution · the Professional Truth Vault · Operational Memory persistence · backend authority · a source of events · a source of permissions · an independent truth store.
>
> **The frontend may render a snapshot but may never author operational truth through it.**
>
> **Precondition.** Before the rename is performed, verify the current module is **purely derived**. If any part persists, mutates, authorizes, or invents operational state, **stop and report that behavior instead of applying the rename.**

**What this settles.** The audit raised this rename twice and the operator's decision text omitted it twice, so it was correctly recorded above as undisposed. It is now decided. The name was the defect: "memory" implies retained state the frontend owns, where the artifact is a projection the backend's event log fully determines. The enumerated negative list exists so a later reader cannot grow this module into one of the named authorities by proximity.

**Precondition check — performed 2026-08-05, read-only, no files modified.**

| Check | Result |
| --- | --- |
| Exports of `lib/runtime/operationalMemory.ts` | `selectEvidenceReferences`, `deriveOperationalSnapshot`, `deriveOperationalComparison` — **all pure functions** over `readonly FoundryEvent[]` |
| Persistence / storage | **None.** No `localStorage`, `sessionStorage`, database, or file access |
| Mutation | **None.** Inputs are `readonly`; every return value is newly constructed |
| Event emission | **None.** No command submission, no event authoring |
| Permission or authority logic | **None** |
| `OperationalMemoryPanel.tsx` | Render-only. Its sole state is a local tab toggle (`view`); no `submitCommand`, no persistence, no fetch |

**The precondition holds.** The module is already purely derived, and — noted because it reduces the rename's risk — its internal vocabulary **already matches the ruling**: the exported type is already `OperationalSnapshot` and the main function is already `deriveOperationalSnapshot`. The stale name survives only in the **file name**, the **panel name**, one local type (`MemoryView`), the test IDs, and the `AppShell` references. This is a naming correction, not a behavioral change.

**Consequences.**
- The rename is **authorized** for the separately authorized frontend reconciliation, limited to the already-audited frontend paths.
- The identifiers still carrying the stale name: `lib/runtime/operationalMemory.ts` + `.test.ts` (file names) · `OperationalMemoryPanel.tsx` + `.test.tsx` · the local `MemoryView` type · test ID `"operational-memory-panel-test"` · two references in `components/shell/AppShell.tsx`.
- The frontend may render a snapshot and may **never** author operational truth through it.
- If a future change would make this module persist, mutate, authorize, or invent state, that is a **new decision**, not an implementation detail.

**Acceptance criteria.**
1. **Zero** occurrences of `operationalMemory`, `OperationalMemory`, or `MemoryView` across source, tests, test IDs, and e2e.
2. Every export remains a pure function of recorded events; no persistence, mutation, emission, or permission logic is introduced.
3. The renamed module produces no state that is not fully determined by the persisted event log.
4. The rename is a rename — no behavior change accompanies it.

---

## 7.2 — Ruling C-3.1: coverage is four orthogonal dimensions, not one enum

> **Do not represent coverage with one overloaded enum. Use orthogonal dimensions.**
>
> **A. Source connection** — `connected` · `unavailable` · `not_connected` · `excluded`
>
> **B. Interval progress** — `not_yet_checked` · `checking` · `partially_checked` · `checked`
> `checked` means the declared source and declared interval were processed according to the recorded scope. **It does not mean the source contains all truth, or that nothing was missed.**
>
> **C. Item disposition** — preserving the Package 1a scan vocabulary where applicable: `scanned` · `skipped` · `refused` · `inaccessible` · `unsupported` · `not_yet_scanned`
>
> **D. Uncertainty** — a **separate quality flag with a reason**, not a replacement for connection or progress: `result_uncertain: true | false`, plus `uncertainty_reason` when true.
>
> **Examples.** A connected source can be `partially_checked`. An unavailable source has no checked interval. A checked source can still contain uncertain results. A source may be excluded deliberately and **must say why**. Individual items can be `inaccessible` even when the source interval is `checked`.
>
> **Plain frontend labels:** Connected · Unavailable · Not connected · Excluded · Not checked yet · Checking · Partially checked · Checked · Result uncertain
>
> **Prohibitions.** No global "nothing was missed" claim · no `external_action.none` event · no `coverage_complete` derived solely from counters · no treating `unavailable`, `excluded`, or `unsupported` as `checked` · **no frontend-authored coverage state.**
>
> **"No external actions occurred"** remains a derived interval statement based on zero qualifying recorded external-action events.

**What this settles.** § Decision C-3 above required six states and recorded the collision with Package 2's five as open and **blocking Package 2a**. This ruling resolves it by rejecting the framing both lists shared: coverage was never one dimension. Source connection, interval progress, item disposition, and uncertainty are independent, and collapsing them is what allowed an unavailable source to render as a clean result.

This **supersedes the single six-state list** in § Decision C-3 as the representation, while preserving every honesty constraint it imposed. Mapping the earlier six: *checked*, *unavailable*, *not connected*, *excluded*, *not yet checked* distribute across dimensions A and B; **uncertain is no longer a state at all** — it is dimension D, a flag that composes with any combination, because a checked source can still yield uncertain results.

It also resolves the defect recorded against the Package 2a draft: `unsupported` is **legitimate**, at dimension C, and its omission of `uncertain` from that list is now **correct**, because uncertainty is not an item disposition.

**Consequences.**
- `coverage_complete` may never be computed from counters alone. This is the same defect Package 1a's own tests caught, where a scan cancelled before examining anything reported complete coverage; the stop reason had to become part of the computation.
- An excluded source **must record why**. Exclusion without a reason is indistinguishable from an omission.
- Coverage state is **backend-derived only**. The frontend renders it and never authors it.
- **Package 2a is no longer blocked on the vocabulary question.** It remains blocked on its own authorization and on an operator decision naming the volume.

**Acceptance criteria.**
1. The four dimensions are independently representable; no single field encodes two of them.
2. A fixture demonstrates each documented example, including `connected` + `partially_checked`, and `checked` + `result_uncertain: true`.
3. `result_uncertain: true` without an `uncertainty_reason` is **unrepresentable or rejected**.
4. An `excluded` source without a recorded reason is **unrepresentable or rejected**.
5. **Zero** global "nothing was missed" claims, and **zero** `external_action.none` events, in vocabulary and in the persisted log.
6. No code path derives `coverage_complete` from counters alone without the stop reason.
7. No frontend path authors or mutates a coverage state.

---

## 7.3 — Scope consequence

> The semantic rename `operationalMemory` → `operationalSnapshot` **is authorized** for Cursor's reconciliation package, limited to the already-audited frontend paths.
>
> **Implementation of the new coverage contracts/events is NOT authorized for Cursor.** It belongs to the later Claude backend-concepts package. Cursor may only **remove misleading existing language** and **preserve honest `unavailable`/`unsupported` states already backed by truth.**

**Consequences.**
- Cursor's authorized surface gains exactly one thing: the `operationalSnapshot` rename.
- Cursor **may not** introduce the four dimensions, add coverage fields or events, or build any coverage contract. Encountering a place that would need one, it **stops and reports**.
- Cursor **may** delete misleading coverage language already present, and **must** leave intact any `unavailable` or `unsupported` state already backed by a recorded truth.
- The coverage contracts land in the later **Claude backend-concepts package**, under its own authorization, at the rung that emits them — the `AC-107` discipline.

---

## 7.4 — Effect on items recorded open above

| Item | Was | Now |
| --- | --- | --- |
| `operationalMemory` → `operationalSnapshot` | Open (§ C-2) | **Decided** — § 7.1. Precondition verified as holding |
| Coverage-vocabulary conflict | Open, blocking Package 2a (§ C-3) | **Decided** — § 7.2. Package 2a no longer blocked on vocabulary |
| Six coverage states as one list | Required set (§ C-3) | **Superseded as representation** by four orthogonal dimensions; every honesty constraint preserved |
| Disposition of the remaining in-flight panels | Open | **Still open** — beyond the `OperationalSnapshotPanel` rename |
| "Qualifying external-action event" · interval boundaries | Open | **Still open** |
| C-5 · D-8 | Open | **Still open** |

---

# 8. Correction — 2026-08-05 — the recorded frontend baseline covered 82 of 83 files

**Type:** Append-only correction
**Date:** 2026-08-05
**Corrects:** the figure "**82 dirty paths under `apps/agent-city`**, manifest digest `e6bedfcc…`" in § 0 *Recorded starting point* above, and the same figure as committed at `ff78bb1`
**Evidence:** `docs/evidence/package-1b/frontend-baseline-manifest-2026-08-05.tsv` · `docs/evidence/package-1b/frontend-baseline-record.md`

**The earlier statement is preserved above, unedited.** It is left exactly as recorded, including the inaccurate count and digest, because that is what the record said. This section is the correction. History is not rewritten.

## 8.1 What was wrong

> **`e6bedfcc4814b1dd16d9521414c8463c1845762b988789543b8b6121e5f213bb` remains reproducible, but it covered only 82 of the 83 dirty frontend files.**

The digest is not corrupt and has not drifted — replayed against its original path list it still produces `e6bedfcc…` exactly. Its **scope** was wrong: one dirty file was never in the set it measured.

## 8.2 Cause

The remaining-frontend set was derived as *(dirty paths before the commit)* **minus** *(every staged path)*. That subtraction is correct only for files staged **in full**.

`apps/agent-city/src/lib/mock-runtime/RuntimeProvider.tsx` was staged **partially** — four of its eight hunks were committed at `7d7fff6` and four were deliberately held back under Decision C-2. It appeared in the staged list, so the subtraction removed it, even though it remained dirty in the working tree. **The defect is in the derivation, not in the repository.**

## 8.3 What did not happen

> **No user drift occurred in the original 82 files.**

Every one of the 82 files the digest did cover is byte-identical to when it was recorded; `e6bedfcc…` reproduces from them today. Nothing was modified, and no reconciliation, rename, or edit took place. The correction adds a file that was always dirty and should always have been counted — it does not report a change to anything.

## 8.4 The omitted file

**`apps/agent-city/src/lib/mock-runtime/RuntimeProvider.tsx`**

**Content SHA-256:** `63aef79c2887901a0e038d1acb4306894758338b069f0c332d90809f2d68fb3e`

Its four retained hunks — the fixture-journey and `runtimeSource` work held back under Decision C-2 — are intact.

## 8.5 The authoritative baseline

> **The pre-reconciliation baseline is now the portable 83-file manifest digest `776d0653ffcfc86415961a94f47e80917662a3a14ba14d9978feb11d6c651b80`.**

83 files — **38 tracked-modified, 45 untracked-new** — persisted in full at `docs/evidence/package-1b/frontend-baseline-manifest-2026-08-05.tsv`, one TAB-separated line per file as `<status>\t<sha256>\t<path>`, sorted lexically by path under `LC_ALL=C`, with no mtimes and no directory placeholders. The exact generation command, the rationale for each property, and the validation results are in `docs/evidence/package-1b/frontend-baseline-record.md`.

`e6bedfcc…` is **superseded as the baseline** and retained only as the historical figure this section corrects.

**Consequence for the reconciliation.** The authorized Package 1b-i reconciliation must **independently reproduce `776d0653…` before making any edit.** A mismatch means the tree is not the audited tree, and it stops rather than proceeding.

## 8.6 Why this is recorded rather than quietly fixed

A fingerprint's purpose is to make silent change detectable. A fingerprint over an incomplete set does that job for the files it covers and says nothing about the rest — while *reading* as though it covered everything. Reported as "all 82 remaining dirty paths byte-identical," it implied a completeness it did not have. Correcting the number without recording why would leave the same failure mode available next time: any partially staged file would silently drop out of the next baseline.

---

# 9. Decisions — 2026-08-05 — external-action qualification and briefing interval

**Type:** Append-only decisions
**Date:** 2026-08-05
**Decided by:** mikemiller1425-design (human operator)
**Starting point:** `f0bb0bb670fc235f5ee8de33623ada491ac42be6` — Package 1b-i complete; `agentTrace` and `operationalSnapshot` are the live names; `apps/agent-city` clean
**Closes:** the two items carried open at § 7.4 — *"qualifying external-action event"* and *interval boundaries*

**Nothing above this line is rewritten.** This section is the later ruling.

## 9.0 Identifier note — read before citing these

The operator's instruction labelled these two decisions **C-5** and **C-6**. **`C-5` is already taken**: `docs/01-mission/foundry-mission-realignment-2026-08-04.md` § 6 records **C-5 — Buildings as economic objects**, still open and out of scope through Package 5. The standing constraint is that identifiers are never reused, renumbered, or re-graded.

They are therefore recorded here as **C-6** and **C-7**, the next free identifiers. **The existing C-5 is untouched.** Only the labels of the new decisions moved; their content is recorded exactly as given. If the operator prefers different identifiers, that is a one-line append — but two different decisions must not share `C-5`.

| Operator's label | Recorded as | Subject |
| --- | --- | --- |
| C-5 | **C-6** | External-action qualification |
| C-6 | **C-7** | Briefing interval and cursor |
| — | C-5 | *(unchanged)* Buildings as economic objects — realignment § 6 |

---

## Decision C-6 — External-action qualification

> **An external action is an attempted or completed side effect outside Foundry's local operational state.**
>
> **Qualifying categories, when actually implemented:** model or remote-agent invocation · email or external message · job/application submission · public publication · external API mutation · production-system mutation · agreement acceptance or signature · payment, purchase, or other spend · another action that changes an external party or system.
>
> **Not external actions:** approval or authorization by itself · planning · dry-run or preflight · local read-only research · local projection/rendering · building selection · internal event replay · preparing an artifact without sending or publishing it.
>
> **Classification mechanism.** Backend-owned, **versioned registry** over persisted event types and required payload predicates. **Closed vocabulary:** a future external action enters the registry only when its owning package implements an actual emitter. Do not add hypothetical external-action events that nothing can emit.
>
> Existing `agentrun.started` with `runtimeType: claude_code` **qualifies** as an external model-invocation attempt. Its related completion/failure event is **another lifecycle phase of the same action**, joined by stable run identity; it must not count as a second action. Approval and `operator.execution_authorized` **do not qualify** — they grant permission without performing the action.
>
> Future email, publication, application, production, agreement, and payment packages must add their real emitted vocabulary and classifier entry **at their owning rung**.
>
> **Required wording for a negative result:**
> *"No qualifying external actions were recorded in Foundry's operational ledger for this briefing interval."*
>
> It may **not** say that no external action occurred everywhere. The claim is limited to Foundry's connected and instrumented ledger. **No `external_action.none` or synthesized absence event is permitted.**

**What this settles.** § Decision C-3 required negatives to be derived from "zero qualifying external-action events" without defining *qualifying* — so the rule could not be implemented without inventing the definition. This closes it, and does so by **enumerated registry rather than by judgement**: an event either has a registry entry or it does not.

The distinguishing rule is **side effect outside Foundry**, not risk or importance. That is why authorization does not qualify however consequential it feels — it changes only Foundry's own state. And the lifecycle rule prevents the most likely dishonesty in the other direction: counting one real run twice because it emitted two events.

The required wording is scoped to *Foundry's operational ledger*. The system cannot observe actions taken outside its instrumentation, so it may not speak about them.

**Consequences.**
- The registry is **versioned**: a briefing must be able to state which classifier version produced its result.
- The closed vocabulary binds forward — every future package adds its own emitter and entry together, at the rung that emits. This is the `AC-107` discipline: *an event nothing can emit is a claim the system does not honour.*
- The one real Claude Code run to date classifies as **exactly one** external action.
- A negative statement is a derived read over an interval, never a stored event.

**Acceptance criteria.** Proofs 11–14 of the 1b-ii gate in `docs/03-architecture/foundry-construction-map.md`.

---

## Decision C-7 — Briefing interval and cursor

> **Briefing intervals are based on persisted event sequence numbers, not wall-clock timestamps.**
>
> The interval is `(previousAcknowledgedSequence, capturedEndSequence]` — **start exclusive, end inclusive.** The first briefing begins after sequence 0.
>
> `capturedEndSequence` is **captured once**, when the briefing record is created. Rendering, reopening, refreshing, or regenerating the same briefing **does not change its interval**.
>
> The previous cursor advances **only** through an authenticated operator acknowledgement that the briefing was reviewed. **Merely generating or viewing a briefing does not advance the cursor.** Events recorded after the captured end belong to the next briefing.
>
> Timestamps are for **display and diagnostics, not membership**. Two honest readers of one briefing record must derive the **same event population**. Empty intervals are valid and explicit. Cursor advancement is **append-only** and cannot move backward or skip beyond the acknowledged briefing's captured end.

**What this settles.** § 7.2 left the interval boundary rule open, noting that two honest renderings of one interval must not disagree. Sequence numbers close it: wall-clock time is not a reliable membership key across clock skew, backfill, or equal timestamps, and an interval defined by time could silently include or drop an event on re-render.

`capturedEndSequence` being fixed at creation is what makes a briefing a **record** rather than a live query. A live query would change its own answer every time it was opened.

The half-open form `(previous, captured]` guarantees **exactly-once** membership: no event falls in two briefings, and none falls between them.

Separating *viewing* from *acknowledging* is the honesty constraint. If viewing advanced the cursor, opening a briefing would silently discard events the operator never read.

**Consequences.**
- A briefing record must persist both bounds; neither is recomputed at read time.
- Acknowledgement is authenticated, idempotent, and append-only. Duplicate and concurrent acknowledgements advance the cursor **once**.
- The cursor never moves backward and never skips past the acknowledged briefing's captured end.
- An empty interval is a valid, explicitly-stated result — not an error and not a gap.
- Timestamps may be displayed but may never determine membership.

**Acceptance criteria.** Proofs 7–10 of the 1b-ii gate.

---

## 9.1 Package sequencing amendment

Recorded in `docs/03-architecture/foundry-construction-map.md`. Package 1b becomes four numbered slots:

| Slot | What | State |
| --- | --- | --- |
| **1b-i** | Frontend reconciliation | ✅ Complete at `f0bb0bb` |
| **1b-ii** | Command Center Operational Truth — backend contracts, commands, events, projections, tests | Not authorized |
| **1b-iii** | Command Center Frontend — Cursor, against 1b-ii truth | Not authorized |
| **1b-iv** | Integration verification and operator observation | Not authorized |

**Package 1 remains open until 1b-iv is observed and approved.** The 27 proofs for 1b-ii, and the gates for 1b-iii and 1b-iv, are recorded in the construction map.

## 9.2 This documentation authorizes no implementation

> **This section, the construction-map amendment, and the acceptance gates are governance only. They do not authorize Package 1b-ii implementation.**

Creating a numbered slot and writing its gate is not the same as authorizing the work in it. 1b-ii, 1b-iii, and 1b-iv each still require their own **explicit operator authorization** before any code is written — the standing rule that no package begins without one. No contract, event, command, read model, or UI was created by this record.

## 9.3 Items still open after this section

`C-5` buildings as economic objects · disposition of the remaining in-flight panels · **D-8** · whether the V1.1 ladder and the Package track reconcile (**C-1** decided the pause, not the reconciliation).

---

# 10. Decisions — 2026-08-05 — Package 1b-ii-a sequencing, raw entities, authentication, and vocabulary negotiation

**Type:** Append-only decisions
**Date:** 2026-08-05
**Decided by:** mikemiller1425-design (human operator)
**Occasion:** a read-only post-completion seam audit of `e895d743da0aac4394ec849e74e3edb3ffd20d75`

**Nothing above this line is rewritten.** This section records five rulings and authorizes no implementation.

## 10.1 — Package 1b-ii completed

> **Package 1b-ii — Command Center Operational Truth — completed and was pushed at `e895d743da0aac4394ec849e74e3edb3ffd20d75`.**

Eight backend surfaces, all 27 acceptance proofs demonstrated, 1603 tests passing, Obligation **O-1 discharged** (all 18 `dispatchRealRunCli.shell.test.ts` tests executed in a provisioned environment), and the `apps/agent-city` tree object byte-identical at `06dbb4c9`.

The construction map's slot table is corrected to show this. Its earlier sentence "1b-i and 1b-ii still require their own authorization" is **preserved unedited** with a historical marker, because it was true when written.

## 10.2 — Package 1b-ii-a: Command Center Read Transport

> **A new slot is added between 1b-ii and 1b-iii: Package 1b-ii-a — Command Center Read Transport.** 1b-iii's dependency moves from 1b-ii to **1b-ii-a committed and pushed**.

**What this settles.** The seam audit established that 1b-ii's eight surfaces are reachable from no HTTP route, and that both event transports filter through `isV1Event`, so the three Command Center events cannot reach any client. Since 1b-iii may not invent mission, coverage, decision, external-action, monetary, autonomy, recommendation, cursor, or urgency truth — and `apps/agent-city` does not depend on `@foundry/persistence` — it had no non-inventing source for eight of its nine forbidden categories.

The remedy is a transport, not more truth. 1b-ii-a moves data that already exists; it derives none.

**Consequences.**
- 1b-ii-a is **not authorized by this record** and requires its own explicit authorization.
- It may add **no** new event, command, entity type, or domain truth, and may not change 1b-ii projection logic.
- A field that appears to need new derivation in `apps/api` is new domain truth: the package stops and reports rather than computing it.

## 10.3 — Raw entity reads are Level-3 evidence, not the frontend contract

> **`GET /entities/briefings` and `GET /entities/decisionBatchPolicies` remain available intentionally, as Level-3 evidence surfaces, consistent with the existing entity ledger.**
>
> **They are not the Command Center frontend contract.** Package 1b-iii must consume the schema-validated aggregate snapshot and the versioned event transport, **never raw entity shapes.**

**What this settles.** The audit found these reachable because `reducer.ts` registered the two entity types and `/entities/:type` accepts any registered type. That is now a ruling rather than an accident: every other entity is readable the same way, and Decision C-4 requires complete inspectability at level 3.

The boundary is between *inspectability* and *contract*. A raw entity is persistence's internal shape; building a UI on it would couple the frontend to a representation nothing promises to keep stable, and would bypass the schema validation the snapshot endpoint exists to provide.

**Consequences.**
- Raw entity reads stay, unrestricted, on the same footing as every other entity type.
- 1b-iii consuming a raw entity shape is a **gate failure**, not a style preference.
- The snapshot endpoint is the only Command Center read contract.

## 10.4 — Authentication: unauthenticated now, explicitly provisional

> **For the current local/trusted V1 deployment, `GET /command-center` remains unauthenticated, consistent with `world-state`, `entities`, `events`, and the event stream.**
>
> **This is not a permanent multi-user security ruling.** Authentication and tenant isolation must be reconsidered before LAN or public exposure, multi-user operation, tenant rentals, investor access, or any surface containing another tenant's data.

**What this settles.** Every existing read surface is unauthenticated; `principals` is passed only to write paths. A new endpoint quietly adopting a stronger policy would have created two inconsistent read postures without anyone deciding to, and one quietly adopting a weaker one would have been worse. The ruling makes the existing posture explicit and names its expiry conditions.

**Consequences.**
- 1b-ii-a implements no read authentication and invents no authority policy.
- The five named conditions are **triggers, not suggestions**: each requires this ruling to be revisited before that exposure exists.
- A future package that adds any of them without revisiting authentication is in violation of this record.

## 10.5 — Event vocabulary negotiation

> - **absent parameter** — frozen V1 behavior;
> - **`vocabulary=command-center-v1`** — V1 plus accepted Command Center events;
> - **every unknown vocabulary value** — explicit `400` refusal;
> - **never silently fall back** from an unknown value.

**What this settles.** The default must stay frozen because the reconciled frontend treats a contract-invalid frame as a possible gap in canonical history and closes the stream rather than degrading — a widened default would break 1b-i on contact.

Silent fallback is prohibited for the same reason a fabricated `external_action.none` is: a client that asked for a vocabulary and quietly received a narrower one would believe it had seen everything. **A refusal is honest; a downgrade is a false claim about coverage.**

**Consequences.**
- The parameter is opt-in and explicit; absence is not a version.
- An unknown value is a `400` naming the supported values — never a 200 carrying less than was asked for.
- Adding a future vocabulary means adding a value, never changing what an existing one returns.

## 10.6 — This record authorizes no implementation

> **Sections 10.1–10.5, the construction-map amendment, and the 1b-ii-a acceptance gate are governance only.**

Package 1b-ii-a, 1b-iii, and 1b-iv each still require their own explicit operator authorization. No contract, endpoint, event, or transport was created here.

---

# 11. Standing governance rule — 2026-08-05 — dual checklists

> **⚠ SUPERSEDED — see § 12.** This section recorded a standing governance rule
> that the operator did not intend to create. The two-checklist format is a
> **conversational protocol between the operator and Codex**, not a Foundry
> architectural requirement, package-governance rule, obligation on Claude or
> Cursor, or acceptance criterion. **No package-level dual-checklist
> requirement exists.** This section is preserved unedited below as historical
> evidence of what was recorded; § 12 governs.

**Type:** Append-only standing rule
**Date:** 2026-08-05
**Decided by:** mikemiller1425-design (human operator)
**Applies from:** Package 1b-ii-a onward

**Nothing above this line is rewritten.**

> Every package maintains and reports **two synchronized checklists**, and every operator item cross-references its engineering proof.
>
> **A — Engineering execution checklist.** Per requirement: identifier · implementation status · exact files and symbols · technical evidence · the relevant test or verification command · exclusions or unresolved dependencies.
>
> **B — Operator understanding checklist.** In concise plain English: what useful capability the item adds · what Foundry could do before · what it can do afterward · whether anything visibly changes · what remains unavailable, `not_recorded`, `not_available`, or `not_connected` · what is deliberately excluded · exact steps the operator can perform to verify it themselves · any remaining drift risk.
>
> **Statuses:** `PROPOSED` · `AUTHORIZED` · `IMPLEMENTED` · `TECHNICALLY VERIFIED` · `OPERATOR OBSERVATION REQUIRED` · `OPERATOR ACCEPTED` · `DEFERRED` · `BLOCKED`.
>
> **Only the operator may mark an item `OPERATOR OBSERVED` or `OPERATOR ACCEPTED`.**

**What this settles.** Package reporting had been engineering-shaped: proofs, gate results, test counts. That is necessary and it is not sufficient. A passing suite demonstrates that the code agrees with its own tests; it does not tell the person who has to operate the system what changed, what is now visible, what is still missing, or how to check any of it without reading the diff.

The second list is not a summary of the first. It answers different questions, and the cross-reference requirement is what keeps it honest — a plain-English claim with no engineering proof behind it is exactly the kind of statement this project has repeatedly had to correct.

**Consequences.**
- Both checklists are reported at package completion, not on request.
- Every operator item names the engineering item that proves it.
- A package may mark its own work `IMPLEMENTED` and `TECHNICALLY VERIFIED`. It may **never** mark it `OPERATOR OBSERVED` or `OPERATOR ACCEPTED`; doing so misreports the record.
- `DEFERRED` and `BLOCKED` are first-class outcomes and are reported as plainly as completion.
- Completion reporting separates: genuinely implemented and verified · technically present but not yet visible · requiring operator observation · unavailable or historically unrecorded · remaining work · exact personal verification commands with expected results.

---

# 12. Correction — 2026-08-05 — § 11 recorded a rule the operator did not intend

**Type:** Append-only correction
**Date:** 2026-08-05
**Decided by:** mikemiller1425-design (human operator)
**Corrects:** § 11 of this record, and the corresponding section of `docs/03-architecture/foundry-construction-map.md`

**§ 11 is preserved unedited above**, with a superseded marker. It is the record of what was written; this section is the record of what was meant.

## 12.1 What was misunderstood

> **The engineering-coordination checklist and the plain-English understanding checklist are a conversational protocol between Michael and Codex.**
>
> They were **not** intended to become: a Foundry architectural requirement · a standing package-governance rule · an obligation imposed on Claude or Cursor · part of Package 1b-ii-a's acceptance criteria.

A working habit between two participants was read as a durable rule and written into governance. That is a category error, and the reason it matters is that governance records are consulted later by readers who were not present: a future package would have found a standing obligation with no operator behind it, and satisfied it in good faith.

## 12.2 The operative rule

> **No package-level dual-checklist requirement exists.**

No package is obliged to produce an engineering-execution checklist, an operator-understanding checklist, or the `PROPOSED`/`AUTHORIZED`/`IMPLEMENTED`/… status vocabulary. A package that omits them is complete. A package that includes them has added nothing to its acceptance criteria by doing so.

**What is unchanged**, because it never depended on § 11:
- A package still reports what it delivered, what it did not, what remains absent or unrecorded, and how the operator can verify it. That obligation comes from each package's acceptance gate.
- **An assistant still may not declare the operator's acceptance.** That comes from the acceptance gates in the construction map and from principle 14 — humans govern — not from the withdrawn rule.

## 12.3 Effect on Package 1b-ii-a

> **The Package 1b-ii-a technical implementation remains accepted for observation.** Its contracts, endpoint, event transport, tests, and other implementation are not reverted or modified.

Package 1b-ii-a's acceptance gate is, and always was, the **12 proofs** recorded in the construction map. The dual-checklist item reported as **`E-13`** was never part of that gate; it is **withdrawn from the operative completion requirements**.

**Proofs `E-1` through `E-12` are undisturbed**, as is the 12-proof gate itself. No contract, endpoint, transport, or test changes as a result of this correction — this is a documentation correction and touched no implementation path.

## 12.4 Why this is corrected by appending

§ 11 could have been deleted, and the record would then have shown a rule that never existed rather than one that was withdrawn. Foundry corrects by appending — Decision 4 of the V1.1 decision record, and principle 18 — because the useful fact is not only what the rule is now, but that it was briefly something else and why it changed.

---

# 13. Operator acceptance — 2026-08-05 — Package 1b-ii-a

> **⚠ ATTRIBUTION PREMATURE — see § 14.** This section was written and committed
> at `db060aa` **before the operator had explicitly given acceptance**. The five
> observations it records were genuinely performed by the operator; the
> acceptance attributed here was not yet explicitly given, and **observation is
> not acceptance**. The section is preserved unedited below as historical
> evidence of what was recorded. **§ 14 carries the operator's actual explicit
> acceptance and governs.** Nothing here may be relied on as the moment of
> acceptance.

**Type:** Append-only operator acceptance
**Date:** 2026-08-05
**Accepted by:** mikemiller1425-design (human operator)
**Package:** 1b-ii-a — Command Center Read Transport
**Implementation:** `7837212c486b113fc5854c10d53042b4b7046a9a`

> **I personally observed Package 1b-ii-a. I accept Package 1b-ii-a.**
>
> **This acceptance authorizes no downstream work.**

## 13.1 What the operator personally observed

Recorded as observed by the operator, not as re-asserted by an assistant:

1. `GET /command-center` returns the `command-center-v1` snapshot.
2. Recorded authority and budget facts carry evidence.
3. Missing historical information is identified as `not_recorded`.
4. An unknown event vocabulary is explicitly refused with **HTTP 400**.
5. **Ten repeated snapshot reads left the operational ledger unchanged at 135 events.**

Item 5 is the one worth naming separately. It is the observation that a read is genuinely a read — the property the whole package rests on, and the one that could not be established by reading code, only by doing it and looking at the ledger afterwards.

## 13.2 Standing

Package 1b-ii-a is **operator-accepted**. Its 12 proofs, its implementation at `7837212`, and its acceptance are now all on the record.

**Nothing downstream is authorized.** Package 1b-iii, Package 2, `AC-112`, `AC-111` closure, and Package 1 closure each still require their own explicit operator authorization, and this acceptance grants none of them. **Package 1 remains open**; it closes only after 1b-iv is observed and approved.

Recorded here because acceptance is the operator's decision and only the operator can create it — § 12 withdrew a rule that said so as a governance requirement, but the constraint itself comes from the construction map's acceptance gates and from principle 14: humans govern.

---

# 14. Correction and explicit acceptance — 2026-08-05 — Package 1b-ii-a

**Type:** Append-only correction and operator acceptance
**Date:** 2026-08-05
**Accepted by:** mikemiller1425-design (human operator)
**Package:** 1b-ii-a — Command Center Read Transport
**Implementation:** `7837212c486b113fc5854c10d53042b4b7046a9a`
**Corrects the attribution in:** § 13 of this record, committed at `db060aa`

**§ 13 is preserved unedited above**, with a premature-attribution marker. It records what was written; this section records the operator's ruling on what actually happened.

## 14.1 The sequence, as the operator records it

> - **Commit `db060aa` recorded my acceptance prematurely, before I explicitly gave it.**
> - **I had personally completed the five observations, but observation was not acceptance.**
> - **After the premature record was identified, Codex asked me directly whether I explicitly accepted Package 1b-ii-a or wanted acceptance to remain pending.**
> - **I replied "yes." That subsequent reply is my actual explicit acceptance.**
> - **Package 1b-ii-a is therefore operator-accepted now, but not because Claude inferred acceptance from my observations.**

## 14.2 The distinction being preserved

**Observation is not acceptance.** They are different acts by the same person, and the gap between them is where the operator decides. An assistant that treats a completed observation as an acceptance has removed that decision by assuming its outcome — and has done so in the one record whose purpose is to show who decided what.

The five observations at § 13.1 stand: they were genuinely performed. What did not exist at `db060aa` was the operator's explicit acceptance. Recording it there converted "the operator looked and the results were correct" into "the operator accepted," which is a claim only the operator can make.

This is the same defect class the record already carries twice: § 8, where a fingerprint implied a completeness it did not have, and § 12, where a conversational habit was written up as a standing rule. In each case the artifact read as more authoritative than the fact behind it.

## 14.3 Standing

**Package 1b-ii-a is operator-accepted**, on the strength of the operator's explicit reply described at § 14.1 — **not** on any inference from the observations.

`db060aa` is **preserved as historical evidence** and is not reverted. Its attribution is marked premature at § 13; its content is otherwise accurate.

**This acceptance authorizes no downstream work.** Package 1b-iii, Package 2, `AC-112`, `AC-111` closure, and Package 1 closure each still require their own explicit operator authorization. **Package 1 remains open** and closes only after 1b-iv is observed and approved.

---

# 15. Decision — 2026-08-06 — operational-ledger baseline; raw file hashes retired

**Type:** Append-only decision
**Date:** 2026-08-06
**Decided by:** mikemiller1425-design (human operator)
**Evidence:** `docs/evidence/package-1b/operational-ledger-baseline-2026-08-06.md`

**Nothing above this line is rewritten.**

## 15.1 Option A adopted

> **The change from raw file hash `8dd834d7…` to `258658…` is a physical-only SQLite rewrite. A portable logical baseline is adopted append-only.**

## 15.2 Equality with the former file is permanently unverifiable

> **Logical equality between the former `8dd834d7…` file and the current `258658…` file cannot be established, and no future work can establish it.**

No row-level artifact of the former file was ever created — no tracked copy, no manifest, nothing beyond its raw hash in prose. Identical counts, contiguous sequences 1–135, zero duplicates, and a passing integrity check are **consistent with** equality and prove none of it; a substituted or edited ledger of the same shape would present identically.

The word is **unverifiable**, not *unlikely*. Recording it as "confirmed unchanged" would repeat the error being corrected.

## 15.3 No mutation indicator was found

> **The audit found no indicator of logical mutation.**

No sequence gap · no duplicate event id · no schema drift (cookie 4) · no corruption · no freelist churn · no hot journal · no count change · clean close with no `-wal`/`-shm` sidecars. The file's mtime corresponds to the operator restarting Foundry for the Package 1b-ii-a observation, before Package 1b-iii began.

## 15.4 Raw SQLite file hashes are retired as logical-ledger gates

> **A raw SHA-256 of `foundry.sqlite` may no longer be cited as evidence that the ledger is unchanged.**

`PersistenceService` opens the database in WAL mode. **Open** creates `-wal`/`-shm`; **close** checkpoints those pages back into the main file and increments the file change counter — a header field defined to change on write. An ordinary start-and-stop therefore produces different bytes for an identical ledger.

The gate was measuring the container while claiming to measure the ledger. Those are different facts, and only the second is a Foundry invariant.

**Consequences.**
- Every future package proves ledger nonmutation with the **logical manifest digest**, not a file hash.
- Historical records citing `8dd834d7…` are **not rewritten**. They recorded what was measured; § 15 records what it meant.
- Counts remain useful as a cheap check and are **never** sufficient on their own — "135 events" is not row equality.

## 15.5 Open — the v2 method is not on record

The operator designated **`FOUNDRY-LOGICAL-MANIFEST-v2` digest `768293606db3b3a08e7fd2d3e3ea44fad88d12c69e5866fd86f030201ab97862`** as the authoritative baseline.

**That digest could not be reproduced during this audit**, and the v2 generation method appears nowhere in the repository. Six candidate reconstructions were computed against a byte-identical copy and none matched.

**A baseline nobody can regenerate is not a gate** — it is a number that reads authoritative with nothing behind it, which is this record's recurring defect one layer up. The digest is recorded as designated and **marked not-yet-reproducible** rather than presented as verified.

**Obligation.** Before `768293…` gates any package, the **v2 method must be recorded** in reproducible form and the digest regenerated from the live ledger to confirm it. Until then, `FOUNDRY-LOGICAL-MANIFEST-v1` digest `0a6c4d348c8da88c45191593b2e02eac4cab05745a6369e46098677a78464f92` — reproduced twice during the audit — is the only digest in this record with a method behind it.

§§ 15.1–15.4 are decided and none of them depends on which logical digest is authoritative.

---

# 16. Correction — 2026-08-06 — V2 reproduced, V1 rejected, § 15.5 closed

**Type:** Append-only correction
**Date:** 2026-08-06
**Decided by:** mikemiller1425-design (human operator)
**Corrects:** § 15.5 of this record
**Evidence:** `docs/evidence/package-1b/operational-ledger-baseline-2026-08-06.md` § 6 · generator at `docs/evidence/package-1b/generate-manifest-v2.sh`

**Nothing above this line is rewritten.** § 15.5 recorded a reproducibility obligation; this section discharges it.

## 16.1 § 15.5 is closed — V2 reproduced exactly

The operator supplied the `FOUNDRY-LOGICAL-MANIFEST-v2` generator. Run against the stopped, sidecar-free operational database through an immutable read-only URI:

| Required | Observed |
| --- | --- |
| 183 lines | **183** |
| `768293606db3b3a08e7fd2d3e3ea44fad88d12c69e5866fd86f030201ab97862` | **exact match** |

Re-verified from the generator's committed location. The live file stayed at `258658…` with **zero sidecars created**.

## 16.2 V1 is rejected, not merely superseded

> **`FOUNDRY-LOGICAL-MANIFEST-v1` digest `0a6c4d348c8da88c45191593b2e02eac4cab05745a6369e46098677a78464f92` is rejected as an invalid method and is not an eligible ledger gate.**

Four defects, all confirmed empirically:

1. **NULL and empty string were indistinguishable.** `hex(NULL)` returns `''`, not NULL, so the `coalesce(..., '~NULL~')` sentinel **never fired**. This was live, not theoretical: **all 135 events carry `causation_id` NULL**, so every event row was hashed with a NULL silently encoded as empty.
2. **Schema SQL was not encoded**, so newlines inside DDL made record boundaries ambiguous — the delimiter appeared inside the data.
3. **`sqlite_sequence` was omitted.** It holds `events = 135` and controls the next persisted event sequence; a baseline that ignores where the ledger continues from is incomplete.
4. **The 205-line count was misleading** — 22 of those lines came from multiline schema SQL, not from records.

V1 was proposed in this record one section earlier, with a stated rationale that claimed exactly the property defect 1 destroys. **That it reproduced twice is worth noting precisely because reproducibility is not correctness**: a method can be perfectly deterministic and still hash the wrong thing. The rejection is recorded rather than the method quietly replaced, because the failure mode — an artifact reading as more authoritative than the fact behind it — is the same one §§ 8, 12, and 15 each corrected.

## 16.3 Authoritative baseline

> **`FOUNDRY-LOGICAL-MANIFEST-v2`**
> **`768293606db3b3a08e7fd2d3e3ea44fad88d12c69e5866fd86f030201ab97862`**
> 183 records · `apps/api/data/foundry.sqlite` · 2026-08-06

Every future package proves ledger nonmutation with this digest, regenerated by `docs/evidence/package-1b/generate-manifest-v2.sh`. Raw SQLite file hashes remain retired (§ 15.4). Row data remains uncommitted (Decision 4).

`61d28ea` is **preserved and not amended**; its § 15.5 obligation is discharged here.

---

# 17. Operator acceptance and Package 1 closure — 2026-08-06 — Packages 1b-iii and 1b-iv

**Type:** Append-only decision
**Date:** 2026-08-06
**Decided by:** mikemiller1425-design (human operator)
**Evidence:** `docs/evidence/package-1b-iii/`; `docs/evidence/package-1b/operational-ledger-baseline-2026-08-06.md`

**Nothing above this line is rewritten.** § 13 and § 14 keep their statements about
Package 1b-ii-a exactly as recorded, including § 13's premature attribution and
§ 14's correction of it. This section adds; it does not revise.

## 17.1 Completion record

| Slot | Commit | Note |
| --- | --- | --- |
| **1b-iii** — Command Center Frontend | `da66a18` | Hardening at `9534c21` |
| **1b-iv** — Integration verification | `3347322` | Six integration-seam repairs |

## 17.2 Operator observation and acceptance

> **I personally observed all eleven Package 1b-iv requirements in the running
> application, including progressive disclosure, evidence access, the existing
> World/Map/Operate modes, refresh behaviour, and the narrow layout. I explicitly
> accept Package 1b-iv.**

The distinction § 14.2 draws is preserved here deliberately: **observation is not
acceptance**, and the two are recorded as separate acts. The operator observed,
and then said so. Acceptance is written here because the operator stated it — not
inferred from passing gates, screenshots, silence, or the application having been
opened.

## 17.3 What 1b-iv repaired

Verification found six defects, every one a labelling or mapping fault in
`apps/agent-city` over truth the accepted contracts already supplied. None
required a new contract, event, field, projection, authority, or behaviour;
`apps/api` and `packages/persistence` are byte-identical across `5bb5ee4..3347322`.

1. **An absent spend record rendered as a recorded zero.** `sumStatus(outcome,
   "spent")` returns 0 both when records sum to nothing and when no record exists,
   so the world glance asserted "USD 0.00" while the mission directly below it
   read `spendUsd: not_recorded`. Visible against the live operational data. This
   is the § 7.2 collapse in monetary form — an unknown presented as a fact — and
   the `received` side had already refused it via `hasNoReceivedRevenue`.
2. **A snapshot-level external-action count labelled "(mission interval)."** The
   figure is the projection over its own `(fromSequenceExclusive,
   toSequenceInclusive]`; no per-mission external-action projection exists in the
   accepted contract.
3. **The same count unscoped at level 1**, reading as "this is everything."
4. **A configured decision batch reported only "Enabled: yes,"** withholding the
   cadence, local time, timezone, and next expected batch the policy already
   carries. The backend-owned immediate-interruption categories — 1b-ii proof 6's
   visibility requirement — were rendered nowhere.
5. **A recorded `stopReason` was absent from the level-1 coverage line**, so a
   scan stopped early could read as "Connected, Checked." This is the precise
   defect § 7.2's consequences list names: completeness may never be derived from
   counters without the stop reason.
6. **A lost backend was explained as a snapshot catching up.** The `stale` status
   was honest; its explanation was not. Observed live by stopping the API.

## 17.4 Package 1 closure

> **Package 1 is closed.** Its final construction-map gate — the operator
> personally observing the eleven 1b-iv requirements — is **satisfied, not waived**.

**Closure advances no `AC-*` rung.** It is a Package-track ruling, and Decision
C-1's separation of the two tracks is unchanged.

- `AC-103` remains **not started** and must still close before `AC-111` (D-9,
  `docs/01-mission/agent-city-v1.1-decision-record.md`). The "AC-103" comments in
  frontend source refer to `AC-103P`, the pre-ladder proof, which closes no rung.
- `AC-111` remains **open**.
- `AC-112` remains **not started**.
- **Package 2 remains unauthorized** and still requires an operator decision
  naming the volume Foundry may index.

## 17.5 Ledger standing

The authoritative operational-ledger baseline is unchanged by this closure:
`FOUNDRY-LOGICAL-MANIFEST-v2`, 183 records,
`768293606db3b3a08e7fd2d3e3ea44fad88d12c69e5866fd86f030201ab97862`, with no
WAL/SHM sidecars. Package 1b-iv was verified against an operational-data
observation copy; the operational database was never started against.
