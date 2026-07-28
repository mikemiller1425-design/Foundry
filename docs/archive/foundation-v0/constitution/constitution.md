# Agent City Constitution

**Version:** 1.0-draft  
**Authority:** Highest product-level governing document  
**Applies to:** Frontend, backend, runtime adapters, agents, simulations, visual assets, workflows, and future expansions

## 1. Mission

Agent City is a spatial operating environment for supervising autonomous work.

Its purpose is to make complex digital organizations understandable and governable by representing agents, capabilities, workflows, dependencies, artifacts, approvals, failures, and progress as a persistent virtual world.

Agent City is not primarily a game, decorative simulation, or conventional dashboard. Game mechanics are used only when they improve comprehension, control, memory, motivation, or operational safety.

## 2. Core doctrine

> The virtual world is never a simulation of work. It is a spatial representation of real work.

Every meaningful building state, resident movement, cargo transfer, vehicle trip, warning, construction phase, and upgrade must correspond to a real system entity, state transition, validated result, or recorded event.

Ambient motion may exist for atmosphere, but ambient motion must never imply operational progress.

## 3. Source of truth

The backend owns operational truth.

The frontend may display, cache, interpolate, animate, and arrange state, but it may not independently declare that a stage passed, artifact completed, approval resolved, transfer became legal, agent gained authority, or upgrade became active.

If the frontend and backend disagree, the backend wins and the discrepancy must be visible as a synchronization error.

## 4. Human governance

Agents execute. Humans govern.

The system must preserve clear evidence of:

- who proposed an action;
- who executed it;
- who validated it;
- who approved or rejected it;
- what policy allowed it;
- what artifacts and evidence supported it;
- when each event occurred.

High-risk actions must not be hidden behind animations or conversational summaries.

## 5. Spatial meaning

Space must communicate relationships.

- Homes represent persistent identity.
- Workplaces represent operational capabilities.
- Roads represent permitted routes or dependencies.
- Vehicles represent transfers.
- Warehouses represent storage, queues, inventory, or retained artifacts.
- Governance buildings represent authority, policy, approvals, or oversight.
- Construction represents incomplete capability.
- Upgrades represent verified increases in capability.

Location must not be arbitrary when it can communicate ownership, sequence, dependency, risk, or organizational structure.

## 6. Capability-based progression

Visual progression must reflect real maturity.

A building may upgrade only when:

1. explicit prerequisites exist;
2. those prerequisites are measured;
3. the measurements pass;
4. required evidence is retained;
5. required approval is recorded;
6. the underlying capability changes.

Cosmetic upgrades without operational meaning are outside V1.

## 7. Residents and employment

A resident represents one persistent agent identity.

A resident may change assignments, workplaces, projects, and authority within policy. A resident may not exist in two operational locations simultaneously.

An agent's home represents its identity, history, permissions, tools, memory references, and performance—not active project work.

## 8. Work and artifacts

Tasks are temporary work units. Artifacts are outputs. Projects organize work. Builds are bounded attempts to produce a result. Stages gate progression. Requirements define completion. Transfers move artifacts or responsibility between locations.

Artifacts do not teleport. A backend transfer record must exist before a meaningful transfer animation may begin.

## 9. Prerequisites and gates

No stage, transfer, deployment, or upgrade may proceed while a mandatory prerequisite remains unresolved.

The system must make blocked conditions inspectable. The user must be able to see:

- what is missing;
- who owns the missing work;
- whether it failed, is pending, or needs approval;
- what evidence is required;
- what action can unblock it.

## 10. Failures

Failure is first-class operational information.

Failures must remain visible, inspectable, attributable, and recoverable where possible. The interface must not convert failures into vague states such as “something went wrong” when specific evidence exists.

A failed action must not be silently retried beyond policy limits.

## 11. Auditability

Events are immutable facts. Corrections occur through new events, not by rewriting history.

Every approval, permission change, failed validation, transfer, build completion, and upgrade must leave an audit record.

## 12. Safety and authority

Authority must be explicit and scoped.

V1 uses these risk classes:

- **R0 — Observe:** read-only inspection, logs, metadata.
- **R1 — Reversible internal action:** drafts, test artifacts, local staging changes.
- **R2 — Controlled internal change:** changes within a sandbox or approved repository branch.
- **R3 — External action:** publishing, messaging, deployment, or contacting external parties.
- **R4 — Destructive action:** deletion, overwrite, irreversible migration.
- **R5 — Financial or legal action:** spending, contracts, tax, regulated commitments.

V1 may implement R0–R2 in a controlled repository. R3–R5 remain excluded unless later authorized by a new mission baseline.

## 13. Interface doctrine

The interface has two complementary layers:

- **World Mode:** spatial awareness, status, movement, bottlenecks, ownership, and progression.
- **Command Mode:** exact records, controls, logs, approvals, evidence, configuration, and search.

The 3D world must never be the only way to access a critical control or fact.

Every meaningful animation must have a textual equivalent in the event feed or detail panel.

## 14. Ultrawide doctrine

The primary V1 interface is designed for a 49-inch ultrawide display. It must intentionally use the full viewport rather than placing the application inside a narrow centered page.

The world remains the dominant region while persistent operational panels preserve precision.

## 15. Development discipline

Implementation follows contract-first vertical slices.

Before a feature is built, the project must define:

1. the real entity or capability represented;
2. the backend state or event driving it;
3. the frontend representation;
4. the user interaction;
5. the acceptance test;
6. the failure behavior.

Claude Code may implement specifications but may not redefine this constitution or expand the active mission without explicit authorization.

## 16. Drift capture rule

New ideas are treated seriously but not implemented immediately.

For each new idea:

1. determine whether it is required for the active mission;
2. if yes, amend the mission through an explicit decision;
3. if it changes a permanent principle, propose a constitutional amendment;
4. otherwise, record it in the Future Registry;
5. return to the active mission.

## 17. Non-negotiable laws

1. The backend owns operational truth.
2. Meaningful world activity must correspond to real events.
3. Agents cannot occupy two operational locations simultaneously.
4. Mandatory prerequisites cannot be skipped.
5. Transfers require completed gates and recorded transfer state.
6. The Lighthouse does not perform project implementation work.
7. Every approval leaves an audit trail.
8. Every failure remains inspectable.
9. Every meaningful backend state has a readable frontend representation.
10. Every meaningful frontend state must identify its backend reason.
11. Visual upgrades require real capability upgrades.
12. Future Registry concepts do not authorize implementation.
