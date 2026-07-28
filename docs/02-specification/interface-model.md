# Interface Model — Agent City V1

**Foundation:** 1.0-rc1  
**Authority:** Primary ultrawide shell and precision UI

## Doctrine

- The **3D operational world** communicates broad operational state.
- The **2D interface** provides exact data, evidence, controls, logs, and approvals.
- Users must not need to navigate a building interior to access critical controls.
- Every meaningful animation has a textual equivalent in the event feed or detail panel.

## Target resolutions

| Resolution | Role |
| --- | --- |
| 5120 × 1440 | Preferred |
| 3840 × 1080 | Supported |
| 2560 × 1440 | Usable fallback |

The **full viewport** must be used. Do not use a generic narrow centered webpage. No app-wide `max-width` may constrain the primary shell.

## Default composition (ultrawide)

| Region | Guidance |
| --- | --- |
| Top system bar | ~5–7% height — connection, health, build summary |
| Left navigation | ~13–16% width — project, stages, agents, buildings, artifacts, approvals, history |
| Central 3D world | ~58–64% width — dominant operational world |
| Right live-intelligence | ~20–24% width — current exceptions, active stage/agents, approvals, warnings |
| Bottom event timeline | ~18–22% height, collapsible |
| Persistent command input | Bottom strip — bounded commands only |
| Selected-object details | Overlay/docked panel from selection |

Panels are **collapsible and resizable**.

## Top system bar

Connection state, health, active build label, unresolved approval badge, demo running/paused.

## Left navigation

Exact navigation; selection synchronized with 3D world; keyboard operable.

## Central 3D world

Neighborhood rendering per `world-model.md`. Camera: pan, zoom, controlled orbit, focus selection, reset, optional saved viewpoints; cannot become lost; respects reduced motion.

## Right live-intelligence region

Surfaces current facts and exceptions only—not a second full dashboard. Links into detail/evidence.

## Bottom event timeline

Chronological feed with filter (severity/entity/type), pause autoscroll, payload inspect, jump to world object, history after reload.

## Persistent command input

V1 commands: show blockers, open pending approval, pause/resume demonstration, focus agent/building, reset demo, replay scenario.  
**Prohibit:** unrestricted natural-language autonomous planning or shell execution.

## Selected-object details

Summary, state reason, current work, dependencies, evidence, event history, permitted controls.

## Hover and selection

Hover shows concise status. Selection opens details and syncs navigator. Accessible names/states required. Color never sole status signal.

## Approval interaction

Approval card with evidence, risk class, recommended action; Approve / Reject / Request revision. Pending: Lighthouse attention + closed gate. Resolution recorded as events.

## Keyboard operation

All critical interactions reachable by keyboard; visible focus; Enter/Space activate; Escape closes panels where appropriate.

## Reduced-motion mode

Replace travel/work flourish animations with clear instantaneous or cross-fade state transitions. Operational meaning preserved.

## Textual equivalents

Every meaningful animation maps to an event-feed template and/or detail explanation.

## Responsive fallback

| Viewport | Behavior |
| --- | --- |
| 5120×1440 | Full density; world dominant |
| 3840×1080 | All mandatory regions retained |
| 2560×1440 | May collapse one support panel; full operation retained |

## Connection / stale state

On disconnect: Lighthouse disconnected, mutation controls disabled, stale banner, last-known projection labeled. On restore: reconcile snapshot, resume stream.
