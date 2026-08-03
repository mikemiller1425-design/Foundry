# Agent City V1.1 — Operator Decision Record

**Type:** Authoritative decision record
**Date:** 2026-08-03
**Rung:** `AC-102` (V1.1 mission baseline ratification)
**Decided by:** mikemiller1425-design (human operator)
**Supersedes for this purpose:** `docs/audits/agent-city-post-v1-truth-audit.md` §16 · `docs/proposals/agent-city-v1.1-mission-proposal.md` §9

---

## 0. Standing

This is the **single authoritative record of the operator decisions that unblock the V1.1 mission baseline.** There are **seven**, not six — plus **D-8** (open) and **D-9** (decided at ratification).

Both source documents listed six, and **they were not the same six** — the audit omitted *objective input form*, the mission proposal omitted *Safari coverage standard*. The union is exactly seven. `docs/audits/agent-city-post-v1-reconciliation.md` §1 shows the derivation. Those two sections remain in their documents unedited as historical drafting; where they conflict with this record, **this record governs**.

Every decision below is recorded with its scope and its consequence, because several are **narrower or stricter than any option the source documents offered** — a later reader must not resolve an ambiguity by reaching back to a proposal's menu of alternatives.

This record amends no Foundry principle, domain term, or ADR, promotes nothing from `docs/04-future/registry.md`, and reopens no `FBL-*` rung.

---

## Decision 1 — Objective input form

> **Bounded free text inside a strict typed and validated envelope. Objectives outside the supported template are rejected.**

**Sources:** mission proposal §9(1), §5 ("Open for operator decision"). Absent from audit §16.

**What this settles.** The mission proposal left open whether an objective is chosen from a small curated set or entered as free text. The curated option was the safer one and demonstrates less. **Free text within a validated envelope is selected** — it is the actual mission outcome, and a curated picker would not prove that an operator can express an intention.

**Consequences.**
- `AC-107` must define a typed objective envelope in `packages/contracts` **first**, with negative schema tests: an over-long objective, a disallowed workspace, an R3+ risk class, and an unknown stage name must each be **unrepresentable or rejected**.
- Rejection must be structured and visible, with zero mutation — never a silent truncation or a best-effort reinterpretation.
- "Supported template" is a **closed** concept. Widening it later is a scope amendment, not an implementation detail.
- This decision is what makes Decision 2's workspace restriction load-bearing rather than incidental: free-text objectives with an operator-nominated real directory would compound two risks at once.

---

## Decision 2 — Real-build workspace policy

> **Foundry-created disposable workspaces only. Existing repositories and operator-nominated real project directories are excluded.**

**Sources:** audit §16(2), PV1-033; mission proposal §9(2).

**What this settles.** The audit offered three options — (a) Foundry-created disposable, (b) operator-nominated scratch directory, (c) real project repository. The mission proposal recommended (a) and recommended excluding (c), **leaving (b) open**. This decision takes **(a) only**, closing (b) as well.

**Rationale on the record.** Write confinement for a real Claude Code run is **post-hoc detection, not prevention** (PV1-033). A `git diff` after the fact detects an out-of-scope write and fails the run; nothing in Foundry constrains the process's file descriptors while it executes. That control is defensible for a disposable directory Foundry created and will destroy. It does not generalize to a directory the operator cares about.

**Consequences.**
- `AC-111` provisions and tears down its own workspace. Running against a pre-existing project directory, the Foundry repository itself, or the operator's home is **prohibited work**, not a discouraged option.
- Operator-nominated real project directories become a **V1.1 exclusion** (see `docs/01-mission/agent-city-v1.1-exclusions.md`), and remain excluded through V1.5 unless a separately reviewed mission changes it.
- `AC-116` may still pursue OS-level confinement, but may **not** claim sandboxing that does not exist, and may not use its absence to argue for widening the workspace.

---

## Decision 3 — Mission status of V1.1

