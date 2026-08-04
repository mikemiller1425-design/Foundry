# AC-106 — Control Dispositions

**Type:** Rung decision record
**Rung:** `AC-106` — Backend-mode command honesty **[FIX]**
**Date:** 2026-08-03
**Deliverable:** "a decision record on `building.selected`" (ladder § AC-106), extended to cover the demo-control disposition, which the same rung owns.

This record is append-only. A later decision is a new dated entry, never an edit to this one (principle 18).

---

## 0. Why these two needed deciding

The ladder assigned `AC-106` two open items from the `AC-103P` residue:

- **PV1-013** — `building.selected` is produced only by the mock runtime. The audit's disposition was "either emit it backend-side or record that it is a mock-only UI event."
- **The demo-control disposition** — the six `demo.*` controls in the bottom strip have no backend command. The ladder's allowed work was "disabled with a stated reason, or backed by a declared command."

Each was a genuine fork. Both are settled here, with the reasoning, so a later reader does not have to reconstruct it from the diff.

---

## Decision 1 — Demo playback controls are **disabled in backend mode, with the reason stated**

### What was true before

The six controls (`demo.start`, `demo.pause`, `demo.resume`, `demo.set_speed`, `demo.reset`, `demo.replay`) were **enabled** in backend mode. Pressing one POSTed an unknown command type, the API answered `400 invalid_request`, and — before `AC-103P` — the frontend discarded it silently. That was PV1-012: six controls that did nothing and said nothing.

`AC-103P` made the refusal visible. It did not make the control honest: a control that is offered, pressed, and refused every single time is still telling the operator something false about what it can do.

### The decision

**Disabled, with a written explanation rendered as text.**

### Why not "backed by a declared command"

Two independent reasons, and the second would hold even if the first did not.

1. **It is prohibited work.** `COMMAND_TYPES` is transcribed from `domain-model.md` and is closed by design. Adding a `demo.*` entry without a specification amendment is named prohibited work for this rung.
2. **There would be nothing for it to mean.** The `demo.*` commands control the *deterministic mock runtime* — its playback cursor, its speed, its replay. In backend mode the world advances from real backend events. There is no recording to start, no cursor to rewind, and no speed to change. A "Pause" backed by a declared command would have to invent a domain concept — pausing the backend? pausing the projection? — that `domain-model.md` does not have and that this rung is not authorized to introduce.

`interface-model.md` § "Persistent command input" names these six as the V1 command set for the strip. That remains true **of the mock runtime**, which is a selectable operating mode, not a removed one. Nothing in the specification is contradicted by their being unavailable where they have no referent.

### What was implemented

- Every demo control is `disabled` in backend mode, and `send()` additionally refuses to submit — so "no unknown command type is ever posted" holds by construction, not by the attribute alone. (A disabled `<select>` still dispatches `change` when driven programmatically; that is how the gap was found.)
- The reason is rendered as **text**, associated with the control group via `aria-describedby` — not a `title` tooltip, which is unavailable to keyboard and screen-reader users and would hide the explanation that is the entire point.
- **Mock mode is untouched.** Every control behaves exactly as it did at V1.

---

## Decision 2 — `building.selected` is **emitted backend-side**, via the declared `Building.Select` command

### What was true before

`BackendRuntimeProvider.selectBuilding` and `clearSelection` were empty callbacks. Selection *visuals* worked correctly in both modes — `AppShell` holds selection in local React state, which is right, because selection carries no operational authority — but the declared `building.selected` event had **no producer** in backend mode, so the timeline was less complete there than in the mock.

### The decision

**Emit it**, by submitting the already-declared `Building.Select` command.

### Why emit rather than record it as mock-only

The specification already says selection emits it, in both places that describe it:

- `world-model.md` § "Object selection": *"Selection emits UI-facing `building.selected` … **without mutating operational truth**."*
- `event-model.md` § `building.selected`: Producer — *"Frontend (recorded) / **backend optional ack**"*; Backend effect — *"None on operational truth (selection is UI)"*.

