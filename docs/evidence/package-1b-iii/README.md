# Package 1b-iii — Command Center Frontend evidence

**Implementation candidate:** `da66a18cb02909c27528ad4d8d9b270d453f795a`
**Hardening:** reported as the subsequent local commit after this evidence update (not self-hashed here)
**Base:** `20ff9cc`
**Transport:** Package 1b-ii-a at `7837212` (operator-accepted §14)
**Approved long-term visual reference (not runtime):** `assets/concepts/foundry-3d-finish-line-2026-08-05.png` (`785daaf0…`)

## Screenshots

Captured under `screenshots/`:

| File | What it shows |
| --- | --- |
| `desktop-world-glance.png` | Level 1 figures from a schema-valid snapshot (candidate harness; superseded for shell proof by AppShell shots below) |
| `desktop-tactical-mission.png` | Level 2 mission fields with honest absences |
| `evidence-view.png` | Level 3 evidence ledger |
| `narrow-responsive.png` | Compact viewport of the panel |
| `disconnected-or-unavailable.png` | Mock AppShell: unavailable, no invented figures |
| `appshell-desktop.png` | Command Center inside the real AppShell at desktop width |
| `appshell-narrow.png` | Command Center inside the real AppShell at narrow width |

The production `/command-center-visual-review` route was removed in hardening. Schema-valid fixtures live only in tests (`sampleSnapshot.ts`) and the evidence hardening stub (not a deployed product URL). AppShell screenshots prove shell integration; earlier panel crops remain as candidate evidence of L1–L3 content.

## Production-mode interaction (hardening)

Stub API + `next start` (not HMR). Results: `production-interaction-results.json`.

- L1 → L2 selection, L3 evidence open/close: pass
- Reload keeps a valid CURRENT snapshot: pass
- Command Center EventSource opt-in refreshes snapshot on `briefing.created`: pass
- Frozen V1 world log does **not** receive `briefing.created`: pass
- `/command-center-visual-review` returns 404 in production build

## Compared to the 3D finish-line reference

**Implemented now:** Command Center as an authoritative intel surface; progressive disclosure; honest coverage/money/mission absences; approval-oriented recommendations text when the backend supplies them.

**Toward the target:** hierarchy in the intel column; clear attention vs background; restraint over dashboard clutter.

**Intentionally future:** full 3D district city, mission path ribbons in the world, value plaza, evidence archive building, agents visibly ferrying work, finish-line approval gate as a spatial metaphor with recorded state behind every motion. This package does **not** implement the complete 3D finish-line.