> **V1.1 is a new reviewed mission baseline, not an amendment to V1.**

**Sources:** audit §16(4); mission proposal §9(3) and its recommendation.

**What this settles.** `FOUNDATION_VERSION.md` anticipated that further implementation would require "a new reviewed mission baseline (**Future Registry promotion**)." V1.1 **promotes nothing from the Future Registry** — it completes what V1 already scoped. The document had no category for that.

**Consequences.**
- A new mission baseline is established: `docs/01-mission/agent-city-v1.1-mission.md`, `agent-city-v1.1-scope.md`, `agent-city-v1.1-exclusions.md`, with acceptance at `docs/02-specification/v1.1-acceptance.md` and the ladder at `docs/03-architecture/agent-city-v1.1-build-ladder.md`.
- `docs/01-mission/active-mission.md` remains the **V1** mission record, closed and complete. It is not rewritten into a V1.1 document; it gains a pointer to the new active mission.
- `FOUNDATION_VERSION.md`'s parenthetical is clarified: **registry promotion is one route to a new baseline, not the only one.** This is operational-metadata clarification under Decision 6, not a change to the change-control rule.
- The V1 Build Ladder stays closed. `FBL-*` identifiers are never reused, renumbered, reopened, or re-graded. V1.1 work uses the disjoint `AC-1xx` namespace.

---

## Decision 4 — Evidence retention

> **Do not commit mutable SQLite runtime databases. Create a new dated evidence clarification that cites durable retained JSON/log/report artifacts and supersedes inaccurate citations — without rewriting historical approvals.**

**Sources:** audit §16(1), PV1-024, PV1-044; mission proposal §9(4).

**What this settles.** Both source documents posed a **binary**: commit the two `agentrun.sqlite` files via a `.gitignore` exception, **or** amend the approval record. This decision takes **neither**, and adds a third path the documents did not offer.

**Rationale on the record.** Committing mutable runtime databases puts binary state under `docs/` and does not actually make it verifiable — a SQLite file's checksum is a property of one machine's write ordering, not of the run's meaning. Amending an approval record edits an append-only artifact. The third path preserves principle 18 more strictly than "amend" would: **corrections occur through new records, never edits.**

**Consequences.**
- `docs/evidence/fbl-028/agentrun.sqlite` and `docs/evidence/fbl-035/f12-verification/agentrun.sqlite` **stay untracked**. The `*.sqlite` rule in `.gitignore` is correct and stays.
- A new dated clarification **is owed** — recording which cited artifacts are durably retained in the repository and which are not, and superseding the inaccurate citations. It does **not** yet exist; writing it is `AC-119`'s deliverable. *(Corrected at ratification: this line previously named a path in the present tense as though the file were already written.)*
- **`docs/evidence/fbl-035/operator-final-approval.md` and every other historical approval record are not edited.** The approval stands exactly as given.
- `AC-119` implements the retention policy going forward so future runs cite only durable artifacts, and verifies it from a fresh clone.

---

## Decision 5 — Finding 6 closure standard

> **Diagnosis is mandatory. Fix real product and test defects. If retained reproduction evidence proves an automation/tool limitation, formal classification plus a standing dated real-browser check may close that portion.**

**Sources:** audit §16(5), PV1-043; mission proposal §9(5).

**What this settles.** The audit asked whether "diagnosed and fixed" is required **or** "diagnosed and formally classified with a reproduction artifact" suffices. This decision is **stricter than the softer branch**: classification is a fallback that must be *earned by retained evidence*, not a choice available on grounds of difficulty.

**The three failures.** `apps/agent-city/e2e/shell-selection.spec.ts:150` at 5120×1440 and 3840×1080, and `apps/agent-city/e2e/shell-event-to-world-mapping.spec.ts:119` at 5120×1440. WebKit stood at 372 passed / 6 failed at approval. **No reproduction artifact is currently retained anywhere** — `test-results/` is git-ignored.