Recording it as mock-only would have downgraded a specified behaviour to match an implementation gap. Emitting it closes the gap with **no specification change and no new command**: `Building.Select` is already in the closed vocabulary, and its definition in `commandDefinitions.ts` carries no `toStatus`, so it appends the declared event and changes no entity status. That is precisely "backend optional ack".

### Why this is not orchestration

Orchestration is prohibited work for this rung. Submitting a single declared command in direct response to a human clicking a thing is not orchestration — nothing decides what happens next, no stage advances, no state transitions. It is the UI recording an operator's UI action, which is what the event is for.

### Two properties that were deliberately preserved

1. **Selection visuals never depend on the command succeeding.** Selection is UI-only and stays in local React state. A refusal is reported through the normal failure path but never undoes what the operator selected — the operator's `AC-106` guardrail that frontend-only interactions are preserved where they are explicitly UI-only.
2. **A repeat selection is not resubmitted.** The mock runtime dedupes re-selection for the same reason: a click that changes nothing must not append an event claiming something changed. Clearing selection resets the guard and emits nothing — `event-model.md` declares no deselection counterpart, so there is nothing to record.

---

## Decision 3 — Failure classification is **structural, with one deliberate exception**

Not one of the two assigned items, but a decision this rung had to make and worth recording — including a correction made *during* the rung.

The distinctions `F-105` requires are derived from **HTTP status and the closed command vocabulary**:

| Kind | Determined by |
| --- | --- |
| `unsupported` | Command type absent from `COMMAND_TYPES` (decided client-side, before sending), or `404` |
| `validation` | `4xx` on a command type that *is* in the vocabulary |
| `unauthorized` | `401` / `403`, **or an authorization guard's refusal** — see below |
| `blocked` | `2xx` with `accepted: false` from a state or prerequisite guard |
| `unreachable` | Thrown transport error, or a stream known to be down |
| `server_error` | `5xx` |

### The exception, and why it exists

The first implementation classified purely on status. **Live verification against a running backend proved that wrong**, and it was corrected before commit.

The backend states "unauthorized" in **two** different ways:

- The **transport** answers `403 actor_mismatch` when a request body's `actor` contradicts the credential.
- `CommandHandler`'s **own authorization guards** — operator-only approval resolution and upgrade acts (principle 14), Inspector-only validation (F-05) — answer **`200` with `accepted: false`**, because from the handler's point of view the command was evaluated and refused like any other.

Measured live: `Approval.Approve` with no credential returns **HTTP 200**, not 403.

A status-only rule therefore filed the single most important credential failure under **"Blocked by current state"**, telling the operator to satisfy a prerequisite when the actual fix was to supply a credential. That is precisely the class of misdirection this rung exists to remove, so recognising the guards' phrasing is accepted as a deliberate, confined exception:

- It lives in **one function**, `isAuthorizationRefusal`, so a rewording changes one place and every consumer stays correct.
- It is kept **distinct from `isAuthFailure`**, which drives the credential panel and answers the narrower question "was *my operator credential* refused?". The Inspector guard must not make that true: the frontend holds an operator credential and is not an agent, so it can never satisfy F-05, and marking the operator's credential "rejected" would send them to replace a token that is entirely correct.
- Everything else stays structural. Reason text is displayed verbatim and is the backend's to reword freely.

**The structural fix, not taken here.** Having those guards answer `403` would remove the exception entirely. That is a backend change, and changing backend authority is prohibited work for this rung. Recorded as a candidate for a later rung that owns the API surface.

### One consequence worth naming

A command that *is* declared but has no backing event — `Task.*`, `Vehicle.*`, `Building.ChangeState` — answers `200` with `accepted: false` and is classified `blocked`, carrying the handler's own explanation ("No V1 event backs this command…"). The operator is told exactly why, in the backend's words. It is not classified `unsupported`, because distinguishing it would need another prose exception, and one is already one more than ideal.

---

**Related:** `docs/03-architecture/agent-city-v1.1-build-ladder.md` § AC-106 · `docs/audits/agent-city-post-v1-truth-audit.md` PV1-012, PV1-013, PV1-052 · `docs/audits/agent-city-v1.1-rung-label-reconciliation.md`
