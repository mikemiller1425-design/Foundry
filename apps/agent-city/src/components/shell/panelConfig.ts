// Panel size configuration for the world-first shell (FBL-006). Horizontal
// sizes are viewport-relative inputs clamped to readable pixel bounds by
// AppShell; the timeline remains vh-based. Pure layout config — no domain
// behavior.
export const LEFT_NAV_PANEL = {
  defaultSize: 9,
  min: 6,
  max: 22,
  collapsedSize: 3,
} as const;

export const RIGHT_INTEL_PANEL = {
  defaultSize: 9,
  min: 6,
  max: 22,
  collapsedSize: 3,
} as const;

export const TIMELINE_PANEL = {
  defaultSize: 16,
  min: 8,
  max: 30,
  collapsedSize: 4,
} as const;
