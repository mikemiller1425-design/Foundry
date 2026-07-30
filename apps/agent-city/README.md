# Agent City

Agent City is the first Foundry spatial application.

```text
Foundry Platform
└── Agent City
    └── V1 Operational Neighborhood
```

## Status

Foundation is **1.0**. `FBL-005` (ultrawide application shell) is complete: the app renders the full-viewport region layout — top system bar, left navigation, central operational world, right live-intelligence, bottom event timeline, persistent command input, and a docked selected-object detail panel — with restrained placeholder content and no operational behavior. Implementation proceeds rung by rung per `docs/03-architecture/foundry-build-ladder.md`; do not treat this as a finished product.

- ✅ `FBL-004` — Next.js/TypeScript app scaffold, boots locally, empty root page
- ✅ `FBL-005` — ultrawide application shell, all mandatory regions present, no app-wide max-width, verified at 5120×1440 / 3840×1080 / 2560×1440
- ⏳ `FBL-006` — panel framework (next)

## Run locally

```sh
pnpm install
pnpm --filter @foundry/agent-city dev
```

Then open `http://localhost:3000`. The shell regions are visible but static/non-interactive — no operational data, no mock runtime, no 3D world exist until later rungs (`FBL-006` adds panel interactivity; `FBL-011`+ adds the 3D world).

## Testing

```sh
pnpm --filter @foundry/agent-city test        # unit tests (Vitest + Testing Library)
pnpm --filter @foundry/agent-city test:e2e    # layout/browser tests (Playwright, all 3 target viewports)
```

## Authority

- `FOUNDATION_VERSION.md`
- `docs/01-mission/active-mission.md`
- `docs/01-mission/v1-scope.md`
- `docs/01-mission/exclusions.md`
- `docs/02-specification/`
- `docs/03-architecture/foundry-build-ladder.md`

Each build ladder rung beyond what is marked complete above requires its own separate, explicit operator authorization.
