# ADR-001: Frontend-first with deterministic mock events

## Status
Accepted

## Context
The interface is the primary product uncertainty. A full backend built before validating the world model could encode the wrong abstractions.

## Decision
Build production frontend components against realistic shared contracts and a deterministic mock event engine before connecting a real runtime.

## Alternatives considered
Backend-first implementation; pure visual prototype with no contracts; simultaneous independent frontend/backend teams.

## Consequences
Early interaction validation and replayable demos. Requires discipline so mocks do not become the source of truth.

## Revisit conditions
Revisit after the complete V1 demo works and contracts stabilize.
