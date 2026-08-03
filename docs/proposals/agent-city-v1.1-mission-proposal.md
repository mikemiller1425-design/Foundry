# Proposal — Agent City V1.1 Mission Baseline

**Type:** Proposal. Not a mission baseline, not an amendment, not authority.
**Date:** 2026-08-03
**Proposed by:** Claude Code, under operator instruction
**Basis:** `docs/audits/agent-city-post-v1-truth-audit.md`
**Status:** **Awaiting operator review.** Nothing in this document authorizes any work.

---

## 0. Standing

This proposal does not change Foundry Foundation 1.0, does not reopen the V1 Build Ladder, does not alter any V1 evidence, and promotes nothing from `docs/04-future/registry.md`.

Foundry Foundation 1.0 remains frozen. Agent City V1 remains complete. `FBL-001`–`FBL-035` and `FBL-021A` remain historical completed authority. Finding 6 remains open technical debt. Future Registry concepts remain inactive.

If the operator ratifies this, ratification is a separate, explicit act that produces its own mission document — this file remains a proposal permanently.

---

## 1. Proposed mission name

**Agent City V1.1 — Operational Readiness and First Real Build**

## 2. Proposed mission outcome

> One operator launches Foundry through a documented single command, submits one bounded real software objective, reviews a structured plan, authorizes controlled execution, observes real Architect/Builder/Inspector stages through backend authority, resolves a human approval, and receives independently validated output.

Every clause is a gate. The mission is complete only when all of them hold in one continuous session, performed by the operator, against the real backend, with no seed script and no hand-submitted command.

## 3. Why this mission, and why now

V1 built the parts. It did not connect them to a human intent.

The audit establishes three facts that together define this mission:

- **The enforcement layer is complete and unreachable.** Transition graphs, invariant guards, credentialed identity, the SSE projection, and the runtime policy boundary are all real, tested, and correct — and nothing in the product exercises most of them, because nothing decides what happens next (`PV1-016`, `PV1-025`).
- **The operator cannot express an intention.** "Operator submits objective" is step 1 of the required workflow and step 4 of the acceptance journey. There is no control for it anywhere, in either runtime mode (`PV1-026`, `PV1-050`).
- **The one real AI execution is out-of-band.** It runs from a CLI, against a fixture compiled into a package, on a separate database, with no relationship to any build the world displays (`PV1-022`).

The result is a product whose stated philosophy — "The virtual world is never a simulation of work. It is a spatial representation of real work" — is not what it does during normal operation (`PV1-049`). V1.1 exists to close exactly that, and nothing else.

## 4. Success statement

V1.1 succeeds when an operator, on a machine that has never run Foundry, can:

1. Run one documented command and reach a working Foundry.
2. Type one bounded objective and submit it.
3. Read a structured plan the system produced, and decide whether to proceed.
4. Authorize execution as an explicit act.
5. Watch real Architect, Builder, and Inspector stages progress — with every state change originating from backend authority, not from a script.
6. Resolve one real approval that genuinely blocks progression until resolved.
7. Receive an artifact whose correctness was determined by validation the Builder did not write and could not run.
8. Restart everything and find the same truth.

## 5. What "one bounded real software objective" means

Deliberately narrow, because "real" and "unbounded" are different words.

**In scope:**
- A single, small, self-contained software artifact — on the order of one module with a specification and a test suite.
- Executed inside a workspace **Foundry creates and controls**, never a pre-existing project directory.
- Risk classes **R0–R2 only**, unchanged from V1 (`principles.md` 19, `V1RiskClassSchema`).
- The Builder cannot write, modify, or execute its own validation. This property from `packages/runtime-adapters/src/controlledStage/fixture.ts` is the load-bearing guarantee of the whole mission and is **non-negotiable**.

**Not in scope:** arbitrary user-chosen projects, multi-repository work, existing codebases, anything requiring network egress beyond the model API, anything the operator has not seen a plan for.

**Open for operator decision:** whether the objective is chosen from a small curated set or entered as free text within a validated envelope. See §9.

## 6. Explicit exclusions

Excluded from V1.1, in addition to every exclusion in `docs/01-mission/exclusions.md`, which carries forward unchanged:

- Districts
- Additional institutions
- Economy simulation
- Citizens
- Multiplayer
- Building interiors
- Agent hiring
- Academy
- Broad OpenClaw integration
- Financial actions
- External publishing
- Destructive filesystem authority
- Arbitrary unrestricted projects
- Production cloud deployment
- Large visual asset expansion beyond one cohesive neighborhood pass

**Rule, restated from `exclusions.md`:** if a proposed capability is not named in this proposal's scope, it is excluded until this baseline is formally amended. No excluded feature may be added as a substitute for a required feature that is failing.

## 7. What V1.1 explicitly preserves

Preservation is a requirement, not a default. Each of these was earned and can be lost by accident.

