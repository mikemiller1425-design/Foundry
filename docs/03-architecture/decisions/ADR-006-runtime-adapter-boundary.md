# ADR-006: Runtime adapter boundary

## Status
Accepted

## Context
Claude Code, OpenClaw, and future runtimes must not couple to the frontend or bypass policy. Direct terminal invocation is unsafe and brittle.

## Decision
Claude Code, OpenClaw, and future runtimes sit behind backend runtime adapters in `packages/runtime-adapters`, with controlled repository paths, command policy, timeouts, logs, and structured evidence capture.

V1 implements `mock` and one controlled `claude_code` stage. Full OpenClaw integration remains excluded.

## Alternatives
Direct shell from frontend; Cursor as runtime authority; unrestricted autonomous loops.

## Consequences
Replaceable runtimes, auditability, safety boundaries; adapter engineering cost.

## Revisit conditions
When OpenClaw or multiple runtimes are evaluated after V1 under a new mission baseline.
