# Foundry Mission Realignment — 2026-08-04

**Type:** Strategic realignment record
**Status:** Recorded. **This document does not amend the V1.1 mission or ladder**, and does not authorize resuming them.
**Occasion:** Foundry's first successful governed real Claude Code run (build `build-3d5a77c3…`, 2026-08-04).

This record is append-only. A later decision is a new dated entry, never an edit to this one (principle 18).

---

## 0. What this document is for

To separate five things that are easy to blur once a repository contains a lot of writing:

1. what the **operator has confirmed**;
2. what is **already authoritative** by an earlier recorded decision;
3. what is **actually implemented**;
4. what is an **unconfirmed proposal**;
5. what is an **assistant suggestion** that nobody adopted.

A proposal is not authoritative merely because it exists in `docs/`. Sixty-two NAS District documents sitting untracked in the working tree are not a decision; they are drafts. Treating them as settled would be the same error the `AC-108`/`AC-109` observation records had to be corrected for.

---

## 1. Confirmed operator intent

Stated by the operator in the realignment instruction of 2026-08-04. Recorded here as intent, **not** as implemented behaviour.

### 1.1 What Foundry is

> A governed visual operating environment that reduces the operator's mental load by turning scattered information, intent, and opportunities into supervised work that produces measurable real-world and monetary value.

### 1.2 Interface

- Captivating, but navigable by a ten-year-old.
- Progressive disclosure on a game mission loop: **briefing → select mission → review loadout, permissions, budget, constraints → launch → watch truthful progress → resolve exceptions → outcome and evidence-backed debrief.**
- **The world is an interface to operational truth, not a substitute for it.** No visual progress without a supporting recorded event. *(This restates and does not weaken V1.1 `V-102`.)*

### 1.3 Scope the operator wants

Personal Command Center (Foundry work first; later email, calendar, bills, commitments, personal projects) · read-only NAS Intelligence District over Synology · Employment as the first complete revenue district · lead-generation/business-presence analysis as a possibly faster micro-offer · buildings that may later represent agent teams, reusable workflows, revenue participation, and customizable virtual property · small paid outcomes before subscriptions.

### 1.4 Supervision

Scheduled decision batches, with immediate interruption **only** for: urgent deadlines, safety, unexpected spending, external failures, or loss of material value. Live supervision with truthful event-derived progress. **Explicit approval before** job applications, external messages, email, publishing, spending, production changes, agreements, or representing the operator externally. **Contradictions stop execution** when they could alter priorities, authority, spending, publication, or other consequential action.

### 1.5 Economic sequencing

1. The operator is the first customer.
2. First external segment: local service businesses, initially construction/home-service.
3. First micro-offer candidate: an evidence-backed **Local Opportunity Packet** — qualified prospects, source-linked public evidence, visible presence weaknesses, tailored outreach angles, **no outreach without approval**.
4. Employment remains the first complete district, end to end.
5. Test demand with a small outcome before any subscription.

### 1.6 Memory authority model

Seven tiers, confirmed: Personal Constitution · Canonical Intent Registry · Professional Truth Vault · Operational Memory · Working Memory · Sensitive Vault · Prohibited Memory.

**The governing rule:** Foundry may store observations provisionally, but **consequential decisions may use only verified facts and confirmed intent**. Professional reframing is allowed; invention is prohibited.

### 1.7 NAS safety decision

The NAS is **authoritative storage**. Integration is **read-only and index-first**. Foundry must not rename, move, delete, extract in place, or reorganize source files. Any future mutation requires separate authorization.

Material types identified: images, videos, Markdown, CSV, Python, ZIP. These are **material types handled by one district**, not separate districts.

---

## 2. Existing authoritative decisions (unchanged)

Nothing in this realignment amends any of these.

| Decision | Where |
| --- | --- |
| Foundation 1.0 frozen; V1.1 is a reviewed mission baseline (`AC-102`) | `docs/01-mission/agent-city-v1.1-mission.md` |
| Backend is the single authority; the frontend cannot force a transition | `F-03`, ADR-002 |
| The Builder must not write, modify, or execute its own validation | `F-05`, mission § "load-bearing guarantee" |
| Humans govern: objective submission, plan review, build start, and execution authorization each require an authenticated operator | principle 14; `AC-107`–`AC-110` |
| Execution authorization is **single-use and plan-bound** to a backend SHA-256 over persisted plan content | `F-113`, `F-113a` |
| Real execution is allocated to exactly one named stage, `backend_implementation` | `CLAUDE_CODE_STAGE`, `v1-scope.md` |
| The mock runtime is the regression baseline; `v1-canonical-run.json` stays byte-identical | `v1.1-acceptance.md` § 2 |
| Risk classes R0–R2 only | principle 19 |
| Records are corrected by appending, never by rewriting | principle 18 |
| Nothing is promoted from the Future Registry | `docs/04-future/registry.md` |

**Relationship to V1.1.** The V1.1 ladder is *not* cancelled or superseded by this realignment. `AC-111` remains open; `AC-112`–`AC-120` remain unstarted. Whether the ladder resumes, is re-sequenced, or is superseded is **an open operator decision** (§ 6, conflict C-1).

---

## 3. Implementation truth — what actually exists today

