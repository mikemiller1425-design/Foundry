# Active Mission — Agent City V1.1

**Foundation:** 1.0
**Mission status:** **Active** — ratified 2026-08-03
**Application:** Agent City
**Mission:** V1.1 — Operational Readiness and First Real Build
**Ladder:** `docs/03-architecture/agent-city-v1.1-build-ladder.md` (`AC-101`–`AC-120`, plus the preserved pre-ladder proof `AC-103P`)
**Acceptance:** `docs/02-specification/v1.1-acceptance.md`

---

## 0. Standing

This is a **new reviewed mission baseline** (Decision 3), established at rung `AC-102`.

- **Foundry Foundation 1.0 remains frozen.** This mission changes no principle, domain term, ADR, or specification meaning. Where V1.1 requires a specification change, it is made as a recorded amendment at the rung that owns it, never silently.
- **Agent City V1 remains complete.** `FBL-001`–`FBL-035`, including `FBL-021A`, are historical completed authority: never reopened, renumbered, or re-graded. `docs/01-mission/active-mission.md` remains the closed V1 mission record.
- **Nothing is promoted from `docs/04-future/registry.md`.** V1.1 completes what V1 already scoped. The Future Registry remains inactive and non-authoritative for every rung.
- **This document grants no standing authorization.** Each ladder rung requires its own explicit operator authorization before it may begin.

## 1. Mission statement

> Build the path from a human intention to real, independently validated work. One operator launches Foundry through a documented single command, submits one bounded real software objective, reviews a structured plan, authorizes controlled execution, observes real Architect/Builder/Inspector stages driven by backend authority, resolves a human approval, and receives output whose correctness was determined by validation the Builder did not write and could not run.

Every clause is a gate. The mission is complete only when all of them hold **in one continuous session**, performed by the operator, against the real backend, with **no seed script and no hand-submitted command**.

## 2. Why this mission

V1 built the parts and did not connect them to a human intent. Three facts define the gap:

- **The enforcement layer is complete and unreachable.** Transition graphs, invariant guards, credentialed identity, the SSE projection, and the runtime policy boundary are all real, tested, and correct — and nothing in the product exercises most of them, because **nothing decides what happens next** (PV1-016, PV1-025).
- **The operator cannot express an intention.** "Operator submits objective" is step 1 of the required workflow and step 4 of the acceptance journey. There is no control for it in either runtime mode (PV1-026, PV1-050).
- **The one real AI execution is out-of-band.** It runs from a CLI, against a fixture compiled into a package, on a separate database, with no relationship to any build the world displays (PV1-022).

The result is a product whose stated philosophy — *"The virtual world is never a simulation of work. It is a spatial representation of real work"* — is not what it does during normal operation (PV1-049).

**That is the whole of what V1.1 closes, and nothing else.**

## 3. Primary user

One human **operator**. Unchanged from V1.

## 4. Primary display

49-inch ultrawide (preferred 5120×1440), with supported fallbacks at 3840×1080 and 2560×1440. Unchanged from V1.

## 5. Success statement

V1.1 succeeds when an operator, on a machine that has never run Foundry, can:

1. Run **one documented command** and reach a working Foundry.
2. Type **one bounded objective** and submit it.
3. Read a **structured plan** the system produced, and decide whether to proceed.
4. **Authorize execution** as an explicit, separate act.
5. Watch **real** Architect, Builder, and Inspector stages progress — every state change originating from backend authority, not from a script.
6. Resolve **one real approval** that genuinely blocks progression until resolved.
7. Receive an artifact whose correctness was determined by **validation the Builder did not write and could not run**.
8. **Restart everything** and find the same truth.

## 6. What "one bounded real software objective" means

Deliberately narrow, because *real* and *unbounded* are different words.

**In scope:**
- A single, small, self-contained software artifact — on the order of one module with a specification and a test suite.
- Expressed as **bounded free text inside a strict typed and validated envelope** (Decision 1). Objectives outside the supported template are **rejected**, structurally and visibly, with zero mutation.
- Executed inside a **workspace Foundry creates, controls, and destroys** (Decision 2). Never a pre-existing project directory, never an operator-nominated real directory, never the Foundry repository, never the operator's home.
- Risk classes **R0–R2 only**, unchanged from V1 (`principles.md` 19; `V1RiskClassSchema` keeps R3–R5 unrepresentable).
- The Builder **cannot write, modify, or execute its own validation.** This property is the load-bearing guarantee of the entire mission and is **non-negotiable**.

**Not in scope:** arbitrary user-chosen projects, multi-repository work, existing codebases, anything requiring network egress beyond the model API, anything the operator has not seen a plan for.

## 7. What V1.1 explicitly preserves

Preservation is a requirement, not a default. Each of these was earned and can be lost by accident. Checked at **every rung's stop condition**, not only at `AC-120`.

