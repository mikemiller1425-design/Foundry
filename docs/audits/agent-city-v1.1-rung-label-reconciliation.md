# Agent City V1.1 — Rung Label Reconciliation

**Type:** Authoritative reconciliation record
**Date:** 2026-08-03
**Rung:** `AC-102` (V1.1 mission baseline ratification)
**Authorized by:** mikemiller1425-design (human operator)

This record is append-only. A later correction is a new dated entry, never an edit to this one (principle 18).

---

## 0. Why this record exists

Four commits on `main` carry the rung label **`AC-103`**. Under the ratified ladder, `AC-103` is **Finding 6 resolution** — diagnosing three Playwright-WebKit failures — and **none of those four commits touched Finding 6**, which remains open and undiagnosed.

The commits are pushed. Foundry's records are append-only and its identifiers are never reused, so the label is corrected **by mapping, never by rebase, revert, or renumber**. This document is that mapping. It is the only place where the difference between what the commit messages say and what the commits did is reconciled.

The work itself is not in question. It was explicitly authorized by the operator on 2026-08-03 and manually verified by them in backend mode. What it lacked was a ratified ladder to be numbered against — that ladder did not exist until this rung.

## 1. Disposition

**The four commits are preserved as `AC-103P` — a pre-ladder proof.**

`AC-103` keeps its ladder meaning (Finding 6 resolution) and remains not started. The trailing `P` marks work that predates the ladder rather than a position within it.

Two alternatives were considered and rejected:

- **Mapping the work to `AC-108`** would be false. `AC-108`'s stop condition is "operator has submitted an objective **and reviewed a plan**." No Architect step, `BuildPlan`, or plan review panel exists. Recording `AC-108` as satisfied would put a false completion into the ladder on its first day.
- **Redefining `AC-103` as the shipped work** and moving Finding 6 to a fresh identifier would make the commit messages read correctly, but it displaces an open V1 debt item onto a new number for the convenience of four commit subjects. The operator chose to keep Finding 6 at `AC-103`.

## 2. Commit-by-commit map

| Commit | Message label | What it actually implemented | Rung whose criteria it bears on |
| --- | --- | --- | --- |
| `9a6f7ee` | "AC-103" | Bounded objective envelope in `packages/contracts`; two named `CommandHandler` guards (bounded objective + one active project; build coherence + one active build); `ObjectiveIntake` as a client of `CommandHandler`; `POST /objectives`; `ObjectiveForm` in the left navigator; **PV1-012** silent-no-op repair; `BuildSchema.currentStageId` → nullable | `AC-106` (part), `AC-107` (part), `AC-108` (part) |
| `e1fa301` | "AC-103" | Extracted `OperatorCredentialEntry` so a credential can be supplied outside a pending approval — previously the only credential field in the application rendered only during an approval | `AC-105` (sliver) |
| `9345a04` | "AC-103" | `BackendClient.refreshWorldState()` — the world-state projection now advances with the event log; `describeEvent` no longer repeats the objective on the `build.created` row | `AC-106` (part) |
| `7b536a9` | "AC-103" | Operator verification record. Documentation only | — |

**None of the four** performed any part of `AC-103` as the ladder defines it.

## 3. Coverage and residue

`AC-103P` **anticipates** parts of four rungs. It **closes none of them.** Each rung must still run and judge this code against its own acceptance criteria.

| Rung | Anticipated by `AC-103P` | Residue still owed |
| --- | --- | --- |
| `AC-105` | Credential enterable outside an approval | Runtime-mode selection at run time (PV1-028); automatic credential handoff removing the copy-from-stdout step (PV1-036) |
| `AC-106` | PV1-012 (silent no-ops) and PV1-052 (inoperable backend mode) addressed; every non-2xx now renders a distinguishable reason | **PV1-013** — `building.selected` has no backend-mode producer; the demo-control disposition in backend mode |
| `AC-107` | Objective envelope typed and negative-tested (over-long, disallowed workspace, R3+, unknown field) | **Plan** and **execution authorization** contracts; the specification amendments this rung owns |
| `AC-108` | Objective submission performable by a human for the first time (PV1-026, PV1-050) | **Architect planning step; `BuildPlan` shape; plan review panel; plan rendered in world and timeline.** The rung's stop condition is unmet |