**Consequences for `AC-103`.**
- Every one of the three must reach a **named root cause**. "Flaky" is not a root cause.
- A genuine product defect or a genuine test defect must be **fixed**.
- Classification closes a portion **only** with retained reproduction evidence — trace, video, console — proving the failure is an artifact of the automation or tooling rather than of the product, **and** only together with the Decision 7 real-browser check.
- **Prohibited:** closing by reclassification without diagnosis; deleting, skipping, or retrying the tests to make them green; raising timeouts as a substitute for root cause; editing the FBL-035 approval record.
- Two of the three sit adjacent to the camera-settling race that `FBL-034`/`FBL-021A` repaired, so a fourth instance of that class is plausible — and so is a real WebKit defect in camera focus and in timeline/world correspondence. Neither may be assumed.
- `AC-103` **must close before `AC-111`**: a real execution is not introduced over an unexplained browser failure.

---

## Decision 6 — Frozen status and version corrections

> **Treat stale status and `1.0-rc1` headers as clarifications under change control. Record them in `CHANGELOG.md`. Do not alter substantive Foundation meaning.**

**Sources:** audit §16(3), PV1-002, PV1-004; mission proposal §9(6).

**What this settles.** Correcting `active-mission.md` and the stale headers touches Foundation 1.0 documents. `FOUNDATION_VERSION.md` § "Change control" permits clarifications that do not change meaning to proceed with a CHANGELOG entry. **These qualify as clarifications**; no formal amendment is required.

**The boundary, stated exactly.** What may move is *status metadata*: version headers, completion status, blocked/unblocked state, pointers to current documents. What may **not** move is any principle, domain term, ADR, mission scope, acceptance criterion, or specification meaning. A correction that changes what a document *requires* is an amendment, not a clarification, and is out of scope for this decision.

**Consequences.**
- `AC-101` executed under this decision and is complete: 13 header lines (not 14 — see reconciliation N-01), the `README.md` status table and "Implementation blocked" section, `CONTRIBUTING.md` status and rule 8, `active-mission.md` status, four package READMEs, both app READMEs, and banners on `implementation-plan.md` and handoff 002.
- Every such correction carries a CHANGELOG entry stating what moved and that meaning did not.
- `active-mission.md` carries a dated banner recording explicitly that its mission *definition* is unchanged in substance.

---

## Decision 7 — Safari coverage standard

> **Automate reliable functional WebKit coverage. Retain a dated real-Safari visual check for WebGL behaviours automation cannot faithfully measure.**

**Sources:** audit §16(6), PV1-039; absent from mission proposal §9.

**What this settles.** The audit posed this as **either** automated WebKit green **or** a standing dated manual check. This decision requires **both**, and — importantly — splits the requirement by *what is being measured* rather than by convenience.

**Rationale on the record.** Chromium has 378 automated assertions across three viewports; Safari has **one unwitnessed human session** on one machine. A required browser with no reproducible coverage means any Safari regression is invisible until someone happens to look. But Playwright's WebKit build is not Safari, and some WebGL behaviour genuinely cannot be measured faithfully through it — which is exactly the ambiguity that let Finding 6 stay open.

**Consequences for `AC-117`.**
- **Functional** WebKit coverage must be automated and reliable — reliability being a property of the suite, not of the machine it runs on.
- **Visual WebGL** behaviours that automation cannot faithfully measure get a **standing, dated** real-Safari check with a recorded method, refreshed rather than performed once.
- The split must be **explicit**: every behaviour is assigned to automation or to the manual check, with a stated reason. A behaviour may not fall into the manual bucket merely because automating it is inconvenient.
- Interacts with Decision 5: a Finding 6 portion closed as an automation limitation lands in the manual bucket **and** must carry its retained reproduction evidence.

---

## Open decisions — recorded, not blocking Phase 0

### D-8 — Disposition of `e5378aa` (operator world code)