| Preserved | Why it must not regress |
| --- | --- |
| **The deterministic mock runtime** | It is the regression baseline (`v1-canonical-run.json`), the default for tests, and the only reproducible full journey. It becomes a *selected mode*, never a removed one. |
| **Independent Inspector validation** | `stage.validation_passed` must remain unreachable via the Builder or the frontend. F-05 is a structural guarantee, not a policy. |
| **Backend authority** | Every V1.1 state change goes through the existing `CommandHandler`. The orchestrator gets no second write path — it is a *client* of the same enforcement every other caller uses. |
| **The R0–R2 ceiling** | `V1RiskClassSchema` makes R3–R5 unrepresentable. It stays that way. |
| **Runtime cannot self-certify** | Validation is written in advance, the runtime has no shell, and Foundry runs the tests. |
| **Every V1 acceptance behavior** | F-01–F-12 and V-01–V-08 continue to pass in mock mode throughout. A V1.1 regression in V1 behavior is a stop condition. |
| **Append-only evidence** | Records are superseded by new dated entries, never edited (principle 18). |

## 8. Relationship to the V1 Build Ladder

The V1 ladder is closed and untouched. V1.1 work would proceed on a **new ladder with new stable identifiers `AC-101` onward** — a distinct namespace from `FBL-*`, so no reader can mistake a V1.1 rung for V1 history and no `FBL` identifier is ever reused or renumbered.

Proposed ladder: `docs/proposals/agent-city-v1.1-build-ladder-proposal.md`.

## 9. Decisions required before ratification

Ratification is blocked on six operator decisions, carried forward from `docs/audits/agent-city-post-v1-truth-audit.md` §16. Restated here because they change what gets built:

1. **Objective input form.** Curated set, or free text in a validated envelope? Curated is safer and demonstrates less; free text is the real mission outcome and needs a tighter workspace policy.
2. **Workspace policy.** Foundry-created disposable workspace (recommended, and the only option defensible under detection-only write confinement, `PV1-033`), operator-nominated scratch directory, or real project directory (recommended: exclude).
3. **Mission status of V1.1.** New mission baseline, or amendment to the existing one? `FOUNDATION_VERSION.md` anticipates a new baseline via Future Registry promotion — but V1.1 promotes nothing from the registry; it completes what V1 scoped. The document has no category for that.
4. **Evidence retention.** Commit the two untracked `agentrun.sqlite` files, or amend the approval record to cite only retained artifacts (`PV1-024`)?
5. **Finding 6 closure standard.** Fixed, or diagnosed-and-classified with a retained reproduction artifact (`PV1-043`)?
6. **Amending frozen documents.** Are the status corrections to `active-mission.md` and the fourteen `1.0-rc1` headers acceptable as clarifications under the change-control rule, or do they require a formal amendment (`PV1-002`, `PV1-004`)?

**Recommendation on (3):** treat V1.1 as a new mission baseline. The audit shows both priority-1 documents already disagree about V1's status; adding V1.1 as an amendment to a document that says implementation has not begun would compound that. A clean new mission document, with `active-mission.md` corrected to point at it, is the smaller change.

## 10. Risks of this mission

| Risk | Why it matters | Mitigation built into the proposed ladder |
| --- | --- | --- |
| The orchestrator becomes a second source of truth | Would break principle 1 and ADR-002 outright | Orchestrator submits only declared commands through `CommandHandler`; a test asserts it has no direct `appendEvent` path |
| A real run escapes its workspace | Write confinement is detection, not prevention (`PV1-033`) | Foundry-created disposable workspace; pre/post manifest; run fails on any out-of-scope write |
| Real runs make tests non-deterministic | Would destroy the regression baseline | Mock runtime remains the default for all automated suites; real-build coverage is a separate, explicitly-invoked suite |
| The visual pass crosses the frame-time floor | Tail already sits near 37 FPS against a 45 FPS target (`PV1-040`) | Visual rung gated on a before/after performance re-measurement using the 95th-percentile figure |
| V1.1 quietly widens scope | The failure mode `exclusions.md` exists to prevent | Every rung carries an explicit prohibited-work field; exclusions in §6 are restated per rung |
| Spend | Real model invocations cost money | `--max-budget-usd` ceiling per run, unchanged from the FBL-028 profile; each real execution requires its own operator authorization |

## 11. Stop conditions for the mission

V1.1 halts and returns to the operator if any of these occur:

- A proposed capability requires an excluded feature.
- A proposed change would let the frontend or the orchestrator declare completion, transfer readiness, approval resolution, or upgrade activation.
- A real run writes outside its permitted paths.
- Any V1 acceptance behavior regresses in mock mode.
- The Builder becomes able to influence its own validation.
- Finding 6 is proposed for closure by reclassification without diagnosis.

## 12. What V1.1 does not attempt

Stated plainly so the boundary is not inferred:

- It does not make Agent City a city. One neighborhood, three agents, one build.
- It does not build an authentication system. It makes the existing credential handoff usable.
- It does not deploy anything. Local, single-operator, loopback.
- It does not generalize the containment boundary into a security product.
- It does not replace the mock runtime.
- It does not touch the Future Registry.

---

**Companion documents:**
`docs/audits/agent-city-post-v1-truth-audit.md` · `docs/proposals/agent-city-v1.1-build-ladder-proposal.md`
