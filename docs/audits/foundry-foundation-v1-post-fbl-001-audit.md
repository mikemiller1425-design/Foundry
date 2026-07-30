# Foundry Foundation v1.0-rc1 — Independent Post-FBL-001 Audit

**Audit date:** 2026-07-30
**Auditor:** Claude Code (independent specification auditor role, per FBL-002 instruction)
**Audit commit reviewed:** `377547a` — "docs: resolve Foundry Foundation audit findings"
**Scope:** Active documents under `FOUNDATION_VERSION.md`, `README.md`, `docs/00-foundry/`, `docs/01-mission/`, `docs/02-specification/`, `docs/03-architecture/`, plus `docs/audits/foundry-foundation-v1-audit.md` and `docs/audits/foundation-v1-fbl-001-closure-matrix.md`
**Excluded from authority:** `docs/archive/foundation-v0/`, `docs/04-future/registry.md` (consulted only for leakage detection)
**Relationship to FBL-002:** This document is the independent "fresh consistency audit" required by FBL-002 (`docs/03-architecture/foundry-build-ladder.md`). It does **not** itself constitute operator approval or Foundation promotion. It does not treat the FBL-001 closure matrix as ground truth — every claim in that matrix was re-derived from the amended documents directly.

---

## 1. Executive verdict

**PASS.**

Independently re-deriving each of the ten original findings (B-01–B-04, M-01–M-06) against the current text of `v1-scope.md`, `v1-acceptance.md`, `domain-model.md`, `event-model.md`, `world-model.md`, `interface-model.md`, and `principles.md` confirms all ten are substantively closed, with no residual circularity, no undefined entity, and no vocabulary mismatch. The FBL-001 closure matrix's specific factual claims (file locations, quoted resolution text, the `git diff --check` lint claim, the `requirement.completed` grep claim) were independently verified and found accurate — no inaccurate closure claim was identified.

This audit finds **zero open BLOCKER findings** and **zero open MAJOR findings**. A small number of **MINOR** and **OPTIONAL** observations are recorded below (§9); none were introduced by the FBL-001 amendment, all pre-date it, and none block FBL-002 under the audit's own stated passing criteria.

This satisfies the mechanical passing criteria for FBL-002 (zero open BLOCKER, zero open MAJOR, all ten original findings verified closed, no inaccurate closure-matrix claim). Per this task's explicit scope boundary, **this audit does not approve Foundation 1.0, does not modify `FOUNDATION_VERSION.md`, and does not unblock the frontend handoff** — those remain separate operator actions under FBL-002 §6(d)–(g).

---

## 2. Closure verification table — BLOCKER findings

| ID | Original problem | Independently verified resolution location | Verified? | Residual risk |
| --- | --- | --- | --- | --- |
| **B-01** | Workflow order (transfer vs. approval vs. QA) ambiguous; earlier draft fix was itself circular (`transfer.ready` required stage completion while `deployment_package` — whose own work *is* the gated transfer — completed only after `transfer.completed`) | `v1-scope.md` §§ "Required workflow" (canonical sequence line + reordered steps 9–16), "Transfer and approval scope", "V1 Build Stages"; `v1-acceptance.md` journey steps 9–13 + "Transfer detail" note; `domain-model.md` Required Invariant 3, `Transfer` invariants; `event-model.md` `transfer.ready`, `stage.started`, `stage.completed`; `world-model.md` QA/Road entries | **Yes** — traced the full precondition graph by hand (see §4); no node's precondition depends on itself, directly or transitively | None found |
| **B-02** | No enumerated V1 `BuildStage` list; intentional-failure and Claude Code stages unnamed | `v1-scope.md` § "V1 Build Stages" (7-row table); `domain-model.md` `BuildStage` → V1 limits | **Yes** — table names exactly seven stages in sequence, identifies `frontend_implementation` as the intentional-failure stage and `backend_implementation` as the sole `claude_code` stage | None found |
| **B-03** | `Revision` referenced by invariants/events but never defined as an entity | `domain-model.md` new § "Revision" (full entity: fields, lifecycle, invariants, commands, events); `event-model.md` new § "Revision" (`revision.requested/started/completed`); `glossary.md` new entry | **Yes** — entity is fully specified; `BuildStage` invariant and `stage.failed`/`approval.revision_requested` text now point at it | None found |
| **B-04** | `Vehicle` and `AgentRun` referenced but undefined | `domain-model.md` new §§ "Vehicle" and "AgentRun"; `event-model.md` new § "AgentRun"; `glossary.md` new entries; `world-model.md` "Utility vehicle" cross-reference | **Yes** — both entities fully specified; `AgentRun.outputArtifactIds` matches `agentrun.completed` payload exactly; `Vehicle` emits no independent events, consistent with glossary/world-model | None found |

