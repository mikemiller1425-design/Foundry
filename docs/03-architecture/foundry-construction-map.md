# Foundry Construction Map — Packages 1a → 5

**Type:** Sequenced construction plan
**Date:** 2026-08-04
**Status:** **Package 1a delivered. Packages 1b–5 are proposals awaiting their own operator authorization.**

Each package needs an explicit authorization before it starts, on the same discipline the V1.1 ladder uses. This map is a plan, not a schedule, and not a licence.

**Relationship to the V1.1 ladder:** **decided 2026-08-04 — V1.1 is PAUSED**, not completed and not superseded. `AC-111` remains open as a historical governed-execution milestone; `AC-112`–`AC-120` unstarted. The Package track is governed **separately** from the ladder until a future operator decision reconciles the two; the pause lifts no existing obligation. See Decision C-1 in `docs/01-mission/foundry-package-1b-decision-record.md`. *(Formerly conflict **C-1** in `docs/01-mission/foundry-mission-realignment-2026-08-04.md`.)*

---

## Package 1a — Safe backend foundation ✅ **Delivered 2026-08-04**

**Why it exists separately:** the working tree carried a large uncommitted frontend redesign that collided with the Command Center and the mission model. Splitting let the safe backend land without touching that work or pre-empting a decision about it.

| | |
| --- | --- |
| **Delivered** | Read-only NAS catalog contracts; the NAS adapter boundary; the intent-candidate schema and promotion guard; this map; the realignment record; the NAS threat model |
| **Depends on** | Nothing |
| **Acceptance gate** | Operator review of this map and the realignment record |
| **Measurable outcome** | 49 offline tests; zero NAS access; zero frontend files touched |
| **Explicitly not delivered** | Command Center, mission contracts, any UI, any real scan |

---

## Package 1b — Frontend reconciliation, then the Command Center

**The decision comes before the code.** Two candidate models existed in the working tree and neither was confirmed. Building a Command Center before that was settled would have created a second mission model beside an unreviewed first.

**Ratified 2026-08-05** — `docs/01-mission/foundry-package-1b-decision-record-2026-08-05.md` is the authoritative record for **C-1** (V1.1 paused — not completed, abandoned, or superseded), **C-2** (distinct layers; the backend-owned operational mission is expressed as **lifecycle facets with per-mission-type stages**, not a fixed seven-stage sequence), **C-3** (coverage honesty; **six required states**), and **C-4** (three disclosure depths, ordinary operation usable through levels 1–2). It carries acceptance criteria for each and supersedes the 2026-08-04 record (`docs/01-mission/foundry-package-1b-decision-record.md`). Recorded starting point: **`7d7fff6`**.

**The decisions are recorded, not implemented**; 1b-i and 1b-ii still require their own authorization. *(Historical, as written on 2026-08-05. Both were authorized and completed afterwards — see the slot table below. The sentence is preserved rather than rewritten.)* **Obligation O-1** binds the Package 1 integration gate: two `apps/api` tests were *not executed* at `7d7fff6` and must not be carried forward as passed.

**Clarified later on 2026-08-05** (§ 7 of the same record): `operationalMemory` → `operationalSnapshot` **is authorized** for 1b-i, with the "purely derived" precondition verified as holding; and coverage is ruled to be **four orthogonal dimensions**, not one enum. **Coverage-contract implementation is explicitly out of 1b-i scope** — it belongs to the later Claude backend-concepts package. 1b-i may only remove misleading coverage language and preserve honest states already backed by truth.

**Sequencing amended 2026-08-05.** The original two-phase split (audit, then Command Center) proved too coarse: it gave the Command Center no separate backend-truth slot, and no gate between backend truth and the UI built on it. Package 1b is now **four numbered slots, in order**. Each needs its own explicit authorization.

*Historical note: 1b-i was originally scoped as a read-only audit producing a written disposition and changing nothing. It became the audit plus the operator-authorized frontend reconciliation — accepting the audited tree and applying the two ratified renames. The paragraph above is preserved as the original framing.*

### The four slots

