# ADR-006: Claude Code behind a controlled runtime adapter

## Status
Accepted

## Context
Claude Code is both a development tool and a future Builder runtime. Direct frontend-to-terminal coupling would be unsafe and brittle.

## Decision
Invoke Claude Code through a backend adapter with controlled repository, command policy, timeout, logs, and structured result capture.

## Alternatives considered
Direct shell from frontend; Cursor as runtime; unrestricted autonomous loop.

## Consequences
Replaceable runtime, auditability, safety boundaries. Adds adapter engineering.

## Revisit conditions
Revisit when OpenClaw or multiple runtimes are evaluated after V1.
