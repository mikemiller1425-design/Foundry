# Handoff 002 — Frontend Foundation

```text
BLOCKED — requires reviewed Foundation v1 audit
```

**Do not execute this handoff until:**

1. `docs/audits/foundry-foundation-v1-audit.md` exists
2. Blocking findings are reviewed and resolved
3. Foundation status is explicitly advanced for implementation

## Mission (future)

Create the production frontend foundation for Agent City V1 inside `apps/agent-city/`. Implement only the shell, shared contracts, deterministic local demo/mock data adapter, and placeholder 3D neighborhood composition.

## Approved stack

- Next.js
- TypeScript
- React
- React Three Fiber
- Three.js
- Tailwind CSS
- Zustand
- Vitest
- Playwright

## Deliverables (when unblocked)

- full-screen ultrawide application shell
- left navigation, center world, right live-intelligence, bottom event timeline, command input
- placeholder geometry for all V1 world objects
- selection sync between canvas and navigator
- deterministic demo events using shared contracts
- accessible labels and keyboard selection
- responsive behavior at required viewports
- tests for layout, selection, event rendering, idempotent duplicates

## Prohibit

- Backend implementation
- Claude Code runtime integration
- OpenClaw integration
- Database
- External integrations
- Future Registry features
- Detailed production 3D assets
- Using `docs/archive/foundation-v0/` as authority

## Definition of done (when unblocked)

Typecheck, lint, unit tests, Playwright smoke, production build all pass. Provide summary, folder tree, test results, and unresolved risks. Stop.
