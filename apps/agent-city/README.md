# Agent City

Agent City is the first Foundry spatial application.

```text
Foundry Platform
└── Agent City
    └── V1 Operational Neighborhood
```

## Status

Foundation is **1.0**. `FBL-004` (frontend application scaffold) is complete: the app boots as an empty Next.js/TypeScript shell with no meaningful UI yet. Implementation proceeds rung by rung per `docs/03-architecture/foundry-build-ladder.md`; do not treat this as a finished product.

- ✅ `FBL-004` — Next.js/TypeScript app scaffold, boots locally, empty root page
- ⏳ `FBL-005` — ultrawide application shell (next)
- ⏳ `FBL-006` — panel framework

## Run locally

```sh
pnpm install
pnpm --filter @foundry/agent-city dev
```

Then open `http://localhost:3000`. The page is intentionally blank — no operational UI exists until `FBL-005`/`FBL-006`.

## Authority

- `FOUNDATION_VERSION.md`
- `docs/01-mission/active-mission.md`
- `docs/01-mission/v1-scope.md`
- `docs/01-mission/exclusions.md`
- `docs/02-specification/`
- `docs/03-architecture/foundry-build-ladder.md`

Each build ladder rung beyond what is marked complete above requires its own separate, explicit operator authorization.
