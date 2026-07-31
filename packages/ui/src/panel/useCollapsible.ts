import { useCallback, useState } from "react";

export interface UseCollapsibleOptions {
  defaultCollapsed?: boolean;
}

export interface UseCollapsibleResult {
  collapsed: boolean;
  toggle: () => void;
  collapse: () => void;
  expand: () => void;
  reset: () => void;
}

// Generic collapse/expand state for a panel region. No panel content or
// domain behavior lives here — see docs/02-specification/interface-model.md
// ("Panels are collapsible and resizable").
export function useCollapsible(options: UseCollapsibleOptions = {}): UseCollapsibleResult {
  const defaultCollapsed = options.defaultCollapsed ?? false;
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const toggle = useCallback(() => setCollapsed((prev) => !prev), []);
  const collapse = useCallback(() => setCollapsed(true), []);
  const expand = useCallback(() => setCollapsed(false), []);
  const reset = useCallback(() => setCollapsed(defaultCollapsed), [defaultCollapsed]);

  return { collapsed, toggle, collapse, expand, reset };
}
