# Agent City — Post-V1 Reconciliation Record

**Type:** Reconciliation of four Post-V1 documents into one authoritative reading
**Date:** 2026-08-03
**Rung:** `AC-102` (V1.1 mission baseline ratification)
**Reconciles:** `docs/audits/agent-city-post-v1-truth-audit.md` · `docs/proposals/agent-city-v1.1-mission-proposal.md` · `docs/proposals/agent-city-v1.1-build-ladder-proposal.md` · `docs/proposals/agent-city-v1.1-to-v2-roadmap.md`
**Status:** Adopted as part of the ratified V1.1 baseline.

---

## 0. Purpose and standing

The four documents above were written independently and **disagree with each other** in specific, identifiable ways — most importantly about how many operator decisions block ratification and what they are. This record resolves every disagreement into one reading, records observations discovered during Phase 0 that none of the four contain, and assigns every audit finding to the rung that owns it, so that no finding is silently dropped.

**What this record does not do.** It does not amend Foundry Foundation 1.0. It does not reopen, renumber, or re-grade any `FBL-*` rung — all of `FBL-001`–`FBL-035` including `FBL-021A` remain historical completed authority. It does not promote anything from `docs/04-future/registry.md`. It does not alter any V1 evidence file or approval record.

The authoritative decisions themselves live in `docs/01-mission/agent-city-v1.1-decision-record.md`. This record explains how they relate to what the four documents said.

---

## 1. The decision-list disagreement — resolved

This is the disagreement the reconciliation was commissioned to settle.

Both the audit and the mission proposal present a list of blocking operator decisions. Both lists contain **six** items. **They are not the same six.**

| # | Decision | Audit §16 | Mission proposal §9 |
| --- | --- | --- | --- |
| — | Objective input form (curated set vs. free text) | **absent** | §9(1) |
| — | Real-build workspace policy | §16(2) | §9(2) |
| — | Mission status of V1.1 (new baseline vs. amendment) | §16(4) | §9(3) |
| — | Evidence retention for the cited SQLite artifacts | §16(1) | §9(4) |
| — | Finding 6 closure standard | §16(5) | §9(5) |
| — | Amending frozen Foundation 1.0 documents | §16(3) | §9(6) |
| — | Safari coverage standard | §16(6) | **absent** |

**Resolution.** The audit omits *objective input form*; the mission proposal omits *Safari coverage standard*. Their **union is exactly seven**, and neither document's count of six is correct as a statement about what actually blocks ratification. The authoritative list is the seven-item record in `docs/01-mission/agent-city-v1.1-decision-record.md`, which supersedes both §16 and §9 for this purpose. Those two sections remain in their documents unedited as historical drafting.

Consequentially, `docs/proposals/agent-city-v1.1-build-ladder-proposal.md` `AC-102` — "resolve the six blocking operator decisions" — is corrected to **seven** in the ratified ladder.

---

## 2. Where the operator's decisions are narrower or stricter than the documents proposed

In five cases the ratified decision is **not** simply one of the options the documents offered. Recording this matters: a later reader must not resolve an ambiguity by reaching back to the proposal's menu.

