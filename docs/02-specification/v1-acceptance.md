# V1 Acceptance — Agent City

**Foundation:** 1.0  
**Authority:** Observable finish line for Agent City V1

## Ten-second comprehension

Within ten seconds, an operator must be able to understand:

- What is running
- Who is working
- What is blocked
- What failed
- What needs approval
- What completed
- What should happen next

## Test environment

Primary: macOS desktop browser on 49-inch ultrawide.  
Viewports: 5120×1440, 3840×1080, 2560×1440.  
Browsers: current Chrome and Safari.  
Input: mouse and keyboard.  
Reduced-motion preference respected.

## Primary user journey

1. Open application; full viewport used (no centered fixed-width page).
2. All required world elements and three agents present.
3. Header reports connected/healthy.
4. Operator submits objective; build created.
5. Architect plans stages/requirements.
6. Builder assigned; requirements complete incrementally.
7. One required item fails; progression and transfer blocked; cargo unsealed; vehicle parked.
8. Exact failed requirement inspectable with evidence.
9. Builder retries and repairs; Inspector validates independently.
10. Approval requested for the validated artifact; Lighthouse attention; gate closed.
11. Operator approves or rejects with evidence; workflow resumes only after valid approval.
12. Artifact becomes transfer-ready; vehicle moves only after `transfer.started`, carrying the package to the Deployment Dock.
13. Build completes; construction site and Deployment Dock reflect completion.
14. Building becomes upgrade-eligible from real metrics; operator approves; visual level and capability both change.
15. Reload/restart restores world, build, events, inventory, agent locations, upgrade level.

**Transfer detail (resolves audit finding B-01):** step 9's Inspector validation begins only after the package has physically arrived at QA via the (non-approval-gated) Warehouse → QA transfer's receipt — never before. Step 12's transfer is specifically the QA → Deployment Dock leg, the only approval-gated leg, occurring during `deployment_package`; `build.completed` (step 13) follows only after that transfer's receipt at the Dock. Full per-leg preconditions: `docs/01-mission/v1-scope.md` § "Transfer and approval scope".

## Functional tests

| ID | Requirement |
| --- | --- |
| F-01 | Demo start/pause/resume/speed/reset/replay without corrupting order |
| F-02 | Every building/agent selectable via pointer and keyboard; navigator sync |
| F-03 | Frontend cannot force stage completion, transfer readiness, approval, or upgrade completion |
| F-04 | Mandatory failed/pending requirement blocks stage completion and transfer readiness |
| F-05 | Builder cannot produce `stage.validation_passed`; Inspector path required |
| F-06 | Pending approval pauses gated transition; approve/reject/revision paths defined |
| F-07 | Agent/build pause-resume record commands/events; rejected commands visible |
| F-08 | Event history survives reload and reconstructs projection |
| F-09 | Duplicate events do not duplicate cargo, timeline rows, agents, or transfers |
| F-10 | Disconnect disables mutations and shows disconnected/stale; restore reconciles |
| F-11 | Warehouse upgrade from real metrics; capacity 25→100; batch intake in mock |
| F-12 | One controlled Claude Code stage via adapter with logs/exit/outputs/evidence |

## Visual-to-operational consistency

| ID | Requirement |
| --- | --- |
| V-01 | Ten-second comprehension using labeled regions |
| V-02 | Meaningful motion/states match backend; no false completion during animation |
| V-03 | Every meaningful animation has text equivalent |
| V-04 | Cargo remains incomplete while intentional requirement failed |
| V-05 | Vehicle cannot depart before `transfer.started` |
| V-06 | Lighthouse states distinct and labeled |
| V-07 | Warehouse visual level changes only after `upgrade.completed` |
| V-08 | Ultrawide uses full screen; world remains dominant |

## Ultrawide layout

- No app-wide max-width on primary shell
- Panels resizable/collapsible
- Camera uses horizontal space intentionally
- Controls readable at desk distance; edge padding
- Density targets per resolution in interface model

## Persistence

- Reload idle / blocked / pending approval / completed restores exact relevant state
- Backend restart rebuilds projection from stored entities/events

## Failure and recovery

- Intentional requirement failure produces evidence and retry
- Agent runtime failure → failed agent/workplace states
- Invalid transition → structured rejection, no mutation
- Disconnect preserves last-known labeled stale
- Failed upgrade retains prior capability/visual
- Claude Code timeout terminates safely and stores logs

## Idempotency

Replaying duplicate event IDs leaves entity counts and UI rows unchanged.

## Accessibility

Keyboard critical path; visible focus; color not sole signal; reduced motion; semantic panel structure; canvas objects have navigator equivalents.

## Performance

- Usable shell &lt; 3s local warm start on target Mac
- 45+ FPS target in world mode; 30 FPS minimum under full panels
- Event feed handles 10,000 retained events via virtualization/filtering
- Selection feedback &lt; 100 ms
- Realtime update visible &lt; 500 ms on local network

## Reduced motion

Operational state changes remain clear without travel flourish animations.

## Definition of done

V1 is done only when:

- all mandatory tests pass;
- no TypeScript, lint, or production build errors remain;
- automated tests cover transitions, idempotency, approval gates, transfer gates;
- deterministic demo completes reliably;
- one real Claude Code stage completes in the controlled adapter;
- documentation matches implementation;
- excluded features remain unimplemented.

## Explicit non-goals

Everything in `docs/01-mission/exclusions.md` and all Future Registry concepts.
