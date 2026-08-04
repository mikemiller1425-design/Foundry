# AC-105 — Operator Observation Record

**Status:** ✅ **OBSERVED AND REPORTED BY THE OPERATOR**
**Rung:** `AC-105` — Runtime-mode selection and credential handoff at runtime **[FIX]**
**Observed by:** mikemiller1425-design (human operator)
**Date:** 2026-08-03
**Observed against:** commit `573b1d1` — `fix: runtime-mode selection and credential handoff at run time (AC-105)`
**Defect found and fixed after the observation:** `3e76c70` — see § "Defect found during closure"

This record is append-only. A later decision does not edit this file; it is recorded as a new dated entry or a superseding record, consistent with principle 18.

---

## What the operator observed

Reported across two messages:

> I verified automatic local credential handoff without copying a terminal token, Clear, Use this session's credential, and recovery from an invalid credential with a readable rejection.

> I also observed that an occupied API port gives a clear corrective error.

Confirmed by the operator, item by item:

| Observed | Requirement it evidences |
| --- | --- |
| Automatic local credential handoff, **without copying a terminal token** | `F-104`; the second half of the rung's operator gate |
| **Clear** recovers from a held credential | Operator guardrail: a mistaken token must be recoverable |
| **Use this session's credential** adopts the handed-over token | `F-104` handoff |
| **Recovery from an invalid credential, with a readable rejection** | `F-104`: invalid is distinguishable and explained, never silent |
| An **occupied API port** produces a clear corrective error | `AC-104` `F-101` behaviour, re-confirmed under `AC-105`'s loopback change |

## Standing and scope — stated precisely

- This is an **operator-reported observation**, not an assistant-witnessed one. Same standing as `docs/evidence/fbl-035/real-safari-observation.md` and `docs/evidence/ac-104/operator-observation.md`.
- **The operator did not report observing mode switching without a rebuild**, which is the *first* half of the rung's operator gate. That half is carried by automated evidence — `pnpm verify:runtime-mode`, which builds once and starts the same artifact twice — not by a human observation. This record does not claim otherwise. If the operator wants that half on the record as a personal observation, it is a separate entry.
- The operator did not report observing the **stale** credential state. It is covered by unit tests over `deriveCredentialState` and by the handoff comparison, not by a reported observation.
- The rung's **stop condition** — *"Both modes reachable from one artifact and the credential step is automatic"* — is satisfied: the first clause by `verify:runtime-mode`, the second by the operator's observation.

## Automated evidence

Measured at `573b1d1` and re-confirmed after the fix at `3e76c70`.

**`pnpm verify:runtime-mode` — 7 passed, 0 failed.** Builds the frontend **once**, then starts that same output twice with different environments:

| Check | Result |
| --- | --- |
| Built artifact serves **backend** mode when `FOUNDRY_API_URL` is set | PASS |
| The **same** artifact serves **mock** mode when it is empty | PASS |
| No rebuild occurred between the two modes | PASS |
| The served HTML contains no operator credential | PASS |
| The loopback handoff route serves the credential | PASS |
| No operator credential in the client bundle (10 files scanned) | PASS |
| No `NEXT_PUBLIC_*` credential variable exists | PASS |

**Gates:** `pnpm typecheck` 8/8 · `pnpm lint` clean · `pnpm build` clean · `pnpm -r run test` → **988 passed / 84 files / 0 failures** (up from 928; 60 new tests).

**Live checks:** handoff file mode `0600`; contents byte-identical to the token the API minted; the route serves it over loopback; a non-loopback `Host` is refused with `403`; the handed-over credential authorized a real objective (`201`, both declared events) against a clean database; the file is removed on shutdown.

## Acceptance requirements satisfied

| ID | Requirement | Evidence |
| --- | --- | --- |
| **F-103** | A single built artifact starts in either runtime mode without a rebuild; mode is a run-time input | `verify:runtime-mode` 7/7 against a real build |
| **F-104** | No credential in the client bundle; the launch path performs a local handoff; manual entry remains; absent, stale, and invalid each produce a distinguishable, explained state | Bundle and HTML scans; operator-observed handoff, Clear, adopt, and invalid-recovery; `credentialState` unit tests for all five states |

## Prohibited work — confirmed not done

No sessions, expiry, refresh, logout, or user accounts. No credential embedded in the client bundle. Manual entry was **not** removed. The `403 actor_mismatch` rule and the `PrincipalRegistry` boundary are untouched — **no backend file changed by this rung**.

## Defect found during closure

While re-verifying gates for this closure, `pnpm verify:launch` **deleted the handoff file belonging to the operator's live session.**

The handoff path was a constant, so it was shared state between launcher instances: a second launcher wrote its own credential over the first one's and then removed the file on its own shutdown, disarming a still-running session's handoff.

- **Severity:** real, and it degraded a live session. It did not fail silently — the route answered *"declared a handoff file, but it is not present. Paste the credential manually"* — so the operator's fallback was intact and explained, which is the behaviour `F-104` requires of an unexpected condition.
- **Fix:** `3e76c70`. The filename now carries the API port, so instances are disjoint by construction; each still removes only the file it wrote.
- **Regression cover:** `verify-launch.mjs` now asserts that its own handoff file is namespaced and removed, and that a default-port session's file is untouched. Verified directly: a simulated `4000`-port handoff survived a `4460`-port launch and shutdown.

Recorded here rather than folded into the fix commit alone, because it was found *by* the closure process and a later reader should see that the rung closed with this known and repaired.

## Known operating constraint, unchanged

`pnpm verify:launch` cannot run while a `pnpm dev` session is up: Next refuses a second dev server from the same directory. This is `AC-104`'s constraint, not a new one, and it is why the fix above was verified through production mode instead.

## Still open at the time of this record

| Item | State | Owner |
| --- | --- | --- |
| **Finding 6** — three undiagnosed Playwright-WebKit failures | Open, undiagnosed | `AC-103` |
| **D-8** — disposition of `e5378aa` | Open, non-blocking | `AC-117` / `AC-118` |
| Six stale screenshot baselines (N-06) | Recorded, not regenerated | `AC-117` / `AC-119` |
| N-03 — `pnpm format` fails, pre-existing | Recorded | `AC-119` |
| N-05 — `next-env.d.ts` drifts under tooling | Recorded | `AC-119` |
| `AC-103P` residue | `AC-106`, `AC-107`, `AC-108` still owed | `AC-105`–`AC-108` |

`AC-106` is **not started** and requires its own explicit operator authorization.
