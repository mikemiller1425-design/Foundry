# AC-110 — Operator Observation Record

**Status:** ✅ **APPROVED BY THE OPERATOR**
**Rung:** `AC-110` — Execution authorization gate **[FEAT]**
**Approved by:** mikemiller1425-design (human operator)
**Date:** 2026-08-04
**Observed against:** commit `a82fcf4` — `feat: execution authorization gate (AC-110)`
**Closed at:** commit `b7891b0` (documentation state at closure)

This record is append-only. A later decision does not edit this file; it is recorded as a new dated entry or a superseding record, consistent with principle 18.

---

## What the operator reported

> AC-110 approved based on my observation of the visible binding, refusal-before-authorization, $26 refusal, $5 single authorization, and confirmation that nothing started; plus acceptance of the recorded automated and live evidence for hash-tampering and single-use enforcement.

## The basis of this approval, separated by standing

This is the distinction the `AC-108` and `AC-109` records got wrong and had to be corrected for on 2026-08-04. It is stated here up front instead.

### Personally observed by the operator, in the running application

| # | Observed | Requirement it evidences |
| --- | --- | --- |
| 1 | **The visible binding** — the plan's `sha256:…` content hash, shown in the panel before any control that acts on it | `F-113a`: the binding is what the operator is authorizing against, and they can see it |
| 2 | **Refusal before authorization** — the gate reporting that a reviewed plan is not permission to run | `F-113`: no real execution is reachable without an explicit authorization. Reviewing and authorizing are separate decisions |
| 3 | **The $26 refusal** — a budget above the ceiling rejected | `F-113a` / `AC-107` decision 7: every authorization is budgeted, positive, finite, capped at $25 |
| 4 | **The $5 single authorization** — one authorization issued, for one stage | `F-113` / `F-114`: the authorization record shows who, what, when, and against which plan |
| 5 | **Confirmation that nothing started** | The rung's hard stop: authorizing is permission, not a run |

### Accepted from recorded evidence, not personally observed

The operator stated this acceptance explicitly rather than leaving it to be assumed.

| Property | Evidence relied on | Why it was not personally observable |
| --- | --- | --- |
| **A modified plan invalidates its authorization** (hash-tampering) | `executionAuthorization.test.ts` (unit, both directions) and the recorded adversarial live run in `authorization-gate-record.md` § "The adversarial check" | There is no re-plan command, so the state cannot be reached through the product's own surface. It required editing the persisted event log directly and restarting |
| **Single-use enforcement** | `executionAuthorization.test.ts` and `apps/api/src/executionAuthorization.test.ts` — a second `Plan.Authorize` refused; spend derived from a real `AgentRun` | The spend half cannot be demonstrated without a real run, and there is no real run until `AC-111` |

Both were performed and recorded by the assistant. Neither is an operator observation, and this record does not present them as one.

## Stop condition — satisfied

> *"Authorization gate proven in both directions. **Hard stop** — the real run is a separate rung and a separate authorization."*

**Both directions.** The refusing direction was observed by the operator (item 2) and proven exhaustively by test across fourteen named refusal conditions. The permitting direction was observed by the operator (items 4 and 5) and proven by test.

**Hard stop held.** No real execution occurred, no runtime is wired, no process was spawned, no model was invoked, and no money was spent — at any point in building, verifying, or approving this rung.

## The `AC-107` Decision 9 obligation — discharged

The operator's `AC-107` contract review recorded a forward obligation on this rung, and the ladder recorded that `AC-110` **may not close** until it was met:

> "`AC-110` must implement the backend-generated SHA-256 canonical plan-content hash, persist it, require it on authorization, and compare it server-side."

| Clause | Delivered |
| --- | --- |
| Backend-generated SHA-256 | `planContentHash` in `@foundry/persistence`, over `canonicalPlanContent(plan)` |
| Persisted | `PersistedPlan.contentHash`, written when the plan becomes truth; deterministic under replay |
| Required on authorization | Required on `ExecutionAuthorizationSchema` **and** on the `operator.execution_authorized` payload — the ladder's amendment required exactly this change |
| Compared server-side | In the `Plan.Authorize` guard and again in the gate, both against a hash **recomputed from persisted content**, never against the stored field |

**A client-supplied value is never accepted as the binding.** The producer imports `node:crypto` and lives outside the browser bundle, so "backend-generated" is a module boundary rather than a convention — asserted by a test over import statements. The client's `acknowledgedContentHash` is compared and then discarded; a test asserts it is absent from the emitted event.

`planRevision` is retained as a change indicator and is documented throughout as **not** a security boundary.

## Acceptance requirements

| ID | Requirement | Evidence, by standing |
| --- | --- | --- |
| **F-113** | No real execution reachable without an explicit operator authorization; single-use and plan-bound | Operator-observed (items 2, 4); single-use accepted from test evidence |
| **F-113a** | Backend-generated SHA-256 over canonical persisted plan content, stored with the `Plan`, compared server-side; client value never the binding; required `maxBudgetUsd` ≤ $25 | Operator-observed (items 1, 3); binding-invalidation accepted from test and adversarial-run evidence |
| **F-114** | An unauthorized real invocation is refused with zero side effects; the authorization record shows who, what, when, and against which plan | The record half is operator-observed (item 4). **The "unauthorized real invocation" half is not fully demonstrable at this rung** — see below |

