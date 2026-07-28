# ADR-003: Use React Three Fiber for the world renderer

## Status
Accepted

## Context
The world must coexist with a React-based precision interface and react to application state.

## Decision
Use Three.js through React Three Fiber and Drei, with GLB assets introduced after placeholder geometry validates layout.

## Alternatives considered
Raw Three.js; Unity/WebGL embed; Spline-only scene.

## Consequences
Shared React patterns, easier state binding, browser-native deployment. Requires 3D performance discipline.

## Revisit conditions
Revisit only if performance or asset tooling blocks V1.
