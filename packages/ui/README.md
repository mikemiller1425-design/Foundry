# `@foundry/ui`

Shared accessible UI primitives for Foundry applications.

## Status

**Implemented at `FBL-006` (panel framework).** 18 tests.

## Contents

- `src/panel/` — the resizable, collapsible, keyboard-operable panel primitives used for every precision region beside the 3D world, per `docs/02-specification/interface-model.md`.
- Panel state, focus management, and the accessibility behaviours asserted by `FBL-033` (keyboard path, visible focus, colour never the sole status signal).

Application-specific composition — detail panels, approval cards, evidence views — lives in `apps/agent-city/src/components/`, not here.
