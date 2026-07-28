# Claude Code Handoff 002 — Frontend Foundation

**Do not use until the specification audit is resolved and baseline 1.0 is approved.**

## Mission

Create the production frontend foundation for Agent City V1. Implement only the shell, shared contracts, deterministic local demo data adapter, and placeholder 3D world composition. Do not implement the real backend or Claude Code runtime adapter.

## Required stack

- Next.js
- TypeScript strict mode
- React
- React Three Fiber / Three.js / Drei
- Tailwind CSS
- Zustand or equivalent small client state store
- TanStack Query
- Vitest
- Playwright
- ESLint and Prettier

## Required deliverables

- full-screen ultrawide application shell;
- left navigator, center world, right live panel, bottom event feed, command bar;
- placeholder geometry for all V1 world objects;
- selection synchronization between canvas and navigator;
- deterministic demo event source using shared event contracts;
- accessible status labels and keyboard selection;
- responsive behavior at required viewports;
- tests for shell layout, object selection, event rendering, and idempotent duplicate-event handling.

## Constraints

- No real AI.
- No Claude Code invocation.
- No OpenClaw.
- No database.
- No unrestricted natural-language commands.
- No Future Registry features.
- No detailed 3D asset work.

## Definition of done

Run typecheck, lint, unit tests, Playwright smoke tests, and production build. Fix all errors. Provide summary, folder tree, test results, and unresolved risks. Stop.