| Slot | Owner | What it is | State |
| --- | --- | --- | --- |
| **1b-i** | Claude + Cursor | Frontend reconciliation: audit disposition, accepted frontend, `missionTrace`→`agentTrace` and `operationalMemory`→`operationalSnapshot` | ✅ **Complete at `f0bb0bb`** |
| **1b-ii** | Claude | **Command Center Operational Truth** — backend contracts, commands, events, projections, tests | ✅ **Complete at `e895d74`** |
| **1b-ii-a** | Claude | **Command Center Read Transport** — schema-validated aggregate snapshot and versioned event vocabulary | **Not authorized** |
| **1b-iii** | Cursor | **Command Center Frontend** — implementation against 1b-ii-a transport | **Not authorized**; blocked on **1b-ii-a** committed and pushed |
| **1b-iv** | Claude + Michael | **Integration verification and operator observation** | **Not authorized**; blocked on 1b-iii |

**Package 1 remains open until 1b-iv is observed and approved by the operator.**

### 1b-ii — Command Center Operational Truth

| | |
| --- | --- |
| **Depends on** | 1a; 1b-i (`f0bb0bb`); decisions C-1–C-4, C-6, C-7 |
| **Scope** | Operational-mission foundation · scheduled decision batches · persisted briefing record and cursor · external-action projection · monetary outcomes · source coverage · autonomy level · recommended priorities |
| **Acceptance gate** | The 27 proofs in § *Package 1b acceptance gates* below |
| **Hard requirements** | Backend owns all truth · no event that nothing can emit · autonomy never enlarges authority · no fictional revenue · no global coverage claim · no `external_action.none` |
| **Explicitly excluded** | Any UI · email/calendar integration · model-generated prioritization · NAS access · Package 2 work |
| **Risk** | Eight surfaces at once. Each is a place where a plausible-looking number could be shown without a recorded fact behind it |

### 1b-ii-a — Command Center Read Transport

**Why it exists.** A post-completion seam audit of `e895d74` found the eight 1b-ii surfaces reachable from no HTTP route, and both event transports filtering through `isV1Event` — so the three Command Center events cannot reach a client at all. 1b-iii is forbidden from inventing mission, coverage, decision, external-action, monetary, autonomy, recommendation, cursor, or urgency truth, and `apps/agent-city` does not depend on `@foundry/persistence`. It therefore had no non-inventing source for eight of its nine forbidden categories. This slot supplies the transport and adds no domain truth.

| | |
| --- | --- |
| **Depends on** | 1b-ii (`e895d74`) |
| **Scope** | One read-only schema-validated aggregate snapshot endpoint · one versioned opt-in event vocabulary |
| **Acceptance gate** | The 12 proofs in § *Package 1b acceptance gates* |
| **Hard requirements** | Composed only from accepted 1b-ii projections · no duplicated projection or domain logic in `apps/api` · zero persisted mutation on any read · explicit `not_recorded`/`not_available`/`not_connected` · default event endpoints stay V1-compatible |
| **Explicitly excluded** | Any UI · any `apps/agent-city` change · any new event, command, entity type, or domain truth · any change to 1b-ii projection logic |
| **Risk** | Low. Every field already exists as an accepted projection; the package moves data, it does not derive it |

### 1b-iii — Command Center Frontend

| | |
| --- | --- |
| **Depends on** | **1b-ii-a** committed and pushed |
| **Acceptance gate** | Consumes backend projections and invents nothing — see § *Package 1b acceptance gates* |
| **Hard requirements** | Normal operation usable through world-glance and tactical-mission levels; evidence/audit reachable but never required for ordinary operation |

### 1b-iv — Integration verification and operator observation

| | |
| --- | --- |
| **Depends on** | 1b-iii |
| **Scope** | **Seams only**, between the accepted 1a, 1b-i, 1b-ii, and 1b-iii commits |
| **Acceptance gate** | Michael personally observes the eleven items in § *Package 1b acceptance gates* |
| **Hard requirement** | A repair is limited to an integration defect. If closure would require a new contract, event, authority change, or behavior, **stop and open another package** rather than widening the gate |

---

## Package 2 — Operator-authorized read-only NAS inventory

Turns 1a's boundary into a real, bounded, operator-gated scan.

| | |
| --- | --- |
| **Depends on** | 1a; an operator decision naming which volume Foundry may index. **The coverage-vocabulary question is resolved** (§ 7.2 of the 2026-08-05 decision record): coverage is four orthogonal dimensions — source connection · interval progress · item disposition · uncertainty flag — and this package's scan terms are dimension C, joined by `unsupported`. 2a is no longer blocked on vocabulary |
| **Acceptance gate** | Operator names the root and reviews the first coverage report |
| **Measurable outcome** | One configured root; a coverage report distinguishing scanned / skipped / refused / inaccessible / not-yet-scanned; resumability demonstrated; **zero writes**, proven by comparing the tree before and after |
| **Hard requirements** | Read-only · no extraction · no rename, move, or delete · bounded traversal · cancellable · honest coverage |
| **Risk** | Volume. A multi-terabyte NAS makes the hash strategy an operational decision, not a preference — see the threat model |

