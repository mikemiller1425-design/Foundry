# ADR-002: Backend operational authority

## Status
Accepted

## Context
Browsers refresh, animations fail, and clients disconnect. Operational progress must remain durable and authoritative.

## Decision
Backend state owns operational truth. All stage, requirement, transfer, approval, agent-location, and upgrade transitions are validated and persisted backend-side. Frontend state renders and temporarily caches truth.

## Alternatives
Frontend-owned operational state; peer-to-peer client truth.

## Consequences
Reliable recovery and auditing; additional backend complexity; visible sync errors when projections disagree.

## Revisit conditions
Not expected to change.