## 3. Closure verification table — MAJOR findings

| ID | Original problem | Independently verified resolution location | Verified? | Residual risk |
| --- | --- | --- | --- | --- |
| **M-01** | No enumerated `commandType` values for demo controls | `event-model.md` § "Demo control commands" (6-row exhaustive table); `interface-model.md` "Persistent command input" cross-reference | **Yes** — exhaustive, closed set; reset/replay explicitly the only history-altering commands | None found |
| **M-02** | Disconnect/reconnect required but no event vocabulary | `event-model.md` `system.health_changed` → `newHealth` and `reasons[]` vocabularies; `interface-model.md` "Connection / stale state" cross-reference | **Yes** — `connection_lost`/`connection_restored` reasons fully and exhaustively cover F-10 | None found |
| **M-03** | `Build.ready`/`paused`+Resume, `BuildStage.ready`, `Transfer.blocked`, `Agent.returnHome` had no matching events | `event-model.md` new `build.ready`, `build.resumed`, `stage.ready`, `transfer.blocked`, `agent.returned_home`; `domain-model.md` "Emitted events" lists updated for `Agent`, `Build`, `BuildStage`, `Transfer` | **Yes** — all five now present in both the event vocabulary and the owning entity's emitted-events list | See §9 (other pre-existing state/event gaps not part of M-03's original scope) |
| **M-04** | `Requirement` status `passed` vs. event `requirement.completed` mismatch | `event-model.md` `requirement.passed` (renamed); `domain-model.md` `Requirement` emitted events | **Yes** — grep confirms `requirement.completed` no longer appears as a live reference anywhere in active docs (only inside the original audit text and the closure matrix's own description of the fix) | None found |
| **M-05** | No rule reconciling "backend owns truth" with the pre-backend mock-runtime phase | `principles.md` new principle 3a | **Yes** — text explicitly preserves "frontend cannot forge outcomes" while naming the mock engine as stand-in authority | None found |
| **M-06** | "10 successful packages" undefined; single demo build risked either being unreachable or over-counting across three transfer legs | `domain-model.md` `Upgrade` → "Counting rule" (seeded 9 + exactly-one-per-build = 10) | **Yes** — arithmetic and single-count-per-build rule are both explicit and mutually consistent with the B-01 three-leg model | None found |

---

## 4. Lifecycle / dependency analysis

Traced the full precondition graph for the seven `BuildStage`s and three `Transfer` legs by independent hand-derivation (not by trusting the closure matrix's own trace):

```
planning.completed → scaffold.completed → frontend_implementation.completed
  (required-item failure/retry loop is a bounded Requirement retry, not a stage cycle)
  → backend_implementation.completed → integration.completed
  → { CO→WH transfer.ready (integration.completed + artifact ready)
      ; qa_validation.ready (integration.completed, i.e. prior-stage sequence dep) }
  → CO→WH transfer.completed (arrival at Warehouse)
  → WH→QA transfer.ready (integration.completed + artifact ready + qa_validation.ready)
  → WH→QA transfer.completed (arrival at QA)
  → qa_validation.started (stage.started — gated on WH→QA transfer.completed, never before)
  → qa_validation.completed (stage.validation_passed path, Inspector-only)
  → approval.requested (linked to deployment_package.approvalId)
  → approval.approved
  → QA→Dock transfer.ready (qa_validation.completed + artifact ready + approval approved)
  → deployment_package.started (= QA→Dock transfer.started)
  → QA→Dock transfer.completed (receipt at Dock)
  → deployment_package.completed (fires only after the above)
  → build.completed (immediately after)
```

**Findings:**

- **Seven-stage lifecycle is complete and non-circular.** Every stage's precondition is satisfied by a stage *strictly earlier* in this chain, or — for `qa_validation`'s `ready` state specifically — by the immediately preceding stage's completion (an ordinary sequence dependency, not a cycle). The one stage whose own work *is* a transfer (`deployment_package`) has its completion gated by that transfer's completion, never the reverse; no stage's precondition set includes itself, directly or transitively.
- **All three transfer legs have satisfiable, non-circular preconditions.** CO→WH depends only on `integration` (a stage that completes before the leg exists). WH→QA depends on `integration.completed` plus `qa_validation.ready` — the latter is itself just "prior-stage completed," never on the WH→QA transfer completing. QA→Dock depends on `qa_validation.completed` (a distinct, earlier stage) plus Approval, never on `deployment_package`'s own completion.
- **Package reaches QA before Inspector validation begins.** `qa_validation`'s `stage.started` explicitly requires the WH→QA transfer's `transfer.completed` (receipt) as an additional precondition beyond the ordinary stage-ready state (`event-model.md` `stage.started`; `world-model.md` QA building Relationships).
- **Inspector validation precedes approval.** Approval is requested "once `qa_validation` completes" (`v1-scope.md` row 7); no path allows approval request before `stage.validation_passed`.
- **Approval precedes the final QA→Dock transfer.** The QA→Dock leg's `transfer.ready` precondition list explicitly includes "the build's Approval resolved as `approved`" — the only approval-gated leg.
- **Final transfer receipt precedes `deployment_package` completion.** `stage.completed` for `deployment_package` "fires only after the QA → Deployment Dock transfer's `transfer.completed` and receipt at the Dock — never before" (`event-model.md`).
- **`deployment_package` completion precedes build completion.** `build.completed` is stated to follow "immediately after" in `v1-scope.md`, `event-model.md`, and `v1-acceptance.md` consistently.
- **One build produces one successful package, counted exactly once.** The M-06 counting rule is explicit that the three transfer legs relocate one artifact rather than multiplying it, and the single count occurs at `deployment_package.completed`.
- **9 seeded + 1 completed = 10.** Arithmetic confirmed exact; seeding occurs at `system.started`/world init, distinct from the current build's own count.
- **`Revision`, `Vehicle`, `AgentRun` are fully implementable.** Each has required/optional fields, a closed lifecycle, invariants, commands, and an emitted-event set (or, for `Vehicle`, an explicit "no independent events" rule) sufficient to code against without invention.

No circular dependency, unreachable state, or unsatisfiable precondition was found anywhere in this graph.

---

## 5. Event-model analysis

- **Entity states, commands, and events agree** for every entity touched by M-03 (`Agent`, `Build`, `BuildStage`, `Transfer`) — each allowed state/command added by the audit now has a matching emitted event, and each is also listed in the owning entity's domain-model "Emitted events" row (verified by direct comparison, not by trusting the matrix's claim).
- **Every event has a valid producer and consumer.** All new/changed events (`revision.*`, `agentrun.*`, `build.ready`/`resumed`, `stage.ready`, `transfer.blocked`, `agent.returned_home`, `requirement.passed`, demo `commandType`s, `system.health_changed` vocabularies) carry an explicit Producer (backend, or Runtime Adapter via backend) and an explicit Frontend/consumer effect, consistent with the surrounding document's existing convention.
- **Demo controls have deterministic semantics.** The six-row `commandType` table is exhaustive and explicitly partitions commands into history-altering (`reset`, `replay`) vs. timing-only (`pause`, `resume`, `set_speed`); `start` is the only sequence-initiating command. No `commandType` outside this set is valid.
- **Disconnect/reconnect behavior is fully represented.** `system.health_changed`'s `reasons[]` vocabulary (`connection_lost`/`connection_restored`) is stated to be "the complete, exhaustive contract for F-10 disconnect/reconnect behavior," and `interface-model.md`'s "Connection / stale state" section names the exact mechanism (mutation controls disabled, stale banner, reconcile-on-restore) tied to those reasons.
- **Mock authority does not permit frontend-forged outcomes.** Principle 3a is explicit and self-limiting: it grants the mock engine authority status but simultaneously re-asserts, in the same sentence, that frontend logic must still never locally forge completion/transfer/approval/upgrade outcomes.
- **No `requirement.completed` residue.** Confirmed via grep — the string appears only inside the original audit document and the closure matrix's own description of the rename, never as a live contract reference.
- **Lint hygiene claim verified.** Ran `git diff --check` between the commit's parent and `377547a`; it reports zero trailing-whitespace/conflict-marker errors, matching the closure matrix's claim exactly.

---

## 6. Acceptance traceability analysis

Every V1 acceptance item with a prior gap now has model/event support:

| Item | Support |
| --- | --- |
| F-01 (demo controls) | `event-model.md` "Demo control commands" |
| F-05 (Inspector-only validation) | `stage.validation_passed` invariant + `qa_validation`'s Inspector-only runtime assignment (`v1-scope.md` row 6) |
| F-06 (approval/revision paths) | `Approval` + `Revision` entities and events |
| F-10 (disconnect) | `system.health_changed` vocabularies |
| F-11 (Warehouse upgrade metrics) | M-06 counting rule |
| F-12 (Claude Code stage) | `AgentRun` entity + `backend_implementation` named as the sole `claude_code` stage |
| V-05 (vehicle cannot depart before `transfer.started`) | `Vehicle` entity invariant + glossary entry |
| V-07 (Warehouse visual level only after `upgrade.completed`) | `Upgrade` entity invariant (pre-existing, unaffected) |

No acceptance requirement lost support as a result of the amendment. The one residual acceptance-adjacent gap (agent selection lacking a dedicated event, `m-05` in the original audit) was correctly scoped out of FBL-001 and remains open — it is a MINOR item, not a new problem (see §9).

---

## 7. Future Registry leakage check

**No leakage found**, matching the closure matrix's own conclusion. Specifically checked:

- `AgentRun.costUsd` — worded identically to Future Registry's own "V1 hooks" note under Treasury (`docs/04-future/registry.md`: "Optional `costUsd` on AgentRun"), explicitly marked "forward-compatible optional hook for a later mission; unused and not displayed in V1." This is a forward-compatible field, not an implementation of Treasury, budgets, or any ledger concept.
- No Academy, City Hall, Treasury, Opportunity Center, Market Intelligence, campus, or hiring-pipeline vocabulary appears anywhere in the amended `v1-scope.md`, `domain-model.md`, `event-model.md`, `world-model.md`, `interface-model.md`, `principles.md`, or `glossary.md`.
- `Vehicle` and `AgentRun` — the two entities most exposed to Future Registry cross-reference (Registry mentions `costUsd` and generic adapter-boundary hooks) — were checked field-by-field; no Registry-only field or behavior was pulled into the V1 entity beyond the one explicitly-anticipated optional hook above.

---

## 8. Closure-matrix accuracy review

The FBL-001 closure matrix's claims were independently re-derived rather than trusted at face value. Specific verifications performed:

- Every "Authoritative file changed" / "Exact section changed" cell was checked against the actual `git show 377547a` diff for that file — all citations match the real diff hunks.
- The matrix's literal quote "a grep for `requirement.completed` across active docs returns only the rename annotation itself" — reproduced independently; confirmed accurate.
- The matrix's literal claim "`git diff --check` run after all edits reports zero trailing-whitespace errors" — reproduced independently (`git diff --check 377547a^ 377547a`); confirmed accurate (exit 0, no output).
- The dependency-cycle trace in the matrix's "Validation summary" table was independently re-derived from the raw document text (§4 above) rather than accepted from the matrix's own prose — it matches.
- The B-01 "evidence" claim that `deployment_package`'s `stage.completed` depends on a transfer whose readiness depends on `qa_validation.completed` ("a different, earlier stage — never on `deployment_package` itself") — confirmed against `event-model.md` and `v1-scope.md` row 7 directly.

**No inaccurate closure-matrix claim was identified.**

---

## 9. New findings (MINOR / OPTIONAL only — none block FBL-002)

None of the following were introduced by the FBL-001 amendment; all pre-date it and were out of that rung's scope (which targeted only B-01–B-04 and M-01–M-06). They are recorded here for completeness per this audit's instruction to check "entity states, commands, and events agree," and do not affect the PASS verdict.

### n-01 — MINOR — `Agent.offline` has no dedicated emitted event
`domain-model.md` lists `offline` as an allowed `Agent` state, but no `agent.*` event names a transition into it. Plausibly covered indirectly by `system.health_changed`'s `agent_unreachable` reason, but this mapping is not stated explicitly. Pre-existing; not part of the original ten findings.

### n-02 — MINOR — Some `Build`/`BuildStage` allowed states lack dedicated top-level events
`Build` lists `validating`, `waiting_for_approval`, `blocked`, `revision_required` as allowed states; `BuildStage` lists `waiting_for_approval` and `cancelled`. These are plausibly derived compositionally from `Stage`/`Approval`/`Revision` events rather than needing bespoke `build.*`/`stage.*` events, consistent with the closure matrix's own noted tolerance for "queued states generally, consistent with pre-existing convention." Not part of M-03's original five-item list; pre-existing.

### n-03 — MINOR — Original m-01–m-08 and O-01–O-04 remain open
Confirmed still unresolved (glossary gaps for "World Mode"/"Command Mode"/"Command Deck," residence-vs-building state mapping, construction-site phase enums, `agent.selected` event, mission step 17 wording, artifact checksum timing, `home` buildingType naming, plus the four OPTIONAL items). This matches the original audit's own recommendation that these "can defer past approval" and the closure matrix's statement that they were out of FBL-001's scope. No change in status; not a new problem.

### n-04 — OPTIONAL — `Approval.stageId` for the QA→Dock gate is not explicitly disambiguated
`v1-scope.md` row 7 states `deployment_package.approvalId` links to "the Approval requested once `qa_validation` completes," but does not explicitly state whether `Approval.stageId` itself is set to `deployment_package`'s id or `qa_validation`'s id. A reasonable implementer default exists (`deployment_package`, since that is the stage whose `approvalId` field holds the link), so this does not rise to MINOR/blocking — recorded as OPTIONAL polish only.

---

## 10. Recommendation on Foundation promotion

This independent audit's findings satisfy FBL-002's stated passing bar: **zero open BLOCKER, zero open MAJOR, all ten original findings independently verified closed, and no inaccurate closure-matrix claim identified.** The specification is internally consistent on every dimension this audit was asked to check (lifecycle non-circularity, transfer preconditions, event producer/consumer completeness, acceptance traceability, Future Registry non-leakage).

Per this task's explicit boundaries, this audit **does not itself promote, approve, or unblock anything**. The remaining FBL-002 steps — recording explicit operator approval citing this dated audit revision, updating `FOUNDATION_VERSION.md`'s status field, and removing the BLOCKED banner from `docs/handoffs/002-frontend-foundation.md` — are operator actions that fall outside this audit's scope and were not performed here.

---

## Summary counts

| Severity | Count (open) |
| --- | --- |
| BLOCKER | 0 |
| MAJOR | 0 |
| MINOR | 3 (n-01, n-02, n-03 — all pre-existing, none newly introduced) |
| OPTIONAL | 1 (n-04) |

**Result: PASS.**