## 4. Ordering deviation — recorded

The ladder's critical path runs `AC-102 → AC-104 → AC-105 → AC-106 → AC-107 → AC-108`. `AC-103P` landed before `AC-104` and `AC-105`.

This was a deliberate operator decision, given in the same instruction that authorized the work: *"Use the existing two-terminal backend startup for this first slice. Do not spend time on one-command startup yet."*

Recorded so no later reader infers that `AC-104` and `AC-105` were satisfied or waived. **They are required and un-started.** The critical path is unchanged.

## 5. Unrecorded specification amendment — now logged

`9a6f7ee` changed `BuildSchema.currentStageId` from `IdSchema` to `IdSchema.nullable()`, and both reducers now write `null` on `build.created`.

This is a real change to a contract derived from `domain-model.md`, and it was **not** among the amendments enumerated in the truth audit §17 or the V1.1 scope §9. It is now logged in `docs/01-mission/agent-city-v1.1-scope.md` § 9, owned by `AC-107`.

The change is defensible on its merits — `domain-model.md` lists `currentStageId` among Build's *required fields*, meaning always present, and `nullable` keeps it present while making representable a state that always existed (a Build created before any stage). It was nonetheless made inside a mislabelled slice without being recorded as an amendment, which is the process failure this entry closes.

## 6. Playwright screenshot baselines — stale, not regenerated

The six baselines under `apps/agent-city/e2e/shell-realtime-connection.spec.ts-snapshots/` were captured at `40c3713` (2026-08-01). **All six differ from current output.** Measured at zero tolerance on 2026-08-03:

| Baseline | Differing pixels | Ratio |
| --- | --- | --- |
| `realtime-disconnected-ultrawide-5120x1440-darwin.png` | 49,360 | 0.01 |
| `realtime-disconnected-ultrawide-3840x1080-darwin.png` | 35,550 | 0.01 |
| `realtime-disconnected-fallback-2560x1440-darwin.png` | 46,919 | 0.02 |
| `realtime-restored-ultrawide-5120x1440-darwin.png` | 42,231 | 0.01 |
| `realtime-restored-ultrawide-3840x1080-darwin.png` | 30,127 | 0.01 |
| `realtime-restored-fallback-2560x1440-darwin.png` | 39,723 | 0.02 |

The suite **passes**, because `maxDiffPixelRatio: 0.02` absorbs all six.

**Four independent causes**, three of which predate `AC-103P`:

| Commit | Contribution |
| --- | --- |
| `6dd9fa8` (FBL-035) | Removed the top-bar `REGION_PLACEHOLDER` text |
| `ca5b339` (FBL-021A) | AppShell changes for jump-to-world-object |
| `e5378aa` (operator) | 437 lines of world geometry — the outlining across the whole world region. Matches reconciliation **N-04** |
| `9a6f7ee` (`AC-103P`) | Objective control in the left navigator; content below it shifted down |

**No baseline was updated, accepted, or regenerated**, by operator instruction. Regeneration is owned by `AC-117` or `AC-119` and requires explicit operator approval. Recorded here so the staleness is not later mistaken for `AC-103P`'s doing alone.

## 7. What remains open at ratification

| Item | State | Owner |
| --- | --- | --- |
| **Finding 6** — three undiagnosed Playwright-WebKit failures | **Open, undiagnosed.** Unchanged since `FBL-035` | `AC-103` |
| **D-8** — disposition of `e5378aa` | **Open**, non-blocking | `AC-117` / `AC-118` |
| Six stale screenshot baselines | Recorded, not regenerated | `AC-117` / `AC-119` |
| N-03 — `pnpm format` fails on 28 files (pre-existing) | Recorded | `AC-119` |
| N-05 — `next-env.d.ts` drifts under tooling | Recorded | `AC-119` |
| `AC-103P` residue (§3) | Recorded | `AC-105`–`AC-108` |

---

**Companion documents:**
`docs/03-architecture/agent-city-v1.1-build-ladder.md` · `docs/audits/agent-city-post-v1-reconciliation.md` · `docs/evidence/ac-103p/operator-verification.md`
