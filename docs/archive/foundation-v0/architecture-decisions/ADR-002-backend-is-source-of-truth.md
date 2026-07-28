# ADR-002: Backend owns operational truth

## Status
Accepted

## Context
Browsers refresh, animations can fail, and clients can disconnect. Operational progress must remain durable and authoritative.

## Decision
All stage, requirement, transfer, approval, agent-location, and upgrade transitions are validated and persisted backend-side.

## Alternatives considered
Frontend-owned state; peer-to-peer client truth.

## Consequences
Reliable recovery and auditing, with additional backend complexity.

## Revisit conditions
Not expected to change.
