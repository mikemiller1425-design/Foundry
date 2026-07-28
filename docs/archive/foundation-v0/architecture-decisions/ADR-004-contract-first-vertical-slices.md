# ADR-004: Contract-first vertical slices

## Status
Accepted

## Context
Independent frontend and backend implementation can drift in vocabulary and payload shape.

## Decision
Define shared schemas first, then complete features through database, service, event, UI, animation, and tests.

## Alternatives considered
Complete frontend then complete backend; ad hoc API evolution.

## Consequences
Reduced integration rework and clearer acceptance tests. Slightly more design work before coding.

## Revisit conditions
Revisit after V1 only if team scale changes.