| Ref | What the documents offered | What was decided | Effect |
| --- | --- | --- | --- |
| **R-1** | Audit §16(2) offered three workspace options: (a) Foundry-created disposable, (b) operator-nominated scratch directory, (c) real project repository. The mission proposal recommended (a) and "recommended: exclude" for (c), leaving (b) open. | **(a) only.** Both (b) and (c) are excluded. | Stricter than either document. Operator-nominated real project directories are now an explicit V1.1 exclusion, not an open question. |
| **R-2** | Audit §16(1) and mission §9(4) posed a **binary**: commit the two `agentrun.sqlite` files via a `.gitignore` exception, **or** amend the approval record. | **Neither.** Do not commit mutable SQLite runtime databases; create a **new dated evidence clarification** citing durable retained JSON/log/report artifacts, superseding inaccurate citations **without rewriting historical approvals**. | A third path the documents did not offer. It preserves principle 18 (append-only; corrections by new record) more strictly than "amend" would have. |
| **R-3** | Audit §16(5) asked whether "diagnosed and fixed" is required **or** "diagnosed and formally classified with a reproduction artifact" suffices. | **Diagnosis is mandatory in all cases.** Real product/test defects must be **fixed**. Classification may close a portion **only** where retained reproduction evidence proves an automation/tool limitation, and then only together with a standing dated real-browser check. | Stricter than the softer branch. Classification is a fallback that must be *earned by evidence*, not a choice. |
| **R-4** | Audit §16(6) and the ladder's `AC-117` posed Safari as **either** automated WebKit green **or** a standing dated manual check. | **Both.** Automate reliable functional WebKit coverage **and** retain a dated real-Safari visual check for WebGL behaviours automation cannot faithfully measure. | Stricter than either branch alone, and it splits the requirement by *what is being measured* rather than by convenience. |
| **R-5** | Mission proposal §5 left objective input open: "chosen from a small curated set or entered as free text within a validated envelope." | **Bounded free text inside a strict typed and validated envelope**, rejecting objectives outside the supported template. | Selects the harder option, which is why R-1's workspace restriction is load-bearing rather than incidental. |

---

## 3. `FOUNDATION_VERSION.md`'s "Future Registry promotion" assumption

`FOUNDATION_VERSION.md` § "Mission completion status" reads: *"Any further implementation work requires a new reviewed mission baseline (Future Registry promotion)."*

The mission proposal §9(3) identified the problem precisely: **V1.1 promotes nothing from the Future Registry.** It completes what V1 already scoped — an operator submitting an objective, a backend that drives a build, a real execution inside that build. The parenthetical assumed every future baseline would originate as a registry promotion, and the document has no category for a baseline that does not.

**Resolution.** Decision 3 establishes V1.1 as a **new reviewed mission baseline that promotes nothing from the Future Registry**. The parenthetical is a clarification of operational metadata, corrected under decision 6, not a change to the change-control rule itself. Registry promotion remains *one* route to a new baseline; it is not the only one.

This matters beyond V1.1: the roadmap's later epochs (V1.3 onward) **do** contemplate promoting the Opportunity Center. Those promotions remain future acts requiring their own reviewed missions. Nothing is promoted here.

---

## 4. Agreements confirmed across the four documents

Recorded so that consistency is verified rather than assumed.

- **Ladder namespace.** Mission proposal §8, ladder proposal §1, and roadmap §10 all specify `AC-101` onward, disjoint from `FBL-*`, with identifiers never reused and post-closure work inserted as lettered sub-rungs. Consistent, and consistent with the V1 ladder's own stated discipline.
- **Later-epoch namespaces.** Roadmap §10 proposes `RB-201`, `OC-301`, `LD-401`, `PP-501`, `CO-601`. These match the namespaces authorized for the staged program. Consistent.
- **Preservation set.** Mission proposal §7 and ladder proposal §6 list the same invariants: deterministic mock runtime retained as a selectable mode with `v1-canonical-run.json` byte-identical, backend authority never bypassed, `stage.validation_passed` unreachable via Builder or frontend, R3–R5 unrepresentable, runtime cannot self-certify, every V1 acceptance behaviour still passing, V1 evidence never edited, no Future Registry promotion. Consistent, and carried into the ratified baseline unchanged.
- **Exclusions carry forward.** Mission proposal §6 states every exclusion in `docs/01-mission/exclusions.md` carries forward unchanged and adds more. Confirmed; the V1.1 exclusions document restates all of them.
- **The audit's own standing.** Audit §0 states it has no authority and amends nothing. Confirmed. Ratification of this baseline is what makes specific findings actionable, and only through the rung that owns them (§6 below).
- **Roadmap non-authority.** Roadmap §12(3) asks that the roadmap and the Future Registry entry remain non-authoritative. Confirmed for V1.1: no rung below `AC-120` may cite either as a requirements source.

