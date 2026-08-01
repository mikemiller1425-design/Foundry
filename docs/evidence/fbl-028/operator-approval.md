# FBL-028 — Operator Approval Record

**Status:** ✅ **APPROVED** — narrow Agent City V1 proof
**Rung:** FBL-028 — Controlled Claude Code execution
**Approved by:** mikemiller1425-design (human operator)
**Date:** 2026-08-01
**Basis of review:** `docs/evidence/fbl-028/operator-review-report.md`
**Approved run:** `AgentRun` `agentrun-fbl-028-backend-implementation`, evidence id `7657ec85-8aa8-4688-aeb7-4a0669aed3ff`, fixture `…/T/foundry-fbl028-VGyvj1`
**Implementation commit under review:** `8998015` (`feat: add controlled Claude Code execution (FBL-028)`)

This record is append-only. A later decision does not edit this file; it is recorded as a new dated entry or a superseding record, consistent with principle 18 (corrections occur through new events, never by rewriting an existing one).

---

## What the operator reviewed

The declared task, the controlled fixture location, the command and tool policy, the captured logs, the diff, the exit status, the independent validation results, the persistence evidence, the containment tests, and the disclosed limitations.

## Approval scope

This approval authorizes exactly the following, and nothing wider:

- One controlled Claude Code Builder stage.
- Disposable, non-sensitive fixture repositories only.
- R0–R2 actions only.
- Invocation **exclusively** through the FBL-027 runtime-adapter boundary.
- Independent validation remains **mandatory**.
- Claude Code **may not self-certify** completion.

## Explicit non-classification

**This approval does not classify the runtime adapter as an OS-level security sandbox.**

The following limitations are **accepted for V1** and **must not be generalized into production security guarantees**:

1. Write confinement is **detected after execution**, not enforced by an OS sandbox.
2. Network posture is **declared, not enforced** at the operating-system level.
3. The process **may access the user-session macOS Keychain** for Claude authentication.
4. Secret-pattern redaction is **defense in depth, not guaranteed isolation**.
5. Execution **must not target** Foundry itself, the user's home directory, a broad `Documents` directory, or any repository containing sensitive or valuable data.

These correspond to limitations 1–5 in §12 of the review report, which remain the authoritative technical description.

## Deferred work

The timing-sensitive browser-test flakiness recorded in §12.7 of the review report is **accepted as deferred hardening work, assigned to FBL-034** (ultrawide performance validation). It **does not block FBL-029**.

## Effect on the ladder

FBL-028's stop condition — "one successful controlled run with evidence captured **and reviewed**" — is now **met**. The rung is **closed**.

FBL-029 remains **unauthorized** and has not been started. Like every rung on this ladder, it requires its own separate, explicit operator authorization before it may begin.
