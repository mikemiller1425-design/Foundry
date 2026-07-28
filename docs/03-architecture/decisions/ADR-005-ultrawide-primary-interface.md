# ADR-005: Ultrawide primary interface

## Status
Accepted

## Context
Agent City V1 is intended as a command-center display on a 49-inch ultrawide. Narrow centered layouts waste the canvas.

## Decision
Ultrawide is the primary interface (preferred 5120×1440). Support 3840×1080 and 2560×1440 via collapsible panels. No app-wide max-width on the primary shell.

## Alternatives
Mobile-first; 1440p-only; fixed 5120-only without fallback.

## Consequences
High density and strong world presence; explicit responsive testing required.

## Revisit conditions
After real usage on the target ultrawide display.