---

## Package 3 — Conversation gold extraction and intent reconciliation

Reads exported conversations and produces **candidates**, never canonical intent.

| | |
| --- | --- |
| **Depends on** | 1a (schema + promotion guard); 2 (source material located) |
| **Acceptance gate** | Operator reviews a sample batch and confirms attribution is correct before any bulk run |
| **Measurable outcome** | Candidates with exact speaker attribution, source locator, verbatim excerpt, duplicate and contradiction links; **zero** canonical promotions without an explicit per-candidate operator command |
| **Hard requirements** | Assistant text never becomes operator intent by proximity · unresolved consequential contradictions block promotion · no bulk promotion · operator correction always available |
| **Risk** | **The highest-consequence package in the plan.** Everything downstream rests on the registry being right. A mis-attributed line becomes a false premise for every later decision |
| **Wiring note** | 1a deliberately added no command or event to the closed vocabulary. Package 3 adds them, at the rung that produces them — the `AC-107` discipline: an event nothing can emit is a claim the system does not honour |

---

## Package 4 — Professional Truth Vault and the Employment District

The first complete revenue-oriented district: discovery → qualification → intelligence → truthful application package → **approval** → submission → response tracking → interview support → offer → supervised productivity.

| | |
| --- | --- |
| **Depends on** | 1b (supervision surface); 3 (verified career facts) |
| **Acceptance gate** | Operator approves each external action individually before it is sent |
| **Measurable outcome** | One complete journey end to end with evidence at each step; **zero** external submissions without recorded approval |
| **Hard requirements** | **Professional reframing allowed, invention prohibited** · every claim traceable to a verified fact · no application, message, or representation without explicit approval |
| **Risk** | The first package that acts on the operator's behalf in the world. An invented credential is not a bug, it is a false statement to a third party |

---

## Package 5 — Local Opportunity Packet revenue experiment

The first external micro-offer: a small set of qualified local prospects, source-linked public evidence, visible presence weaknesses, tailored outreach angles.

| | |
| --- | --- |
| **Depends on** | 1b, 3; the Package 4 approval discipline |
| **Acceptance gate** | Operator reviews a complete packet before any outreach; **no outreach without per-message approval** |
| **Measurable outcome** | One packet delivered; a recorded decision on whether it was worth paying for. Demand tested by a small paid outcome **before** any subscription |
| **Hard requirements** | Public evidence only · every claim source-linked · **no outreach, submission, or publication without approval** · no scraping that violates a site's terms |
| **Risk** | Touches real third parties. A wrong claim about a business's website is a public statement about someone else's company |

---

## Later packages (not planned in detail)

External integrations (email, calendar, bills) · repeatable supervised workflows · subscriptions · economic buildings, rentals, ownership, revenue participation. Each needs its own authorization, and the economic ones touch money, ownership, and possibly law — **deliberately unplanned here**.

---

## Package 1b acceptance gates

Recorded 2026-08-05. Each item is a **proof obligation**, not a checklist tick: closure requires demonstrating it, not asserting it.

### 1b-ii — 27 proofs

**Operational mission**
1. A new mission type declares unique stages **without changing a shared enum**.
2. Existing software-build events project into one operational mission **without rewriting history**.
3. Agent spatial tracing (`agentTrace`) remains separate from operational mission truth.
4. The frontend has **no authoring path** for mission truth.

**Scheduled decision batches**
5. Decision-batch policy is persisted and operator-authenticated.
6. Immediate-interruption categories are backend-owned and visible.

**Briefing interval and cursor**
7. Interval membership uses `(previousAcknowledgedSequence, capturedEndSequence]`.
8. Rendering or refreshing a briefing **cannot** advance the cursor.
9. Acknowledgement advances it **once**; duplicate and concurrent calls are idempotent.
10. Events recorded after the captured end appear only in the **next** briefing.

**External actions**
11. The existing real Claude Code invocation classifies as **one** external action, not two.
12. Authorization, preflight, and dry-run **do not** classify as external actions.
13. "No qualifying external actions were recorded…" derives from zero classified actions in the exact interval.
14. **No `external_action.none` event exists.**

