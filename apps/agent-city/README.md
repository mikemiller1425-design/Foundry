# Agent City

Agent City is the first Foundry spatial application.

```text
Foundry Platform
└── Agent City
    └── V1 Operational Neighborhood
```

## Status

Foundation is **1.0**. `FBL-006` (panel framework) is complete: left navigation, right live-intelligence, and the bottom event timeline are collapsible and resizable, every control is keyboard-operable with a visible focus indicator, and a "Reset layout" control restores default sizes. No operational data, mock runtime, or domain behavior — see `docs/02-specification/interface-model.md`. Implementation proceeds rung by rung per `docs/03-architecture/foundry-build-ladder.md`; do not treat this as a finished product. **Execution stops here** — `FBL-007` and beyond are explicitly not authorized.

- ✅ `FBL-004` — Next.js/TypeScript app scaffold, boots locally, empty root page
- ✅ `FBL-005` — ultrawide application shell, all mandatory regions present, no app-wide max-width, verified at 5120×1440 / 3840×1080 / 2560×1440
- ✅ `FBL-006` — panel framework: collapsible/resizable left nav, right intelligence, and event timeline; keyboard-operable; visible focus; layout reset
- ⏳ `FBL-007` and beyond — **not authorized**; requires separate, explicit operator authorization

## Run locally

```sh
pnpm install
pnpm --filter @foundry/agent-city dev
```

Then open `http://localhost:3000`. The shell regions are visible and their panels are interactive (collapse/resize/keyboard/reset) — but there is still no operational data, no mock runtime, and no 3D world. Those arrive at later, not-yet-authorized rungs (`FBL-008`+ for the mock runtime, `FBL-011`+ for the 3D world).

## Interacting with the shell

- Click (or focus + Enter/Space) the `«`/`»`/`Collapse`/`Expand` buttons on the left navigation, right live-intelligence, and bottom event timeline panels to collapse/expand them.
- Drag the thin divider between two regions, or focus it (Tab) and press the arrow keys (Home/End for min/max, Enter to reset that one handle) to resize.
- The "Reset layout" button in the top system bar restores every panel to its default size and expanded state.
- All of the above works with keyboard only; layout state is frontend-local (not persisted across reloads) per the build ladder's FBL-006 scope.

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
