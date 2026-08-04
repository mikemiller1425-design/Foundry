# AC-110 — Execution Authorization Gate

**Type:** Rung deliverable record
**Rung:** `AC-110` — Execution authorization gate **[FEAT]**
**Date:** 2026-08-04
**Status:** Implemented and verified; **awaiting operator review**. The rung is not closed.

This record is append-only. A later decision is a new dated entry, never an edit to this one (principle 18).

---

## 0. What this rung does, and what it deliberately does not claim

An authenticated operator can grant **one single-use permission** for **one stage** to execute for real, bound to a **backend-generated SHA-256 over the plan's persisted content**. A gate reads that permission and decides, in both directions, whether a real execution would be allowed.

**Stated plainly, because the distinction matters: there is no real invocation for this gate to prevent yet.** No runtime is wired, no process is spawned, no authorization is spent, and no money can be spent. What this rung delivers is the decision procedure, the persisted record, and the refusals. `F-114`'s "an unauthorized real invocation is refused" becomes *fully* demonstrable at `AC-111`, when there is an invocation to refuse. What is demonstrable now — and is demonstrated — is that the gate refuses exhaustively, that it permits only under a valid authorization, and that neither reading it nor being refused by it changes anything.

**No execution was authorized in the course of building this.** No Claude Code was invoked, no process was executed, no network call was made, and nothing was spent.

## 1. The binding (`F-113a`) — the operator's `AC-107` correction, delivered

The operator's `AC-107` contract review recorded Decision 9 as a forward obligation:

> "`AC-110` must implement the backend-generated SHA-256 canonical plan-content hash, persist it, require it on authorization, and compare it server-side."

All four clauses:

| Clause | How |
| --- | --- |
| **Backend-generated SHA-256** | `planContentHash` in `@foundry/persistence`, over `canonicalPlanContent(plan)` |
| **Persisted** | `PersistedPlan.contentHash`, written by the reducer when the plan becomes truth; deterministic, so a replay recomputes the identical binding |
| **Required on authorization** | `ExecutionAuthorizationSchema.planContentHash` is required, as is the event payload field — the ladder's amendment required exactly this |
| **Compared server-side** | In the `Plan.Authorize` guard and again in the gate, both against a hash **recomputed from persisted content** |

**"Backend-generated" is a module boundary, not a convention.** `@foundry/contracts` ships to the browser and holds no `node:crypto`; the producer lives in `@foundry/persistence`, which the browser bundle cannot resolve. A test asserts this over **import statements** rather than raw file text — see §6.

**A client-supplied value is never the binding.** `acknowledgedContentHash` is the one hash-shaped field a caller sends. It states which hash the operator was looking at; the backend recomputes its own, refuses on disagreement, and writes **its own value** to the event. The client's field is deleted rather than carried, so no later reader can confuse the two. A test asserts it is absent from the emitted payload.

**The stored hash is never compared against itself.** Both the guard and the gate recompute from content. Trusting the stored field would make the check a comparison of a value with a copy of itself; recomputing means a record whose stored hash and stored plan ever disagreed fails closed.

`planRevision` is retained as a change indicator, reported alongside, and documented throughout as **not** a security boundary.

## 2. Single-use (`F-113`)

Two independent mechanisms, because "one authorization cannot cover a second run" has two halves:

- **One authorization per plan.** A second `Plan.Authorize` is refused by name, citing the existing authorization's id, issuer, time, and stage. Reissuing would quietly turn a single-use grant into a renewable one.
- **Spend is derived from persisted truth.** The gate treats the authorization as spent when a real (`claude_code`) `AgentRun` exists for the stage, resolved through `AgentRun.taskId` → `Task.stageId` → `BuildStage` rather than by pattern-matching identifiers. A run that started and then failed still counts as spent, which is what `F-124` requires: a spent real execution is never automatically restarted.

## 3. Who may authorize, and what they may say

Authorizing is a human governance act (principle 14), so `Plan.Authorize` requires an **authenticated operator**. An agent, the backend itself, and an unauthenticated caller are each refused — the backend included, because a system that could commission its own execution would make every review before it decorative.

`authorizationId`, `authorizedBy`, `planRevision`, `workspace`, and `riskClass` are **unrepresentable in the payload** — absent from the schema and refused by `.strict()` — and written server-side from the credential and from persisted plan content.

`authorizationId` is **derived** from the plan rather than supplied or generated: a replay reconstructs the identical id, a resubmission collides with the existing record instead of minting a second one, and no caller chooses the identifier of the thing that grants it permission.

## 4. Every refusal, by name

| Condition | Where |
| --- | --- |
| Not an authenticated operator (agent, backend, anonymous) | `Plan.Authorize` |
| Plan not reviewed / reviewed `rejected` or `revision_requested` | `Plan.Authorize` **and** the gate |
| Stage not in the plan | `Plan.Authorize` |
| Stage the plan runs with the **mock** — no real execution to authorize | `Plan.Authorize` |
| Budget absent, zero, negative, infinite, or over the **$25** ceiling | `Plan.Authorize` (schema) |
| Acknowledged hash disagrees with persisted content | `Plan.Authorize` |
| A second authorization | `Plan.Authorize` |
| No plan at all | gate |
| No authorization — *a reviewed plan is not permission to run* | gate |
| Stage the authorization does not name | gate |
| Content hash mismatch — **the binding** | gate |
| Binding unverifiable (hash could not be recomputed) | gate — fails closed |
| Revision drift | gate, reported as an indicator, never as the binding |
| Already spent | gate |