**Status: OPEN.** Raised when Phase 1 reaches `AC-117`.

Commit `e5378aa` ("feat: enrich Agent City architectural world") was authored and pushed by the operator at 13:17 on 2026-08-03, mid-Phase-0: 437 lines across `apps/agent-city/src/components/world/{Environment,OperationalBuilding,Residence,Road}.tsx`. See reconciliation **N-04**.

**The question:** does `e5378aa` become pre-existing baseline state that `AC-118` builds upon, or work that `AC-118` reviews and may supersede?

**What holds regardless of the answer:**
- `AC-117` **must** measure performance against a tree that includes it. PV1-040 records the 95th-percentile frame time already implying ~36.9 FPS against a 45 FPS target; added world geometry is exactly what that gate protects against.
- `AC-118` **may not begin** until that measurement exists.
- The browser, WebKit, and performance suites have **not** been run against it. Only the 813 unit/integration tests have, and those do not measure frame time.

This does not block Phase 0, and the work is not disputed or reverted — it is the operator's own and their authority to commit.

---

### D-9 — Disposition of the `AC-103` rung label

**Status: DECIDED — 2026-08-03, at ratification.**

Four commits on `main` (`9a6f7ee`, `e1fa301`, `9345a04`, `7b536a9`) carry the label "AC-103". Under the ratified ladder `AC-103` is **Finding 6 resolution**, which none of them touched.

> **Decision: preserve `AC-103` as Finding 6 resolution. Record the four commits as `AC-103P` — a pre-ladder proof awaiting formal validation under the ratified ladder.**

**What this settles.** Two options were on the table: redefine `AC-103` as the shipped work and move Finding 6 to a fresh identifier, or keep `AC-103` meaning Finding 6 and give the shipped work a distinct marker. The operator selected the latter. Finding 6 is an open V1 debt item and keeps its assigned rung; the shipped work takes the `P` suffix, marking work that predates the ladder rather than a position within it.

**Consequences.**
- `AC-103` remains **not started**, and must close before `AC-111`.
- `AC-103P` closes **no** rung. It anticipates parts of `AC-105`–`AC-108`; each of those rungs must still run and judge the code against its own acceptance criteria.
- Pushed history is **not** rewritten. The label is corrected by mapping, in `docs/audits/agent-city-v1.1-rung-label-reconciliation.md`.
- `docs/evidence/ac-103/` was renamed to `docs/evidence/ac-103p/`, freeing `ac-103/` for Finding 6's traces.
- Identifiers remain never-reused, as § 1 of the ladder requires.

---

## Summary

| # | Decision | Selected |
| --- | --- | --- |
| 1 | Objective input form | Bounded free text in a strict typed validated envelope; out-of-template rejected |
| 2 | Real-build workspace | Foundry-created disposable only; existing repos and nominated real directories excluded |
| 3 | Mission status of V1.1 | New reviewed mission baseline; promotes nothing from the Future Registry |
| 4 | Evidence retention | No mutable SQLite committed; new dated clarification citing durable artifacts; historical approvals unedited |
| 5 | Finding 6 standard | Diagnosis mandatory; fix real defects; evidenced automation-limitation classification + standing check may close a portion |
| 6 | Frozen status corrections | Clarifications under change control, recorded in CHANGELOG; no substantive meaning altered |
| 7 | Safari coverage | Automated functional WebKit **and** a standing dated real-Safari visual check, split by what is measured |
| D-8 | Disposition of `e5378aa` | **OPEN** — non-blocking; resolved at `AC-117` |
| D-9 | `AC-103` rung label | `AC-103` stays Finding 6; the shipped work is preserved as `AC-103P`, a pre-ladder proof |

---

**Companion documents:**
`docs/audits/agent-city-post-v1-reconciliation.md` · `docs/01-mission/agent-city-v1.1-mission.md` · `docs/03-architecture/agent-city-v1.1-build-ladder.md`
