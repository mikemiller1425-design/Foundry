# `@foundry/contracts`

Shared TypeScript contracts and schemas for Foundry applications.

## Status

**Implemented at `FBL-007` (shared contracts).** 56 tests.

## Contents

- Zod schemas for all 15 `docs/02-specification/domain-model.md` entities, plus their status enums and lifecycle vocabulary.
- `commands.ts` — the **closed** command vocabulary: 84 `COMMAND_TYPES` transcribed from `domain-model.md`. Validation is envelope-only (`CommandRequestSchema`: `commandType`, `entityId?`, `params?`, `actor?`) because `domain-model.md` names each command but does not specify per-command parameter fields. Adding a command type requires a specification amendment, not a code edit.
- `V1RiskClassSchema` — `z.enum(["R0","R1","R2"])`. R3–R5 are **unrepresentable**, enforcing principle 19 at the type level.
- `WorldState` snapshot and projection DTOs shared by `apps/agent-city` and `apps/api`.
