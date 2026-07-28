# ADR-001: Frontend-first with deterministic mock runtime

## Status
Accepted

## Context
The interface is the primary product uncertainty. Building a full backend before validating the operational world risks encoding the wrong abstractions.

## Decision
Validate the frontend first against realistic shared contracts and a deterministic mock runtime before connecting a real runtime adapter.

## Alternatives
Backend-first; pure visual prototype without contracts; parallel teams without shared schemas.

## Consequences
Early interaction validation and replayable demos. Requires discipline so mocks never override operational truth.

## Revisit conditions
After the complete V1 demo works and contracts stabilize.