| Preserved | Why it must not regress |
| --- | --- |
| **The deterministic mock runtime** | It is the regression baseline (`v1-canonical-run.json`), the default for all automated suites, and the only reproducible full journey. It becomes a *selected mode*, never a removed one, and the fixture stays **byte-identical**. |
| **Independent Inspector validation** | `stage.validation_passed` must remain unreachable via the Builder, the orchestrator, or the frontend. F-05 is a structural guarantee, not a policy. |
| **Backend authority** | Every V1.1 state change goes through the existing `CommandHandler`. The orchestrator gets **no second write path** — it is a *client* of the same enforcement every other caller uses. |
| **Append-only events and evidence** | Events are immutable facts; corrections occur through new events (principle 18). Records are superseded by new dated entries, never edited. |
| **The R0–R2 ceiling** | `V1RiskClassSchema` makes R3–R5 unrepresentable. It stays that way. |
| **A runtime cannot self-certify** | Validation is written in advance, the runtime has no shell, and Foundry runs the tests. |
| **Declared events drive the world** | All meaningful world movement and visual change originates from a declared backend event (principles 4, 5), with a textual equivalent (principle 24). |
| **Every V1 acceptance behaviour** | `F-01`–`F-12` and `V-01`–`V-08` continue to pass in mock mode throughout. A V1.1 regression in V1 behaviour is a **stop condition**. |

## 8. Relationship to V1

The V1 Build Ladder is **closed and untouched**. V1.1 proceeds on a new ladder with stable identifiers **`AC-101` onward** — a namespace disjoint from `FBL-*`, so no reader can mistake a V1.1 rung for V1 history and no `FBL` identifier is ever reused or renumbered.

V1's acceptance specification (`docs/02-specification/v1-acceptance.md`) remains the frozen V1 record. `docs/02-specification/v1.1-acceptance.md` adds the V1.1 requirements and restates the V1 behaviours that must not regress; it supersedes nothing in the V1 document.

## 9. Operator decisions governing this mission

All seven are recorded authoritatively in `docs/01-mission/agent-city-v1.1-decision-record.md`. In brief: bounded free-text objectives in a typed envelope; Foundry-created disposable workspaces only; new mission baseline; no mutable SQLite committed and a new dated evidence clarification instead; Finding 6 diagnosis mandatory; status corrections as clarifications under change control; Safari covered by automated functional WebKit **and** a standing dated real-Safari visual check.

**D-9** (added at ratification) preserves the four objective-submission commits as `AC-103P`, a pre-ladder proof, leaving `AC-103` as Finding 6 resolution.

One decision remains open and non-blocking: **D-8**, the disposition of commit `e5378aa`, resolved at `AC-117`.

## 10. Risks

| Risk | Why it matters | Mitigation |
| --- | --- | --- |
| The orchestrator becomes a second source of truth | Would break principle 1 and ADR-002 outright | Orchestrator submits only declared commands through `CommandHandler`; a structural test asserts it has no direct `appendEvent` path |
| A real run escapes its workspace | Write confinement is detection, not prevention (PV1-033) | Foundry-created disposable workspace only (Decision 2); pre/post manifest; run fails on any out-of-scope write |
| Real runs make tests non-deterministic | Would destroy the regression baseline | Mock runtime remains the default for all automated suites; real-build coverage is a separate, explicitly-invoked suite |
| Visual work crosses the frame-time floor | The tail already sits near 37 FPS against a 45 FPS target (PV1-040), and `e5378aa` added geometry that has never been measured (N-04) | `AC-118` gated on a fresh `AC-117` baseline measured against a tree that includes `e5378aa`; the 95th-percentile figure is the gating number |
| Scope quietly widens | The failure mode `exclusions.md` exists to prevent | Every rung carries an explicit prohibited-work field; exclusions restated per rung |
| Spend | Real model invocations cost money | Budget ceiling per run; each real execution requires its own separate operator authorization, single-use and plan-bound |

## 11. Stop conditions

V1.1 halts and returns to the operator if any of these occur:

- A proposed capability requires an excluded feature.
- A proposed change would let the frontend or the orchestrator declare completion, transfer readiness, approval resolution, or upgrade activation.
- A real run writes outside its permitted paths.
- Any V1 acceptance behaviour regresses in mock mode.
- The Builder becomes able to influence its own validation.
- Finding 6 is proposed for closure by reclassification without diagnosis.
- A test, invariant, approval gate, or acceptance requirement would need to be weakened for a rung to pass.

## 12. What V1.1 does not attempt

Stated plainly so the boundary is not inferred:

- It does not make Agent City a city. One neighborhood, three agents, one build.
- It does not build an authentication system. It makes the existing credential handoff usable.
- It does not deploy anything. Local, single-operator, loopback.
- It does not generalize the containment boundary into a security product.
- It does not replace the mock runtime.
- It does not touch the Future Registry.
- It does not perform, prepare, or enable any external data collection, business discovery, or outreach. Those belong to later epochs with their own reviewed missions.

## 13. Completion gate

V1.1 is complete only when every mandatory requirement in `docs/02-specification/v1.1-acceptance.md` passes, every V1 acceptance behaviour still passes in mock mode, every V1 and V1.1 exclusion remains unimplemented, documentation matches implementation **including status metadata**, Finding 6 is closed or explicitly re-carried with a diagnosis, and **the operator personally performs the mission outcome end to end in one session**.

Automated output alone cannot satisfy this gate.

## 14. Related documents

- Decisions: `docs/01-mission/agent-city-v1.1-decision-record.md`
- Scope: `docs/01-mission/agent-city-v1.1-scope.md`
- Exclusions: `docs/01-mission/agent-city-v1.1-exclusions.md`
- Acceptance: `docs/02-specification/v1.1-acceptance.md`
- Build Ladder: `docs/03-architecture/agent-city-v1.1-build-ladder.md`
- Reconciliation: `docs/audits/agent-city-post-v1-reconciliation.md`
- Source audit (non-authoritative): `docs/audits/agent-city-post-v1-truth-audit.md`
- Closed V1 mission: `docs/01-mission/active-mission.md`
