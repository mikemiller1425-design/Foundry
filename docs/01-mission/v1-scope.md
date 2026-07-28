# Agent City V1 Scope

**Foundation:** 1.0-rc1  
**Authority:** Positive scope for the active mission

## Required world elements

- Lighthouse
- Architect residence
- Builder residence
- Inspector residence
- Construction office
- Warehouse
- QA building
- Deployment dock
- Construction site
- Road network
- One utility vehicle
- One cargo representation
- One approval gate

## Required workers

- Architect Agent
- Builder Agent
- Inspector Agent

## Required workflow

1. Operator submits objective.
2. Build is created.
3. Architect creates stages, requirements, and acceptance criteria.
4. Builder is assigned.
5. Requirements complete incrementally.
6. One required item fails.
7. Progression and transfer remain blocked.
8. Builder retries and repairs the failure.
9. Inspector validates independently.
10. Artifact becomes transfer-ready.
11. Utility vehicle visualizes transfer.
12. Human approval is requested.
13. Lighthouse signals attention.
14. Operator approves or rejects.
15. Workflow resumes only after valid approval.
16. Build completes.
17. A building becomes upgrade-eligible.
18. Operator approves upgrade.
19. Visual level and actual capability state both change.
20. State and event history survive reload or restart.

## Demonstration objective

Build a basic task-management web application supporting task creation, completion, deletion, loading states, error states, persistence, and tests.

## Technical inclusions (when implementation is authorized)

- Next.js / TypeScript frontend
- React Three Fiber / Three.js world renderer
- Tailwind CSS and accessible React UI
- Shared contracts in `packages/`
- Deterministic mock runtime first
- Thin authoritative backend with persistence
- Realtime event delivery (SSE or WebSockets)
- Unit, integration, and end-to-end tests
- One Claude Code stage behind a runtime adapter
- Risk classes R0–R2 only

## Interface inclusions

Full-screen ultrawide shell; dominant 3D world; left navigation; right live-intelligence region; bottom event timeline; persistent command input; selected-object details; approval and evidence views; collapsible/resizable panels; responsive fallback for listed viewports.
