# FBL-029 — Operator Observation Record

**Status:** ✅ **OBSERVED AND APPROVED**
**Rung:** FBL-029 — Independent Inspector validation
**Confirmed by:** mikemiller1425-design (human operator)
**Date:** 2026-08-01
**Operator response:** `APPROVED — CONTINUE`
**Implementation commit observed:** `4b57fba` (`feat: enforce independent Inspector validation (FBL-029)`)

This record is append-only. A later decision does not edit this file; it is recorded as a new dated entry or a superseding record, consistent with principle 18 (corrections occur through new events, never by rewriting an existing one).

---

## What was observed

The operator ran the three visual checks against the real backend (`:4000`, SQLite-backed) and the real frontend (`:3000`) with a `qa_validation` stage seeded to `validating`, using per-boot agent credentials issued by the backend:

1. **Inspector failure causes QA red** — `BuildStage.Validate(outcome: failed)` presented with the Inspector credential was accepted, and the QA building rendered the declared red state rather than the orange "blocked" state.
2. **Builder cannot create a pass** — the same command presented with the Builder credential was refused with the F-05 reason, QA remained red, and no timeline entry was produced. The unauthenticated and spoofed-body variants were refused identically (`403 actor_mismatch` for the body claim).
3. **Inspector pass causes QA success** — on a fresh stage, `BuildStage.Validate(outcome: passed)` with the Inspector credential was accepted and QA left the red state. The persisted validation record showed `validatorAgentId: agent-inspector` and `validatorRole: inspector`, with the role resolved from persisted `Agent` state rather than from the command.

## Scope of this confirmation

This records the operator's **observation** that the FBL-029 behaviour is correct as demonstrated. It is the operator validation required by the rung's field 10 and its stop condition ("F-05 real-backend test green **and operator-observed**").

It does **not** re-open, extend, or alter the FBL-028 approval, whose scope and explicit non-classification remain exactly as recorded in `docs/evidence/fbl-028/operator-approval.md`. In particular, nothing here classifies the runtime adapter as an OS-level security sandbox.

## Security posture established by this rung

Recorded because it changes a standing property of the system:

- Command identity is established by a **backend-issued bearer credential**, not by the request body. The pre-FBL-029 behaviour — where `actor` in the payload *was* the identity — no longer exists.
- The credential establishes *who*; the **authoritative role is re-read from persisted `Agent` state** at decision time, so a credential can never assert a role its agent does not hold.
- Agent credentials are generated per process, held in memory only, and never persisted or logged. **The browser never receives one**, which is what makes a frontend attempt to self-certify a structural impossibility rather than a naming coincidence.
- This is deliberately **not** a general authentication system (V1 excludes one). It is the smallest mechanism that makes the F-05 guard a real authorization decision, and it is scoped to that job. It should not be treated as a production authentication or session system.

## Effect on the ladder

FBL-029's stop condition is **met** and the rung is **closed**.

FBL-030 (human approval workflow) is the next rung of the operator-authorized sequence FBL-029–FBL-033 and is authorized to begin. FBL-034 and beyond remain unauthorized.