---

## 5. New observations from Phase 0 — not present in any of the four documents

These were found while executing `AC-101` and reconciling. They are recorded here because they are true and because none of the four documents contains them.

### N-01 — The audit's `1.0-rc1` header count is wrong — **MINOR / documentation correction**

Audit PV1-004 states "**Fourteen** active documents carry the stale `Foundation: 1.0-rc1` header." Its own enumerated list contains **thirteen**, and `grep` over the tree confirms thirteen. The mission proposal §9(6) repeats "fourteen." The list is right; both counts are wrong. Corrected in `AC-101`, which changed exactly thirteen header lines (13 files, 13 insertions, 13 deletions, zero body edits).

### N-02 — The decision lists disagree — **MAJOR / resolved above**

See §1. Recorded as a numbered observation so it is findable from this list alone.

### N-03 — The repository does not pass its own `format` gate — **MINOR / hardening**

`pnpm format` (`prettier --check .`) fails on **28 files**, including source under `apps/api/src/`, `packages/contracts/src/`, `packages/persistence/src/`, and `apps/agent-city/src/`. Verified to be **pre-existing**: the identical 28-file failure occurs with `AC-101`'s changes stashed. No audit finding covers it. `format` is not one of the four gates the V1 ladder required (`typecheck`, `lint`, `test`, `build`), which is why it went unnoticed — but `package.json` declares it, `CONTRIBUTING.md` implies it, and a declared gate that has never passed is exactly the class of problem the Post-V1 audit exists to surface.

**Owner:** `AC-119`. **Prohibited shortcut:** running `prettier --write` across the tree inside an unrelated rung, which would bury a 28-file source diff inside a documentation or feature commit.

### N-04 — Application code landed on `main` mid-Phase-0 — **MAJOR / operator-authored, open decision**

Commit **`e5378aa`** ("feat: enrich Agent City architectural world") was authored and pushed by the operator (`mikemiller1425-design`) at **13:17 on 2026-08-03**, between `AC-101`'s pre-rung baseline test run (13:05) and its verification run (14:00). It adds **437 lines across four components**: `apps/agent-city/src/components/world/{Environment,OperationalBuilding,Residence,Road}.tsx`.

This is the operator's own work and their authority to commit. It is recorded, not disputed. Its consequences are:

1. **`AC-101`'s baseline comparison was imprecise** and has been corrected in `CHANGELOG.md`. Both test runs returned 813 passed / 0 failed, but they measured different source trees. `AC-101` itself changed no source; `e5378aa` did.
2. **The browser, WebKit, and performance suites have not been re-run against it.** Only the 813 unit/integration tests have. Those are DOM and logic tests; they do not measure frame time.
3. **It interacts directly with the `AC-117` → `AC-118` gate.** The ladder routes all cohesive visual work through `AC-118`, gated on a fresh `AC-117` performance baseline, *specifically because* PV1-040 records the 95th-percentile frame time already implying **~36.9 FPS against a 45 FPS target** at all three viewports. Added world geometry is precisely the change that gate exists to protect against.
4. **It partially stales PV1-042**, which describes the neighborhood as entirely untextured primitive geometry with an empty `assets/`.

**Open decision D-8** (recorded in the decision record as pending, non-blocking for Phase 0): does `e5378aa` become pre-existing baseline state that `AC-118` builds upon, or work that `AC-118` reviews and may supersede? Either way, **`AC-117` must measure performance against a tree that includes it**, and `AC-118` may not begin until that measurement exists. This does not block Phase 0 and is raised again when Phase 1 reaches `AC-117`.

### N-05 — A tracked generated file drifts under tooling — **MINOR / hygiene**