### `F-114`, stated precisely rather than claimed whole

There is no real invocation for this gate to prevent yet. What is proven now is that the gate refuses exhaustively, permits only under a valid authorization, and that neither reading it nor being refused by it writes anything — the gate holds no `PersistenceService` and no `appendEvent`, and the read surface is a `GET`. Zero side effects is a property of what the code can reach.

**`F-114` is therefore satisfied in the part this rung owns and carries forward into `AC-111`**, where a real invocation exists to be refused. This is recorded as a known partial rather than counted as complete.

## Verification at closure

Measured on a clean tree.

`pnpm typecheck` 8/8 · `pnpm lint` clean · `pnpm -r run test` → **1324 passed / 92 files / 0 failures**.

`pnpm build` was verified clean at `a82fcf4` immediately before that commit was pushed, and was **not** re-run at closure: the operator's session was running and a production build writes into the same `.next` directory the live dev server uses. Stated rather than glossed.

**Preservation, checked rather than assumed:** `v1-canonical-run.json` is **byte-identical to `HEAD`**. The mock runtime's behaviour files are untouched; the changes under `mock-runtime/` are the shared context interface (two optional fields the mock provider does not supply) and the event→world projection-map entry every event type must have.

**Live backend-mode verification** (recorded in `authorization-gate-record.md`): every refusal direction — no credential, agent credential, unreviewed plan, mock-runtime stage, stale acknowledged hash, $26 budget, second authorization — each with its own reason and **writing nothing**; the accept direction producing one event carrying the backend's own hash with the client's field absent; the gate permitting only after authorization and refusing for any other stage; zero `AgentRun`s, `BuildStage`s, `Task`s, and `Artifact`s throughout; and an identical `/world-state` after restart. Run against an isolated API instance and database on a separate port.

## Two defects found before commit

1. **The `F-113a` boundary assertion was defeated by its own documentation.** A literal search for `node:crypto` in `plan.ts` matched the comment explaining that very boundary — the second occurrence of this class of mistake, after the `AC-109` structural tripwire. It is now asserted over **import statements**, which is what the claim is actually about.
2. **A test harness silently tested nothing.** The "uncredentialed caller" case called a helper whose `token` parameter defaulted to the operator's token; JavaScript defaults fire on `undefined`, so the explicit no-credential call sent a credential and the case passed while proving nothing. The helper now uses `null` for absence. **The product was correct** — re-run with a genuinely absent credential, it refuses.

The second is worth carrying forward beyond its fix: a passing test that exercises nothing is worse than a missing one, because it gets counted as evidence.

## Specification amendments made

| Document | Amendment |
| --- | --- |
| `domain-model.md` | `Plan.Authorize` added to the closed vocabulary; the execution binding and the `Plan` record's new fields; explicitly supersedes the `AC-108` note that execution authorization had no command |
| `event-model.md` | `operator.execution_authorized` joined the runtime event vocabulary; `planContentHash` now **required**; preconditions recorded as enforced |

The closed vocabulary grew by exactly one command, at the rung that needed it — the same discipline `AC-108` followed.

## The obligation this does not discharge

`docs/02-specification/v1.1-acceptance.md` § 7 "Definition of done", item 8:

> **The operator personally performs the §3 journey**, unassisted, end to end, in one session.

**Outstanding.** The five items above were personally observed and they are a real part of the § 3 journey's step 6 — but they are not the whole journey, and this approval does not contribute to that gate. It is owed at `AC-120`.

## Still open at the time of this record

| Item | State | Owner |
| --- | --- | --- |
| Real controlled Builder execution — the run this gate permits | Not started | `AC-111` |
| `F-114`'s "unauthorized **real invocation** refused" half | Carried forward | `AC-111` |
| Builder self-certification on the real path; failing-artifact repair path | Not started | `AC-112` |
| Carrying a build past the approval gate; transfers; the upgrade | Not started | `AC-113` |
| **Finding 6** — three undiagnosed Playwright-WebKit failures | Open, undiagnosed | `AC-103` |
| **D-8** — disposition of `e5378aa` | Open, non-blocking | `AC-117` / `AC-118` |
| Six stale screenshot baselines (N-06) | Recorded, not regenerated | `AC-117` / `AC-119` |
| N-03 — `pnpm format` fails, pre-existing | Recorded | `AC-119` |
| N-05 — `next-env.d.ts` drifts under tooling | Recorded | `AC-119` |
| Authorization guards answering `200` rather than `403` | Recorded candidate | A later rung owning the API surface |

`AC-111` is **not started** and requires its own explicit operator authorization. It is the first rung at which real money can be spent, and nothing in this approval authorizes that.
