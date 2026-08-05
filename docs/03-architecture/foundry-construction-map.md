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

**The decisions are recorded, not implemented**; 1b-i and 1b-ii still require their own authorization, and `operationalMemory` remains undisposed. **Obligation O-1** binds the Package 1 integration gate: two `apps/api` tests were *not executed* at `7d7fff6` and must not be carried forward as passed.

**Two phases, in order:**

**1b-i — Read-only audit.** Review the in-flight redesign against the mission and the realignment record. Decide per subsystem: **accept**, **amend**, or **reject**. Produces a written disposition; changes nothing.

**1b-ii — Command Center.** Only after 1b-i. Integrate into whatever shell 1b-i settled on, reusing the accepted mission model rather than adding one.

| | |
| --- | --- |
| **Depends on** | 1a; **an operator disposition on the in-flight frontend** — ratified 2026-08-05 in `docs/01-mission/foundry-package-1b-decision-record-2026-08-05.md` (C-1–C-4 decided with acceptance criteria; C-5 and `operationalMemory` open) |
| **Acceptance gate** | Operator confirms the audit disposition, then observes the Command Center |
| **Measurable outcome** | Eleven required surfaces present; every figure traceable to a persisted event; coverage naming unintegrated sources; ledger reachable behind the summary |
| **Hard requirements** | No visual progress without a recorded event · no "nothing was missed" · autonomy levels never enlarge backend authority · approval-gated actions stay approval-gated |
| **Risk** | The largest scope-creep surface in the plan. The Command Center can honestly cover only Foundry's own data until later integrations exist |

---

## Package 2 — Operator-authorized read-only NAS inventory

Turns 1a's boundary into a real, bounded, operator-gated scan.

| | |
| --- | --- |
| **Depends on** | 1a; an operator decision naming which volume Foundry may index; **an operator ruling reconciling this package's five coverage terms with C-3's six required states** — undecided, and it blocks 2a (see the 2026-08-05 decision record) |
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

## Dependency graph

```
1a ──┬── 1b-i (audit) ── 1b-ii (Command Center) ──┬── 4 (Employment)
     │                                            │
     └── 2 (NAS inventory) ── 3 (gold extraction) ─┴── 5 (Opportunity Packet)
```

`3` needs `1a`'s guard and `2`'s located material. `4` and `5` both need `1b`'s supervision surface and `3`'s verified facts.

## Standing constraints across every package

Backend remains the single authority · no visual progress without a recorded event · external actions approval-gated · contradictions in priority/authority/spending/publication/consequential action stop execution · `v1-canonical-run.json` byte-identical · records corrected by appending · **no package begins without its own explicit operator authorization**.
