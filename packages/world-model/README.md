# `@foundry/world-model`

World object identifiers, visual-state mappings, and spatial model helpers.

## Status

**Implemented at `FBL-007` (shared contracts).** 7 tests.

## Contents

- `buildings.ts` — the nine V1 world objects (Lighthouse, three residences, Construction Office, Warehouse, QA building, Deployment Dock, Construction Site) with stable identifiers and layout constants.
- `agents.ts` — `WORLD_AGENTS`: the three V1 workers (Architect, Builder, Inspector) with roles and residence bindings. Consumed by `apps/api` to mint one credential per agent at boot.
- `visualStates.ts` — the state→visual mapping tables from `docs/02-specification/world-model.md`. Every meaningful visual has a declared operational state behind it (principles 4, 5) and a textual equivalent (principle 24).
- Roads, the single utility vehicle, and the single cargo representation.
