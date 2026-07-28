# Specification 004 — V1 Acceptance

**Purpose:** Define the observable finish line for Agent City V1.

## 1. Test environment

Primary: macOS desktop browser on 49-inch ultrawide.  
Required viewport tests: 5120×1440, 3840×1080, 2560×1440.  
Supported browsers: current Chrome and Safari.  
Input: mouse and keyboard.  
Reduced-motion preference must be respected.

## 2. Primary end-to-end journey

1. User opens the application.
2. Full viewport is used without a centered fixed-width page.
3. Lighthouse, three homes, Construction Office, Warehouse, QA Building, Deployment Dock, Construction Site, roads, one vehicle, and three residents are present.
4. Header reports connected and healthy.
5. User starts the deterministic demonstration build.
6. Backend creates Project and Build records and emits `build.created`.
7. Architect is assigned, departs home, arrives at Construction Office, and produces a plan.
8. Stages and requirements appear in exact panels.
9. Builder is assigned and begins the Frontend Implementation stage.
10. Requirements pass incrementally.
11. One named requirement intentionally fails.
12. Cargo remains open/unsealed.
13. Transfer status is blocked.
14. Vehicle remains parked.
15. Selected-object panel explains the failed requirement and links to evidence.
16. Builder retry begins.
17. Failed requirement passes.
18. Inspector validates the stage independently.
19. Stage completes.
20. Artifacts validate and transfer becomes ready.
21. Cargo seals only after `transfer.ready`.
22. Vehicle loads and travels only after `transfer.started`.
23. QA receives the package.
24. Approval is requested before final handoff.
25. Lighthouse turns yellow and approval gate closes.
26. User inspects evidence and approves.
27. Workflow resumes.
28. Final package reaches Deployment Dock.
29. Build completes and Construction Site becomes a completed structure.
30. Warehouse upgrade requirements evaluate from retained metrics.
31. Warehouse becomes Level 2 eligible.
32. User authorizes upgrade.
33. Backend capability changes and `building.upgraded` emits.
34. Visual Warehouse changes to Level 2.
35. User reloads page.
36. World, build, events, inventory, agent locations, and upgrade level restore correctly.

## 3. Functional acceptance tests

### F-01 Start and control demo
Start, pause, resume, speed change, reset, and replay work without corrupting order.

### F-02 Object selection
Every building and agent can be selected via pointer and keyboard. 2D navigator selection stays synchronized.

### F-03 Backend authority
Frontend cannot directly force Stage completion, Transfer readiness, Approval resolution, or Upgrade completion.

### F-04 Prerequisite enforcement
Mandatory failed or pending Requirement blocks Stage completion and Transfer readiness.

### F-05 Independent validation
Builder completion claim cannot create `stage.validation_passed`; Inspector path is required.

### F-06 Approval gate
Pending Approval pauses gated transition. Approve, reject, and revision-request each follow defined paths.

### F-07 Safe controls
Agent pause/resume and Build pause/resume record commands and events. UI reflects rejected commands.

### F-08 Event persistence
Event history survives reload and can reconstruct current projection.

### F-09 Idempotency
Replaying duplicate events does not duplicate cargo, timeline rows, agents, or transfers.

### F-10 Reconnection
When realtime connection drops, mutation controls disable and Lighthouse becomes disconnected. Restored connection reconciles snapshot.

### F-11 Warehouse upgrade
Eligibility comes from real stored metrics. Upgrade changes capacity from 25 to 100 and enables batch intake in mock engine.

### F-12 Claude Code stage
At least one controlled stage can invoke a Claude Code runtime adapter, capture logs, exit status, outputs, and evidence without unrestricted system access.

## 4. Visual acceptance tests

### V-01 Immediate comprehension
A first-time viewer can identify overall health, active agent, current stage, blocker, and pending approval within ten seconds using labeled interface regions.

### V-02 Operational fidelity
Meaningful movement and building states match backend state. No false completion is shown during animation.

### V-03 Text equivalence
Every meaningful animation has a corresponding text event or detail explanation.

### V-04 Cargo gate
Cargo visibly remains incomplete while the intentional requirement is failed.

### V-05 Vehicle gate
Vehicle cannot depart before `transfer.started`.

### V-06 Lighthouse states
Healthy, active, attention-required, degraded, critical, and disconnected are visually distinct and labeled.

### V-07 Upgrade fidelity
Warehouse visual level changes only after backend Upgrade completion.

### V-08 No layout waste
At ultrawide resolutions, the interface uses the full screen and world remains dominant.

## 5. Ultrawide acceptance tests

- No app-wide `max-width` constrains the primary shell.
- Left, right, and bottom panels are resizable or collapsible.
- World camera composition uses horizontal space intentionally.
- Text and controls remain readable at normal desk distance.
- Important controls have edge padding and are not stranded at extreme corners.
- 5120×1440 maintains useful density without oversized empty areas.
- 3840×1080 maintains all mandatory regions.
- 2560×1440 may collapse one support panel but retains full operation.

## 6. Persistence tests

- Reload during idle restores idle world.
- Reload during blocked stage restores exact blocker.
- Reload during pending approval restores closed gate and yellow Lighthouse.
- Reload after completion restores final structure and history.
- Restart backend and rebuild projection from database/events.

## 7. Failure and recovery tests

- Intentional requirement failure produces evidence and retry option.
- Agent runtime failure moves Agent and workplace to failed state.
- Invalid transition returns structured rejection and does not mutate state.
- Realtime disconnect preserves last-known state but labels it stale.
- Failed Upgrade preserves Level 1 capabilities and visual model.
- Claude Code timeout terminates safely and stores logs.

## 8. Performance tests

- Initial usable shell under 3 seconds on target Mac after local warm start.
- Stable 45+ FPS target in world mode on target hardware; 30 FPS minimum under full panel load.
- Event feed handles 10,000 retained events through virtualization/filtering.
- Selection feedback begins within 100 ms.
- Realtime state update visible within 500 ms on local network.

## 9. Accessibility tests

- All critical interactions keyboard accessible.
- Visible focus states.
- Color not used as sole status indicator.
- Reduced-motion mode replaces travel animations with clear transitions.
- Panels expose semantic headings and controls.
- Canvas objects have accessible parallel navigation entries.

## 10. Security and containment tests

- Claude Code adapter uses a controlled repository path.
- No destructive filesystem commands permitted by default.
- No secrets displayed in logs or event payloads.
- Operator mutation endpoints require local authenticated session or equivalent development protection.
- Runtime command allowlist/denylist is tested.

## 11. Definition of done

V1 is done only when:

- all mandatory tests pass;
- no TypeScript, lint, or production build errors remain;
- automated tests cover state transitions, event idempotency, approval gates, and transfer gates;
- the deterministic demo completes reliably;
- one real Claude Code stage completes in the controlled adapter;
- project documentation matches implementation;
- excluded features remain unimplemented.
