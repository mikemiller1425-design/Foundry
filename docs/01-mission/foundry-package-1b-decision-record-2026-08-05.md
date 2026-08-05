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
