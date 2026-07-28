# Foundry Principles

**Foundation:** 1.0-rc1  
**Authority:** Non-negotiable laws for Foundry and Agent City V1

## Operational truth

1. **Backend state owns operational truth.** Stage, requirement, transfer, approval, agent location, and upgrade transitions are validated and persisted backend-side.
2. **Frontend state renders and temporarily caches truth.** The frontend may display, interpolate, and animate; it may not independently declare completion, approval resolution, transfer legality, authority changes, or upgrade activation.
3. If frontend and backend disagree, backend wins and the discrepancy is visible as a synchronization or stale-state error.

## World fidelity

4. **Meaningful animations require declared operational events.**
5. **Ambient animation may create atmosphere but cannot imply false activity.**
6. **Buildings represent persistent capabilities or institutions.**
7. **Residences represent persistent worker identity.**
8. **Workplaces represent execution environments.**
9. **Tasks, stages, and builds are temporary.**
10. **Artifacts are inspectable outputs** with provenance and status.
11. **Transfers require completed prerequisites.**
12. **Vehicles visualize transfers and never authorize them.** Roads show permitted routes; they do not prove a transfer exists.
13. Location must communicate ownership, sequence, dependency, risk, or structure when it can.

## Governance and safety

14. **Humans govern.**
15. **Agents execute within explicit authority.**
16. **Approvals are auditable** (who, what, when, evidence, decision).
17. **Failures remain inspectable**, attributable, and not silently retried beyond policy.
18. Events are immutable facts; corrections occur through new events.
19. Risk classes R0–R2 may be implemented in V1 inside a controlled repository. R3–R5 remain excluded unless a new mission baseline authorizes them.

### Risk classes

| Class | Meaning |
| --- | --- |
| R0 | Observe |
| R1 | Reversible internal action |
| R2 | Controlled internal change |
| R3 | External action |
| R4 | Destructive action |
| R5 | Financial or legal action |

## Progression

20. **Upgrades require evidence and real capability changes.** Cosmetic upgrades without operational meaning are outside V1.
21. Mandatory prerequisites cannot be skipped.
22. The Lighthouse does not perform project implementation work.

## Interface

23. World Mode and Command Mode are complementary. Critical controls and facts must remain available outside the 3D world.
24. Every meaningful animation has a textual equivalent in the event feed or detail panel.
25. The primary V1 canvas is a 49-inch ultrawide; the full viewport is used intentionally.

## Development discipline

26. Implementation follows contract-first vertical slices.
27. **Future ideas are preserved without automatically entering active development.**
28. **Only the active mission may be implemented.**
29. Future Registry concepts do not authorize implementation.
30. Archived documents never override active documents.

## Non-negotiable checklist

1. Backend owns operational truth.
2. Meaningful world activity corresponds to real events.
3. Agents cannot occupy two operational locations simultaneously.
4. Mandatory prerequisites cannot be skipped.
5. Transfers require completed gates and recorded transfer state.
6. Vehicles never authorize transfers.
7. Every approval leaves an audit trail.
8. Every failure remains inspectable.
9. Every meaningful backend state has a readable frontend representation.
10. Every meaningful frontend operational claim identifies its backend reason.
11. Visual upgrades require real capability upgrades.
12. Future Registry and archives do not authorize implementation.
