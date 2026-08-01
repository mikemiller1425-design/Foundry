# FBL-030 — Operator Observation Record

**Status:** ✅ **OBSERVED AND APPROVED**
**Rung:** FBL-030 — Human approval workflow
**Confirmed by:** mikemiller1425-design (human operator)
**Date:** 2026-08-01
**Operator response:** `APPROVED — CONTINUE`
**Implementation commit observed:** `f3e9a80` (`feat: implement human approval workflow (FBL-030)`)

This record is append-only. A later decision does not edit this file; it is recorded as a new dated entry or a superseding record, consistent with principle 18.

---

## What was observed

Two visual runs against the real backend (`:4000`, SQLite-backed) and the real frontend (`:3000`), with a per-boot operator credential issued by the backend:

**Run 1 — approve.** The approval card appeared with the Lighthouse signalling attention. The card showed "Operator credential required" with all three resolution buttons **disabled**, visibly distinct from the disconnected banner. After the operator supplied the credential the buttons enabled; **Approve** cleared the card and the attention signal, and the persisted approval recorded `status: approved` with `resolvedBy: operator-1` — a value the browser never sent, derived from the credential.

**Run 2 — reject.** A second gate was requested; the card and attention signal returned. **Reject** cleared both (the decision was made), while the approval-gated transfer **remained shut**. A subsequent conflicting `Approve` on the same approval was refused: a resolved approval is an immutable decision.

## Scope of this confirmation

This records the operator's **observation** that FBL-030 behaves correctly as demonstrated, satisfying the rung's field 10 and its stop condition ("F-06 real-backend test green **and operator-observed**").

It does not re-open or alter the FBL-028 approval or the FBL-029 observation; those remain exactly as recorded.

## Security posture established by this rung

- Resolving an approval requires an **authenticated operator**. Authenticated *agents* are refused as well — an agent resolving the gate that exists to constrain agents would make the gate ceremonial.
- **`resolvedBy` is derived from the authenticated principal, never the payload.** A contradicting value is refused rather than silently overwritten, so the audit trail cannot disagree with what was submitted.
- A resolved approval is **immutable**: duplicates are idempotent (original decision, resolver, and timestamp stand) and conflicting reversals are rejected.
- The operator credential is **entered and stored locally, not baked into the build** via a `NEXT_PUBLIC_*` variable, which would place a live credential in every build artifact and make rotation a rebuild.
- **This is not a session system** — no expiry, refresh, or logout. V1 excludes authentication as a feature; this is the minimum that makes the operator-only guard real and must not be treated as a production authentication system.

## Effect on the ladder

FBL-030's stop condition is **met** and the rung is **closed**.

FBL-031 (capability-based upgrade) is the next rung of the operator-authorized sequence FBL-030–FBL-035 and is authorized to begin.