`apps/agent-city/next-env.d.ts` is tracked, is marked "This file should not be edited," and is regenerated by Next.js tooling. During Phase 0 it drifted (`import "./.next/types/routes.d.ts"` → `import "./.next/dev/types/routes.d.ts"`) when the test suite ran, was reverted, and then remained stable across a subsequent `build` and full `test`. Typecheck passes either way. Not covered by PV1-047, which surveyed tracked generated artifacts and found only the six Playwright baselines and two `diff.patch` files.

**Owner:** `AC-119`.

### N-06 — All six Playwright screenshot baselines are stale — **MAJOR / recorded, not regenerated**

*Added at `AC-102` ratification, 2026-08-03.*

The six baselines under `apps/agent-city/e2e/shell-realtime-connection.spec.ts-snapshots/` were captured at `40c3713` (2026-08-01). Measured at zero tolerance on 2026-08-03, **all six differ** from current output (30,127–49,360 pixels each, ratios 0.01–0.02). The suite nonetheless **passes**, because the spec's `maxDiffPixelRatio: 0.02` absorbs every one of them.

Four independent causes, **three predating the V1.1 implementation work**: `6dd9fa8` (FBL-035, removed the top-bar placeholder text), `ca5b339` (FBL-021A, AppShell changes), `e5378aa` (the operator's 437-line world enrichment — see N-04), and `9a6f7ee` (`AC-103P`, the objective control in the left navigator).

**No baseline was updated, accepted, or regenerated**, by operator instruction. Recorded so the staleness is not later attributed to a single change. Per-baseline pixel counts are in `docs/audits/agent-city-v1.1-rung-label-reconciliation.md` § 6.

**Owner:** `AC-117` or `AC-119`; regeneration requires explicit operator approval.

### N-07 — Four commits carry a rung label that does not match their work — **MAJOR / resolved at ratification**

*Added at `AC-102` ratification, 2026-08-03.*

`9a6f7ee`, `e1fa301`, `9345a04`, and `7b536a9` are labelled "AC-103". Under the ratified ladder `AC-103` is **Finding 6 resolution**, which none of them touched. Resolved by **D-9**: the commits are preserved as `AC-103P`, a pre-ladder proof; `AC-103` keeps its ladder meaning and remains not started. History is not rewritten — the label is corrected by mapping in `docs/audits/agent-city-v1.1-rung-label-reconciliation.md`.

**Owner:** resolved. Residue tracked at `AC-105`–`AC-108`.

---

## 6. Finding disposition — every audit finding has an owning rung

All 53 findings, so none is silently dropped. "Closed" means resolved at the time of this record; every other finding is assigned, not deferred indefinitely.

| Finding | Subject | Owner | State |
| --- | --- | --- | --- |
| PV1-001 | `README.md` declares implementation blocked | `AC-101` | **Closed** |
| PV1-002 | `active-mission.md` pre-implementation status | `AC-101` | **Closed** |
| PV1-003 | `CONTRIBUTING.md` prohibits application code | `AC-101` | **Closed** |
| PV1-004 | Stale `1.0-rc1` headers (13, not 14 — see N-01) | `AC-101` | **Closed** |
| PV1-005 | `implementation-plan.md` marked blocked | `AC-101` | **Closed** |
| PV1-006 | Four package READMEs claim no implementation | `AC-101` | **Closed** |
| PV1-007 | `apps/agent-city/README.md` stops at FBL-026 | `AC-101` | **Closed** |
| PV1-008 | `apps/api/README.md` security caveat false both ways | `AC-101` | **Closed** |
| PV1-009 | Handoff 002 names FBL-003 as next | `AC-101` | **Closed** |
| PV1-010 | Verified capability inventory (INFO) | — | No action |
| PV1-011 | Workflow exists only as a frontend script | `AC-109`, `AC-111` | Assigned |
| PV1-012 | Command bar silently no-ops in backend mode | `AC-106` | Assigned |
| PV1-013 | `building.selected` is mock-only | `AC-106` | Assigned |
| PV1-014 | Warehouse upgrade auto-approved in demo | `AC-113` | Assigned |
| PV1-015 | Batch intake mock-only by specification (INFO) | — | No action |
| PV1-016 | Backend authority unreachable in normal operation | `AC-105` | Assigned |
| PV1-017 | No test exercises frontend against live `apps/api` | `AC-114` | Assigned |
| PV1-018 | Demonstrations depend on shipped seed scripts | `AC-115` | Assigned |
| PV1-019 | Real Claude Code targets one hardcoded fixture | `AC-111` | Assigned |
| PV1-020 | Playwright baselines are platform-pinned | `AC-117`, `AC-119` | Assigned |
| PV1-021 | Canonical run is the only regression baseline (INFO) | `AC-109` | Assigned (state expectation) |
| PV1-022 | Real Claude Code path is out-of-band | `AC-111` | Assigned |
| PV1-023 | Re-running FBL-028 overwrites approved evidence | `AC-115` | Assigned |
| PV1-024 | Cited evidence artifacts not in the repository | `AC-102` (decision 4), `AC-119` | **Clarification issued** |
| PV1-025 | There is no orchestrator | `AC-109` | Assigned |
| PV1-026 | No operator surface for submitting an objective | `AC-107`, `AC-108` | Assigned |
| PV1-027 | No single documented command starts Foundry | `AC-104` | Assigned |
| PV1-028 | Runtime mode fixed at build time | `AC-105` | Assigned |
| PV1-029 | No `.env.example` | `AC-104` | Assigned |
| PV1-030 | No CI; `scripts/` empty | `AC-119` | Assigned |
| PV1-031 | Reserved directories empty | `AC-104`, `AC-118` | Assigned |
| PV1-032 | No packaging or deployment story (INFO) | — | No action |
| PV1-033 | Write confinement is detection, not prevention | `AC-116` (bounded by decision 2) | Assigned |
| PV1-034 | Controlled run reaches credential store and network | `AC-116` | Assigned |
| PV1-035 | API unauthenticated for reads, permissive origins | `AC-116` | Assigned |
| PV1-036 | Credentials per-boot, stdout, non-expiring | `AC-105`, `AC-116` | Assigned |
| PV1-037 | No transport security or rate limiting | `AC-116` | Assigned |
| PV1-038 | No accessibility scanner or screen-reader pass | `AC-117` | Assigned |
| PV1-039 | Safari rests on one unwitnessed observation | `AC-117` (decision 7) | Assigned |
| PV1-040 | Frame-time tail near target, one machine | `AC-117`, `AC-118` | Assigned |
| PV1-041 | Browser suite needs a documented worker cap | `AC-117` | Assigned |
| PV1-042 | Neighborhood is untextured primitive geometry | `AC-118` | Assigned (partly staled by N-04) |
| PV1-043 | **Finding 6** — three WebKit failures | `AC-103` (decision 5) | Assigned |
| PV1-044 | Cited evidence databases untracked (= PV1-024) | `AC-119` | Assigned |
| PV1-045 | Evidence directory is a live write target (= PV1-023) | `AC-115` | Assigned |
| PV1-046 | `CHANGELOG.md` is a single 143 KB file | `AC-119` | Assigned |
| PV1-047 | Minor tree noise | `AC-119` | Assigned |
| PV1-048 | Falsehoods concentrated in entry points | `AC-101` | **Closed** |
| PV1-049 | No real work occurs in normal operation | `AC-113` (mission outcome) | Assigned |
| PV1-050 | "Operator submits objective" cannot be performed | `AC-108` | Assigned |
| PV1-051 | "Operator approves upgrade" not performed | `AC-113` | Assigned |
| PV1-052 | Backend mode presents an empty, inoperable world | `AC-106`, `AC-108` | Assigned |
| PV1-053 | Controlled Claude Code authorization is spent (INFO) | `AC-110`, `AC-111` | Assigned |
| **N-01** | Audit header count wrong | `AC-101` | **Closed** |
| **N-02** | Decision lists disagree | `AC-102` | **Closed** |
| **N-03** | Repository fails its own `format` gate | `AC-119` | Assigned |
| **N-04** | Operator world code landed mid-Phase-0 | `AC-117`, `AC-118` (decision D-8) | **Open decision** |
| **N-05** | `next-env.d.ts` drifts under tooling | `AC-119` | Assigned |

**Coverage check:** 9 findings closed at `AC-101`; 1 clarification issued at `AC-102`; 4 INFO findings need no action; 39 assigned to a named later rung; 1 open decision. No finding is unowned.

---

## 7. Contradictions the audit recorded without resolution — disposition

Audit §18 listed five contradictions and deliberately did not resolve them. Their status now:

1. **Two priority-1 documents disagree.** **Resolved** at `AC-101`. `active-mission.md` now records the mission complete and no longer contradicts `FOUNDATION_VERSION.md`.
2. **`v1-acceptance.md` "documentation matches implementation" vs. audit §14.** **Recorded, not overturned.** The FBL-035 approval stands; the operator gave it and it was theirs to give. `AC-120` carries the stricter requirement that documentation match implementation *including status metadata* — the clause V1 satisfied only narrowly.
3. **FBL-003 deliverables vs. tree.** **Recorded as historical only** in `AC-101`'s CHANGELOG entry. `FBL-003` is not reopened. `scripts/` is populated at `AC-104` as new work, not as a retroactive closure.
4. **`apps/agent-city/README.md` vs. `commands.ts`.** **Resolved** at `AC-101`: the README now states plainly that the command-bar controls send types absent from the closed vocabulary and fail silently in backend mode. The *behaviour* is repaired at `AC-106`.
5. **Principle 3a's condition vs. the default runtime.** **Assigned.** Principle 3a reads "until a persisted backend exists"; a backend exists. `AC-105` makes backend mode reachable at run time and `AC-107` records the principle's status. Under decision 6 this is a status clarification only — the mock runtime is retained as a selectable mode, so no meaning changes.

---

## 8. Specification changes V1.1 requires — confirmed and owned

Audit §17 recorded seven required changes to frozen documents. Each is confirmed and assigned; none is made by this record.

| Document | Change | Owner |
| --- | --- | --- |
| `docs/02-specification/domain-model.md` | `Build` § "V1 limits" reads "demo objective fixed"; a real bounded objective requires this to change | `AC-107` |
| `packages/contracts/src/commands.ts` + `domain-model.md` | Per-command parameter schemas, replacing envelope-only validation for the objective/plan/authorization commands specifically | `AC-107` |
| `docs/02-specification/event-model.md` | At least one new operator event family (plan produced, execution authorized) | `AC-107` |
| `docs/02-specification/v1-acceptance.md` | Superseded by `docs/02-specification/v1.1-acceptance.md`; V1's `F-01`–`F-12` / `V-01`–`V-08` remain the frozen V1 record | `AC-102` (authored) |
| `docs/01-mission/v1-scope.md` § "V1 Build Stages" | **No change.** V1.1 keeps the seven fixed stage names, per the audit's own recommendation | — |
| `docs/00-foundry/principles.md` 3a | Condition has lapsed; status stated, no meaning change, mock retained as a selectable mode | `AC-107` |
| `docs/01-mission/exclusions.md` | **Unchanged.** Every V1 exclusion carries forward and V1.1 adds more | — |

---

**Companion documents:**
`docs/01-mission/agent-city-v1.1-decision-record.md` · `docs/01-mission/agent-city-v1.1-mission.md` · `docs/03-architecture/agent-city-v1.1-build-ladder.md`