The gate is **pure and total**: it returns *every* reason it refuses rather than throwing on the first, and it holds no `PersistenceService` and no `appendEvent`. Zero side effects is a property of what it can reach.

## 5. Surfaces

| Surface | Behaviour |
| --- | --- |
| `POST /commands` → `Plan.Authorize` | The only way an authorization comes into existence |
| `GET /builds/{id}/execution-authorization` | The gate's verdict. A **GET**, so asking whether execution would be permitted can never cause it. `executed: false` is always present, so no caller can read a preflight as a dispatch |
| `ExecutionAuthorizationPanel` | Shows the binding **before** the control that uses it; shows who, what, when, and what it bound to once issued; renders the backend's refusals with their corrective actions |

The frontend never computes permission and cannot compute the binding. `interpretExecutionGateResponse` reads `permitted` strictly — anything that is not literally `true` is not permission — so a malformed or missing answer can only narrow, never widen.

The panel says "nothing has run" on the control, on the issued record, and on a permitted verdict.

## 6. Verification

`pnpm typecheck` 8/8 · `pnpm lint` clean · `pnpm build` clean · `pnpm -r run test` → **1324 passed / 92 files / 0 failures** (up from 1239).

**Preservation, checked rather than assumed:** `v1-canonical-run.json` is **byte-identical to `HEAD`**. The mock runtime's behaviour files are untouched; the changes under `mock-runtime/` are the shared context interface (two optional fields) and the event→world projection-map entry, which is the documentation map every event type must have — the same shape `AC-108` added.

### Live backend-mode verification

Run against an **isolated** API instance on port 4101 with its own temporary database, so the operator's running `AC-109` session was not disturbed.

| Checked | Result |
| --- | --- |
| Plan carries a backend SHA-256 binding | `sha256:16130f19…`, alongside `rev-77a65a80…` as the change indicator |
| Gate before review | refused: `plan_not_reviewed`, `no_authorization` |
| Gate after review, before authorization | refused: `no_authorization` — *"a reviewed plan is not permission to run"* |
| Authorize with no credential | refused — authenticated operator required |
| Authorize with an **agent** credential | refused |
| Authorize a **mock** stage (`scaffold`) | refused — "no real execution to authorize" |
| Authorize with a **stale** acknowledged hash | refused — "the plan changed since it was read" |
| Budget **$26** | refused — "expected number to be <=25" |
| **Every refusal above** | **4 events total; nothing written** |
| **Authorize (accept direction)** | accepted; actor `operator`/`operator-1`; backend's own hash on the event; `acknowledgedContentHash` **absent** from the payload |
| Gate after authorization | **permitted: true**, `executed: false`, 0 refusals, binding matches |
| Gate for a different stage | refused: `stage_not_authorized` |
| Second authorization | refused — "single-use and is not reissued" |
| After authorizing | 5 events; **0** `agentrun.*`; 0 AgentRuns, BuildStages, Tasks, Artifacts |
| Restart | `/world-state` identical; authorization survived; binding still matches; gate still permits |

### The adversarial check

The binding exists for one scenario, so that scenario was performed rather than argued about: the persisted `build.planned` event was **tampered with directly in the database**, replacing the `backend_implementation` acceptance criteria with *"Anything the Builder writes is acceptable."* — and the API restarted.

```
recomputed contentHash : sha256:2ca15cf0…
authorization bound to : sha256:16130f19…
they still agree?      : False

gate → permitted: false
  - plan_content_hash_mismatch :: The plan changed after it was authorized…
  - plan_modified              :: …This is a change indicator, not the binding
```

A plan edited after authorization invalidates that authorization, exactly as `F-113` requires, and the refusal names the binding as the reason.

## 7. Two defects found before commit

1. **The `F-113a` boundary assertion was defeated by prose.** A literal text search for `node:crypto` in `plan.ts` matched the comment documenting that very boundary — the second time this class of mistake appeared, after the `AC-109` structural tripwire. It is now asserted over **import statements**, which is what the claim is actually about.
2. **A test harness silently tested nothing.** The "uncredentialed caller" case called a helper whose `token` parameter had a default of `operatorToken`; JavaScript defaults fire on `undefined`, so the explicit "no credential" call sent the operator's token and the case passed while proving nothing. The helper now uses `null` for absence. **The product was correct** — re-run with a genuinely absent credential, it refuses — but the test had been asserting a fact it never exercised.

The second is worth recording beyond its fix: a passing test that exercises nothing is worse than a missing one, because it is counted as evidence.

## 8. Specification amendments

| Document | Amendment |
| --- | --- |
| `domain-model.md` | `Plan.Authorize` added to the closed vocabulary; the execution binding and the `Plan` record's new fields; explicitly supersedes the `AC-108` note that execution authorization had no command |
| `event-model.md` | `operator.execution_authorized` joined the runtime vocabulary; `planContentHash` now **required**; preconditions recorded as enforced |

The closed vocabulary grew by exactly one command, at the rung that needed it — the same discipline `AC-108` followed.

## 9. Still open

`AC-111` (real controlled Builder execution — the run this gate permits), `AC-112`, `AC-113`, Finding 6 (`AC-103`), D-8, N-03, N-05, N-06.

`AC-111` is **not started** and requires its own explicit operator authorization. No real execution has occurred, and issuing an authorization does not cause one.
