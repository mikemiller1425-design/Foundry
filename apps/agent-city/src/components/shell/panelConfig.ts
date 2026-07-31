// Panel size configuration for the ultrawide shell (FBL-006). Sizes are
// unitless numbers interpreted as CSS percentage-of-viewport-width (nav,
// intel) or vh (timeline) by AppShell. Purely layout config — no domain
// behavior.
export const LEFT_NAV_PANEL = {
  defaultSize: 15,
  min: 8,
  max: 30,
  collapsedSize: 3,
} as const;

export const RIGHT_INTEL_PANEL = {
  defaultSize: 22,
  min: 12,
  max: 35,
  collapsedSize: 3,
} as const;

export const TIMELINE_PANEL = {
  defaultSize: 20,
  min: 10,
  max: 35,
  collapsedSize: 4,
} as const;
