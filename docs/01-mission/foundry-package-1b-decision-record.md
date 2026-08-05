# Foundry Package 1b — Operator Decision Record

**Type:** Authoritative decision record
**Date:** 2026-08-04
**Package:** Construction Package 1b (frontend reconciliation, then the Command Center)
**Decided by:** mikemiller1425-design (human operator)
**Resolves:** `docs/01-mission/foundry-mission-realignment-2026-08-04.md` § 6 — conflicts **C-1**, **C-2**, **C-3**, **C-4**

---

## 0. Standing

This is the **single authoritative record of the operator decisions that unblock Construction Package 1b.** Four conflicts are decided here. **C-5** (buildings as economic objects) is **not** decided here and remains out of scope through Package 5, exactly as recorded.

The realignment record's § 6 remains in place, unedited, as the historical statement of the conflicts. Where it describes a conflict as unresolved and this record decides it, **this record governs**. Corrections occur through new records, never edits — Decision 4 of `docs/01-mission/agent-city-v1.1-decision-record.md`, and Foundry principle 18.

**Nothing in this record is implemented.** It authorizes no code, no rename, no contract, and no commit beyond itself. Package 1b still requires its own explicit authorization before any implementation begins.

### How to read authority in this document

| Marking | Meaning |
| --- | --- |
| Blockquote under **Decision** | **Operator-confirmed.** Recorded as given |
| **What this settles** / **Consequences** | **Operator-confirmed.** Direct entailments of the decision text |
| **(proposal)** | **Assistant-authored implementation suggestion.** No operator authority. May be corrected or discarded without amending this record |
| **Open — not decided here** | Raised and recorded so it is not mistaken for settled |

This record amends no Foundry principle, domain term, or ADR. It promotes nothing from `docs/04-future/registry.md`. It reopens no `FBL-*` or `AC-1xx` rung.

---

## Decision C-1 — Status of the V1.1 mission

> **V1.1 is PAUSED. Not completed, and not superseded.**
>
> `AC-111` remains open as a historical governed-execution milestone. `AC-112` is not started. Mission-realignment Packages 1a and later proceed as a separate, explicitly governed track until a future operator decision reconciles them with the V1.1 ladder.
>
> **This pause may not be reinterpreted as abandonment, closure, or permission to bypass an existing obligation.**

**Sources:** realignment § 6 C-1; construction map § "Relationship to the V1.1 ladder".

**What this settles.** The realignment offered three readings — V1.1 completes, pauses, or is superseded — and decided none. **Pause is selected**, and the decision is narrower than the word alone would imply: the ladder's open obligations survive the pause intact. A paused ladder is not a closed one.

**Consequences.**
- `AC-111` is **open**, not closed and not closable as a side effect of any Package. Its status is a historical governed-execution milestone: the run happened and succeeded; the rung is not thereby complete.
- `AC-112` is **not started** and is not started by Package work.
- `AC-103`'s standing obligation is unchanged — it must close before `AC-111`, per Decision 5 of the V1.1 decision record. The pause does not lift it.
- The Package track (1a → 5) and the V1.1 ladder are **two explicitly governed tracks**, not one renumbered track. Package work does not advance `AC-*` rungs and `AC-*` rungs do not advance Packages.
- Identifiers remain never reused, renumbered, or re-graded across both tracks.
- Reconciling the two tracks requires a **future operator decision**. Until it exists, no document may present the Package track as the successor to V1.1.
- **Prohibited:** treating the pause as abandonment or closure; using it to bypass an obligation the ladder already imposes; closing `AC-111` or starting `AC-112` under Package authority.
- **D-8** (disposition of `e5378aa`) remains **OPEN** and is unaffected. It resolves at `AC-117`.

---

## Decision C-2 — The mission model

> **Operational mission and spatial agent trace are distinct layers.**
>
> The **backend-owned operational mission** represents:
> briefing → loadout and authority → launch → checkpoints and progress → exceptions and decisions → outcome → evidence-backed debrief.
>
> The **frontend spatial agent trace** represents travel legs, arrivals, work location, returns, and other event-supported movement underneath an operational mission.
>
> Rename the existing `missionTrace` concept to `agentTrace` **only during the separately authorized frontend reconciliation. Do not perform the rename in this decision-record task.**

