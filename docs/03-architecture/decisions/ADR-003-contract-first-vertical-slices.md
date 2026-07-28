# ADR-003: Contract-first vertical slices

## Status
Accepted

## Context
Independent frontend and backend work drifts in vocabulary and payload shape.

## Decision
Frontend and backend share contracts (`packages/contracts`, `packages/event-types`, `packages/world-model`) and evolve features in vertical slices: schema → service → events → UI → animation → tests.

## Alternatives
Finish frontend then backend; ad hoc API evolution.

## Consequences
Less integration rework; clearer acceptance tests; more design before coding.

## Revisit conditions
After V1 if team scale or package boundaries change materially.