Measured, not assumed.

| Capability | State |
| --- | --- |
| Objective → Project → Build → plan → operator review | **Operational** (`AC-103P`, `AC-108`) |
| Mock orchestration of six stages to an approval gate | **Operational** (`AC-109`) |
| Execution authorization gate, single-use, SHA-256 plan-bound | **Operational** (`AC-110`) |
| One real controlled Claude Code run, governed end to end | **Performed once**, succeeded, $0.0790585 |
| Durable evidence for a real run | **Implemented, never exercised by a real run** |
| Personal Command Center | **Does not exist** |
| NAS integration of any kind | **Does not exist.** No NAS path has ever been read |
| Employment district | **Does not exist** |
| Lead generation / Local Opportunity Packet | **Does not exist** |
| Email, calendar, bills, commitments | **Do not exist.** No integration, no adapter, no contract |
| Memory tiers as implemented systems | **Do not exist** as such |

**One honest gap carried forward:** the first real run's detailed evidence was never persisted and is unrecoverable. Recorded in `docs/evidence/ac-111/first-real-run-observation.md`.

---

## 4. Unconfirmed proposals

Present in the repository or working tree. **None is authoritative.**

| Item | Count / location | Standing |
| --- | --- | --- |
| NAS District design package | **62 untracked files**, `docs/proposals/nas-district-*.md` | Unconfirmed drafts. **Not opened or read for this package**, and not relied on by any Package 1a contract |
| V1.1→V2 roadmap | `docs/proposals/agent-city-v1.1-to-v2-roadmap.md` | Proposal |
| Future Registry | `docs/04-future/registry.md` | Explicitly inactive by mission decision |
| In-flight frontend redesign | 44 modified + 43 untracked files under `apps/agent-city` | **Unconfirmed.** See § 6, C-2 |

The Package 1a NAS contracts were written from **the operator's own instruction text**, not from the NAS District drafts. If those drafts contain decisions the operator considers settled, reconciling them is future work — and would be a reconciliation, not an inheritance.

---

## 5. Assistant-authored suggestions

Recorded so they are never mistaken for operator intent.

- The **hash-strategy default** (`size_mtime` for a first pass, `sha256_full` reserved) is an assistant engineering judgement with its tradeoffs documented. The operator asked for "hash strategy documented with cost/performance tradeoffs"; the specific default is a suggestion open to correction.
- The **material extension table** is assistant-authored from the operator's six named types. Which extensions map to which type was not specified.
- The **consequential-contradiction domain list** (priority, authority, spending, publication, consequential action) is a direct transcription of the operator's words; the *non*-blocking `preference` and `other` domains are an assistant addition.
- The **Package 1a / 1b split** was proposed by the assistant and then confirmed by the operator, so it is now confirmed intent.
- Every structural choice in the Construction Map's acceptance gates is an assistant proposal until the operator confirms it.

---

## 6. Conflicts requiring reconciliation

### C-1 — Is the V1.1 ladder still the active plan?

The realignment describes a product larger than V1.1's stated mission. `AC-111` is open, `AC-112`–`AC-120` are unstarted, and `AC-120` requires the operator to personally perform the § 3 journey end to end.

**Unresolved.** This record does not decide it, and the ladder is unchanged. **Needed:** an operator decision on whether V1.1 completes, pauses, or is superseded — and, if superseded, an explicit record of what happens to its open acceptance requirements.

### C-2 — Two candidate frontend models, neither confirmed

The working tree carries a substantial uncommitted redesign, including `lib/world/missionTrace.ts` (`deriveMissionTrace`, `MissionTraceLeg`) and `lib/runtime/operationalMemory.ts`, plus panels for mission trace, operational memory, agent life, runtime readiness, and a world atlas.

These overlap directly with Package 1's mission-supervision model (§ B) and intent foundation (§ D).

**Explicitly not decided here.** Package 1a **did not read them as authority, did not extend them, did not duplicate them, and did not touch them.** They are recorded as **candidates requiring explicit reconciliation in Package 1b**. Whether they are accepted, amended, or rejected is the operator's call.

### C-3 — Command Center scope versus current integrations

The operator wants a Command Center covering email, calendar, bills, and commitments. **None of those integrations exists.** A Command Center built now can honestly report only Foundry's own operational data plus explicit "not yet integrated" coverage.

**Resolution adopted for Package 1b:** coverage must name unintegrated sources rather than omitting them. "Nothing was missed" is prohibited language.

### C-4 — "Ten-year-old navigable" versus operator-grade evidence

Progressive disclosure is the stated reconciliation, but the depth budget at each level is unspecified.

**Unresolved.** A design question for Package 1b.

### C-5 — Buildings as economic objects

Agent teams, revenue participation, rentals, and virtual property are confirmed as *direction*, and they touch money, ownership, and possibly third parties. No contract, no legal position, and no revenue model exists.

**Deliberately out of scope** through Package 5.

---

## 7. What Package 1a actually did about all this

Nothing in this record was implemented as behaviour. Package 1a delivered contracts, a read-only boundary, an authority guard, and documentation — all in directories the in-flight frontend does not touch. **No Command Center exists. No NAS was read. No mission model was chosen.**