**Sources:** realignment § 6 C-2; construction map § "Package 1b".

**What this settles.** The realignment recorded two candidate models in the working tree and refused to choose between them. This decision chooses **neither wholesale** — it separates them into two layers with different owners, which no source document offered as an option.

The distinguishing rule is **ownership, not vocabulary**: the operational mission is backend-owned, and the spatial trace is a frontend rendering of event-supported movement *underneath* it. The word "mission" belongs to the backend layer. That is why the existing frontend `missionTrace` is misnamed, and why renaming it is a correction rather than a preference.

**Consequences.**
- The seven operational-mission stages are **backend concepts**. The frontend does not own them.
- The spatial agent trace is constrained to **event-supported movement**. Movement not supported by a recorded event may not be rendered — the standing constraint *"no visual progress without a recorded event."*
- The `missionTrace` → `agentTrace` rename is **authorized in principle and deferred in execution.** It happens during the separately authorized frontend reconciliation, and **not** in the task that produced this record.
- Neither layer may be implemented under this record. Package 1b implementation requires its own authorization.

**Open — not decided here.**
- **The `operationalMemory` → `operationalSnapshot` rename.** Raised in the preceding audit and **not included in the operator's decision text.** `lib/runtime/operationalMemory.ts` is named in realignment § 6 C-2 as an undecided candidate and is referenced by four files. It therefore remains **undisposed**, and the frontend reconciliation has no authority over it until the operator rules. *(proposal: adopt the rename — "memory" implies retained state the backend does not own, where the artifact is a point-in-time projection. Assistant-authored; not operator intent.)*
- The five in-flight panels named in realignment § 6 C-2 (mission trace, operational memory, agent life, runtime readiness, world atlas) are **not individually disposed** by this record beyond the layer separation above.

**(proposal) Implementation notes — assistant-authored, no operator authority.**
- Each of the seven stages should enter the closed event/command vocabulary **at the rung that emits it**, per the `AC-107` discipline recorded in the construction map: *an event nothing can emit is a claim the system does not honour.* Stages present only as display fields would be such a claim.
- The layer separation is worth stating in the read model as an explicit type boundary, so a future reader cannot reattach mission semantics to the spatial layer by convention.

---

## Decision C-3 — Coverage honesty

> **Coverage is always scoped to named sources and a defined briefing or scan interval.**
>
> Supported states include: **checked · unavailable · not connected · excluded · uncertain · not yet checked.**
>
> **Foundry may not make a global claim that nothing was missed.**
>
> **"No external actions occurred" is a derived statement**, produced when zero qualifying external-action events exist within the defined interval. **Do not create a fabricated `external_action.none` event.**

**Sources:** realignment § 6 C-3; construction map § "Package 1b" hard requirements.

**What this settles.** The realignment's adopted resolution required only that unintegrated sources be *named* rather than omitted, and prohibited the phrase "nothing was missed." This decision is **stricter in two ways** the source did not state.

First, coverage is **scoped**: it is never a property of Foundry as a whole, but of a named source over a defined interval. This makes the global claim not merely prohibited but **unrepresentable** — there is no scope at which it could be expressed.

Second, a negative is **derived, never authored.** The absence of qualifying events within an interval is a computation over the event log. Emitting an event to represent that absence would manufacture evidence for a non-occurrence, which is the same defect class as the `AC-111` dangling `evidenceIds` — *a reference to evidence that does not exist reads like an audit trail.*

**Consequences.**
- Every coverage statement carries a **named source** and a **defined interval**. A coverage figure without both is invalid.
- Six states are supported. The list is stated as **inclusive** ("include"), so it is a floor rather than a closed set; a seventh state is an addition, not a contradiction.
- **Prohibited:** any global "nothing was missed" claim, at any scope, in any wording.
- **Prohibited:** an `external_action.none` event, or any equivalent synthesized event standing for an absence.
- "No external actions occurred" is computed at read time from zero qualifying events in the interval.
- Unintegrated sources — email, calendar, bills, commitments — are reported as **not connected**. They are never omitted, and their absence is never rendered as a clean result.