**Money**
15. Monetary statuses cannot be conflated.
16. AC-111 actual cost projects as **spent**, not revenue.
17. Zero revenue is shown honestly when no received record exists.

**Coverage**
18. Coverage dimensions remain orthogonal.
19. Excluded and uncertain states require reasons.
20. Cancelled or incomplete work **cannot** report complete coverage from counters alone.

**Autonomy and recommendations**
21. Autonomy changes **do not** enlarge backend authority.
22. Recommendations trace to evidence and **cannot execute**.

**Disclosure**
23. Level-2 mission data exposes objective, agents, autonomy, loadout, authority, stages/checkpoints, blockers, decisions, cost, and artifacts.
24. Every level-2 figure can reach supporting level-3 evidence.

**Regression and gates**
25. Existing approval, budget, command, AC-111, mock mode, backend mode, and canonical fixtures remain unchanged.
26. The full `apps/api` suite runs in a correctly provisioned environment, **including all 18 O-1 shell tests** — discharging Obligation O-1.
27. Typecheck, lint, production build, full tests, `git diff --check`, canonical-fixture byte identity, and operational-database nonmutation all pass.

### 1b-ii-a — 12 proofs

1. `GET /command-center` returns a response parsing against an aggregate schema published from `@foundry/contracts`.
2. Every field composes from **accepted 1b-ii projections only**.
3. **No duplicated projection or domain logic in `apps/api`.** A field that appears to need new derivation is new domain truth — the package stops and reports rather than computing it.
4. **Repeated reads cause zero persisted mutation**: event count, every entity, and the briefing cursor are unchanged after many reads.
5. Missing evidence surfaces as `not_recorded` / `not_available` / `not_connected` **with a stated reason** — never a default.
6. `GET /events` and `GET /events/stream` with **no** vocabulary parameter stay **byte-compatible with `e895d74`**, pinned by a golden-response test.
7. `vocabulary=command-center-v1` delivers V1 **plus every accepted Command Center event**.
8. **Every unknown vocabulary value is refused with an explicit `400`.** Silent fallback to V1 is prohibited.
9. Replay ordering is by log sequence, and `Last-Event-ID` / `lastEventId` gap recovery behaves identically to the default stream.
10. Raw entity reads remain **evidence-only** and are not the frontend contract.
11. The `apps/agent-city` tree object is byte-identical before and after.
12. All established gates pass: typecheck · lint · production build · full suite including the 18 O-1 shell tests · `git diff --check` · `v1-canonical-run.json` byte-identity · operational-database nonmutation.

### 1b-iii — frontend gate

Cursor may build only after **1b-ii-a** is **committed and pushed**, and must consume the **schema-validated aggregate snapshot and the versioned event transport — never raw entity shapes**. The frontend consumes backend projections and **must not invent** any of: mission progress · coverage · decisions · external actions · money · autonomy · recommendations · briefing cursor · urgency.

Normal operation must remain usable through **world-glance** and **tactical-mission** levels. Evidence/audit detail stays reachable but is **not required** for ordinary operation.

### 1b-iv — integration and observation gate

Claude verifies **seams only**, between the accepted 1a, 1b-i, 1b-ii, and 1b-iii commits. A repair is limited to an integration defect; anything requiring a new contract, event, authority change, or behavior **opens another package** instead.

Michael must personally observe: briefing truth · scheduled decisions · active mission · autonomy without authority enlargement · external-action accounting · monetary honesty · source coverage · recommendations · progressive disclosure · evidence access · unchanged existing modes.

**Package 1 closes only after that observation.**

---

## Dependency graph

```
1a ──┬── 1b-i (audit) ── 1b-ii (Command Center) ──┬── 4 (Employment)
     │                                            │
     └── 2 (NAS inventory) ── 3 (gold extraction) ─┴── 5 (Opportunity Packet)
```

`3` needs `1a`'s guard and `2`'s located material. `4` and `5` both need `1b`'s supervision surface and `3`'s verified facts.

## Standing constraints across every package

Backend remains the single authority · no visual progress without a recorded event · external actions approval-gated · contradictions in priority/authority/spending/publication/consequential action stop execution · `v1-canonical-run.json` byte-identical · records corrected by appending · **no package begins without its own explicit operator authorization**.
