# Agent City V1 Scope

**Foundation:** 1.0  
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

**Canonical sequence (resolves audit finding B-01):** work → validate → approve → transfer → dock. Inspector validation always precedes the approval request; the approval request always precedes the final transfer; the final transfer always precedes build completion. No step may be reordered.

1. Operator submits objective.
2. Build is created.
3. Architect creates stages, requirements, and acceptance criteria.
4. Builder is assigned.
5. Requirements complete incrementally.
6. One required item fails.
7. Progression and transfer remain blocked.
8. Builder retries and repairs the failure.
9. Inspector validates independently.
10. Human approval is requested for the validated artifact.
11. Lighthouse signals attention.
12. Operator approves or rejects.
13. Workflow resumes only after valid approval.
14. Artifact becomes transfer-ready.
15. Utility vehicle visualizes the transfer to the Deployment Dock.
16. Build completes.
17. A building becomes upgrade-eligible.
18. Operator approves upgrade.
19. Visual level and actual capability state both change.
20. State and event history survive reload or restart.

### Transfer and approval scope (B-01)

V1 defines exactly three transfer legs, each with an explicit, satisfiable, non-circular precondition. No leg's readiness ever depends on the completion of its own destination or containing `BuildStage` — only on the stage that already finished producing the artifact (or, for the Warehouse → QA leg, on the destination stage being merely `ready`, not `completed`):

- **Construction Office → Warehouse:** ready when `integration` is `completed` and the artifact is ready. Not approval-gated.
- **Warehouse → QA:** ready when `integration` is `completed`, the artifact is ready, and `qa_validation` is `ready` (queued to start, not yet completed — QA cannot have completed work on an artifact it has not received). Not approval-gated. This leg's `transfer.completed` (receipt at QA) is the precondition that permits `qa_validation`'s `stage.started`: **Inspector validation begins only after the artifact physically arrives at QA**, never before.
- **QA → Deployment Dock:** ready when `qa_validation` is `completed`, the artifact is ready, and the build's Approval is resolved as `approved`. This is the **only** approval-gated leg, and the only one named in the numbered sequence above (step 15). It occurs during the `deployment_package` stage: `deployment_package.started` begins with this transfer's `transfer.started`, and `deployment_package.completed` fires only after this transfer's `transfer.completed` and receipt at the Dock — `build.completed` follows immediately after.

This closes the circular reading previously latent in Required Invariant 3 ("a stage must complete before transfer readiness"): that invariant always refers to the stage that **produced** the artifact being moved, never to the transfer's own destination or containing stage — no transfer's readiness ever waits on its own containing stage's completion. At most one Transfer is ever in a non-terminal state at a time (consistent with "one active transfer; one vehicle"), so these three legs are always sequential, never concurrent.

### V1 Build Stages (B-02)

The Architect plans exactly these seven named, sequential `BuildStage`s for the V1 demonstration build. Names are stable identifiers referenced by `domain-model.md`, `event-model.md`, and the acceptance tests.

| Sequence | `BuildStage` name | Location | Runtime | Notes |
| --- | --- | --- | --- | --- |
| 1 | `planning` | Construction Office | Architect (mock) | Produces the plan artifact: stages, requirements, acceptance criteria |
| 2 | `scaffold` | Construction Office | Builder (mock) | Scaffolds the demo application skeleton |
| 3 | `frontend_implementation` | Construction Office | Builder (mock) | Implements task creation/completion/deletion, loading/error states. **Carries the one intentional required-item failure** (Requirement: "Delete task — error-state handling" fails on first attempt; Builder retries and repairs it) |
| 4 | `backend_implementation` | Construction Office | Builder via **`claude_code`** runtime (the one controlled Claude Code stage, R0–R2 only) | Implements persistence/API and tests for the demo application |
| 5 | `integration` | Construction Office → Warehouse | Builder (mock) | Wires frontend and backend together; produces the single build package artifact. Its completion (plus artifact readiness) is the sole precondition for the Construction Office → Warehouse transfer |
| 6 | `qa_validation` | Warehouse → QA | Inspector (mock) | Enters `ready` once `integration` completes (one precondition for the Warehouse → QA transfer becoming ready); enters `running` (`stage.started`) only after that transfer's `transfer.completed` — Inspector validation begins strictly after the artifact is received at QA, never before. Produces `stage.validation_passed`/`failed` |
| 7 | `deployment_package` | QA → Deployment Dock | System (transfer + receipt) | Its `approvalId` links to the Approval requested once `qa_validation` completes. Becomes `ready` only once `qa_validation` is `completed` and that Approval resolves `approved`; `stage.started` begins the QA → Deployment Dock transfer (the sole approval-gated leg); stage completes only after `transfer.completed` and receipt at the Dock; `build.completed` follows immediately |

No V1 build may use a stage name outside this table. Any future stage requires a mission amendment, not a silent addition during implementation.

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
