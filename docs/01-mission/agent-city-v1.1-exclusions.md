# Agent City V1.1 Exclusions

**Foundation:** 1.0
**Mission:** V1.1 — Operational Readiness and First Real Build
**Authority:** Explicit non-goals for the active mission
**Ratified:** 2026-08-03 at `AC-102`

---

## 0. The rule

If a proposed capability is not named in `docs/01-mission/agent-city-v1.1-scope.md` or `agent-city-v1.1-mission.md`, **treat it as excluded** until this baseline is formally amended.

**No excluded feature may be added as a substitute for a required feature that is failing.** This is the failure mode the exclusions document exists to prevent, and it is a mission stop condition.

## 1. Every V1 exclusion carries forward unchanged

`docs/01-mission/exclusions.md` is **not amended**. Every item in it remains excluded in V1.1, restated here so no reader has to infer it:

- Full city
- Multiple districts
- Company campuses
- Academy
- Agent hiring pipeline
- Opportunity Center
- Market Intelligence institution
- Strategic Planning institution
- Economy simulation
- Autonomous spending
- Decorative citizens
- Complex traffic
- Weather
- Building interiors
- Multiplayer
- Land purchasing
- Multiple simultaneous businesses
- External publishing
- Job applications
- Destructive filesystem actions
- Full OpenClaw integration
- Broad third-party integrations
- Advanced agent training
- Large upgrade trees
- Photorealistic custom assets
- R3–R5 risk-class actions
- Unrestricted natural-language shell execution from the command bar
- Using `docs/archive/foundation-v0/` as implementation authority
- Treating Future Registry concepts as active scope

## 2. Exclusions V1.1 adds

### 2.1 Workspace and execution

Following **Decision 2** — write confinement is post-hoc detection, not prevention, and that control does not generalize beyond a directory Foundry created and will destroy.

- **Operator-nominated real project directories.** Explicitly closed; the audit had left this option open and the decision excludes it.
- **Arbitrary existing repositories**, including the Foundry repository itself.
- **The operator's home directory** or any path outside the Foundry-created disposable workspace.
- **Multi-repository work.**
- **Any real execution without its own fresh, explicit, single-use, plan-bound operator authorization.** The `FBL-027`/`FBL-028` authorization is spent and does not carry forward.
- **Standing or implicit execution authorization**, or defaulting to authorized.
- **Granting the runtime `Bash`, subagents, MCP, or `--add-dir`**; removing `--safe-mode`, `--strict-mcp-config`, or the budget ceiling.
- **Network egress beyond the model API.**

### 2.2 Self-certification and authority

- **Any path by which the Builder, the orchestrator, the frontend, or an unauthenticated caller can reach `stage.validation_passed`.**
- **Letting a runtime write, modify, or execute its own validation**, or consulting its own stdout as a verdict.
- **A second write path.** The orchestrator may not call `appendEvent` directly; it submits declared commands through `CommandHandler` like every other caller.
- **Frontend or orchestrator declaration** of completion, transfer readiness, approval resolution, or upgrade activation.
- **Auto-approval of anything**, including the Warehouse upgrade.
- **Widening `V1RiskClassSchema`** beyond R0–R2.

### 2.3 Scope of the world

- **New world objects, districts, institutions, citizens, or interiors.** `AC-118` changes how the existing nine objects look, never how many exist.
- **Decorative sprawl**, or any visual that implies activity without a declared backend event.
- **Removing a textual equivalent** of any meaningful animation (principle 24), or using colour as a sole status signal.
- **Photorealistic assets.**
- **Visual expansion beyond one cohesive neighborhood pass.**
- **Adding a stage name outside the seven fixed names**, or a dynamic stage count.
- **Reordering the canonical work → validate → approve → transfer → dock sequence.**

### 2.4 External action — excluded in full

None of the following is in V1.1 scope in any form, including preparatory or partial implementation:

- **External data collection of any kind**, including business discovery, crawling, scraping, directory queries, and third-party measurement APIs.
- **Local-business discovery, website assessment, or opportunity cases.** These belong to later epochs, each requiring its own reviewed mission.
- **Any outreach**, draft or sent, to any party.
- **Public deployment, hosting, or publishing** of anything.
- **Financial actions**, spending, purchasing, or pricing decisions.
- **Contacting any real business or person.**
- **Collecting sensitive personal data**, or purchasing/enriching private contact data.
- **Promoting the Opportunity Center** or any other Future Registry concept.

### 2.5 Infrastructure and systems

- **An authentication system** — sessions, expiry, refresh, logout, user accounts. V1.1 makes the existing credential handoff usable; it does not build a session system, and it does not embed a credential in the client bundle.
- **Docker, compose, process supervisors, cloud deployment, TLS termination, reverse proxies**, or any production packaging.
- **Claiming OS-level sandboxing that does not exist**, or generalizing the containment boundary into a security guarantee or product.
- **Adding a `demo.*` command type** to the backend vocabulary without a specification amendment — `COMMAND_TYPES` is transcribed from `domain-model.md` and closed by design.
- **A free-text natural-language command shell.** A bounded, validated objective field is not a shell; an unbounded one is, and is excluded.

## 3. Prohibited practices

Distinct from excluded features: these are ways of working that are forbidden regardless of what is being built.

- **Weakening a test, invariant, approval gate, source policy, or acceptance requirement to make a rung pass.**
- **Deleting, skipping, or retrying a failing test to make it green**, or raising a timeout as a substitute for root cause.
- **Closing Finding 6 by reclassification without diagnosis** (Decision 5).
- **Editing any V1 evidence file or approval record.** Corrections are new dated records (principle 18).
- **Reopening, renumbering, or re-grading any `FBL-*` rung.**
- **Committing mutable SQLite runtime databases as evidence** (Decision 4).
- **Raising or removing a performance budget to make a measurement pass**, or treating an average FPS as the gating number when the 95th-percentile figure is what gates.
- **Modifying the mock runtime or `v1-canonical-run.json`.** It is the frozen regression baseline and stays byte-identical.
- **A `[DOC]` rung that changes behaviour, or a `[FEAT]` rung that quietly corrects documentation.**
- **Combining unrelated rungs in one commit.**
- **Silently truncating coverage** — if a rung bounds what it covers, it says so.
- **Committing secrets, credentials, or local environment files.**