**Open — not decided here.**
- **Two coverage vocabularies now exist.** Package 2's coverage report is already specified with five different terms — *scanned / skipped / refused / inaccessible / not-yet-scanned* (construction map § "Package 2"). This record's six states do not map onto them one-to-one. **Reconciling or explicitly mapping the two is undecided.** *(proposal: treat this record's six as the general vocabulary and define Package 2's five as its scan-domain specialization, with a stated mapping. Assistant-authored.)*
- **"Qualifying external-action event" is undefined**, as is the interval boundary rule (open/closed endpoints, and which clock). *(proposal: define both before the first derived negative is rendered; two honest renderings of one interval must not disagree. Assistant-authored.)*

---

## Decision C-4 — Disclosure-depth budget

> **Foundry uses three disclosure depths:**
>
> 1. **World glance** — current state, urgent attention, visible progress, and unmistakable outcome.
> 2. **Tactical mission view** — objective, agents, autonomy, loadout, permissions, checkpoints, blockers, decisions, cost, and artifacts.
> 3. **Evidence/audit detail** — complete event history, payloads, provenance, source coverage, authority evidence, and diagnostic detail.
>
> **Normal operation must remain usable through levels 1 and 2.** Level 3 preserves complete inspectability without overwhelming the ordinary experience.

**Sources:** realignment § 6 C-4; construction map § "Package 1b" measurable outcomes.

**What this settles.** The realignment recorded progressive disclosure as agreed and **the depth budget at each level as unspecified**. This decision specifies the budget **by content rather than by count** — each level is defined by what belongs in it, which is a stronger constraint than a field limit because it survives redesign.

It also fixes the **usability floor**: levels 1 and 2 must carry normal operation on their own. Level 3 is for inspectability, not for ordinary use. An operator who never opens level 3 must still be able to run Foundry normally.

**Consequences.**
- Level 3 is **always reachable and never required** on the normal path. Both halves bind: it may not be omitted, and it may not be a prerequisite for routine work.
- A figure that belongs to level 3 does not appear at level 1 by default. Depth is a property of the content, not of the operator's persistence.
- Level 2's contents are enumerated and align with the Decision C-2 operational-mission layer (loadout, permissions, checkpoints, decisions, outcome). The tactical view is the mission layer's ordinary presentation surface.
- Level 1 must make outcome **unmistakable** — a completed, failed, or blocked mission is not distinguishable only by reading detail.

**(proposal) Implementation note — assistant-authored, no operator authority.**
- Pair this with the construction map's existing measurable outcome — *"every figure traceable to a persisted event; ledger reachable behind the summary."* A figure shown at level 1 or 2 should be traceable to a persisted event reachable at level 3. This is the traceability invariant that keeps the three levels views of one truth rather than three independently authored surfaces.

---

## Summary

| # | Conflict | Decision | Status |
| --- | --- | --- | --- |
| C-1 | V1.1 status | **PAUSED** — not completed, not superseded. `AC-111` open, `AC-112` not started. Package track governed separately | Decided |
| C-2 | Mission model | Two distinct layers: **backend-owned operational mission** (seven stages) and **frontend spatial agent trace** (event-supported movement). `missionTrace` → `agentTrace` authorized, execution deferred | Decided |
| C-3 | Coverage honesty | Scoped to named source + defined interval; six states; **no global "nothing was missed"**; negatives derived, never fabricated as events | Decided |
| C-4 | Disclosure depth | Three depths defined by content; normal operation usable through levels 1–2; level 3 always reachable, never required | Decided |
| C-5 | Buildings as economic objects | **Not decided here.** Out of scope through Package 5, unchanged | Open |

**Carried open, recorded so they are not mistaken for settled:**
`operationalMemory` → `operationalSnapshot` (C-2) · disposition of the five in-flight panels (C-2) · the two coverage vocabularies (C-3) · "qualifying external-action event" and interval boundaries (C-3) · **D-8**, disposition of `e5378aa`, resolving at `AC-117`.

---

**Companion documents:**
`docs/01-mission/foundry-mission-realignment-2026-08-04.md` · `docs/03-architecture/foundry-construction-map.md` · `docs/01-mission/agent-city-v1.1-decision-record.md`
