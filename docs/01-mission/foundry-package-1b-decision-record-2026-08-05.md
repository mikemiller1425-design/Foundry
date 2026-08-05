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

---

**Companion documents:**
`docs/01-mission/foundry-package-1b-decision-record.md` (2026-08-04, superseded for C-1 – C-4) · `docs/01-mission/foundry-mission-realignment-2026-08-04.md` · `docs/03-architecture/foundry-construction-map.md` · `docs/01-mission/agent-city-v1.1-decision-record.md`
