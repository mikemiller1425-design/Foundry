# ADR-004: React Three Fiber as initial spatial renderer

## Status
Accepted

## Context
The operational world must coexist with a React precision interface and react to application state.

## Decision
React Three Fiber is the initial spatial renderer (Three.js + Drei). Introduce GLB assets only after placeholder geometry validates layout.

## Alternatives
Raw Three.js; Unity/WebGL embed; Spline-only scene.

## Consequences
Shared React patterns and easier state binding; requires 3D performance discipline on ultrawide targets.

## Revisit conditions
Only if performance or asset tooling blocks V1.
