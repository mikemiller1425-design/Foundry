"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface CollapseToggleButtonProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "onClick" | "aria-expanded" | "type"
> {
  collapsed: boolean;
  onToggle: () => void;
  /** Accessible label/visible text used while the panel is collapsed (the action is "expand"). */
  expandLabel: string;
  /** Accessible label/visible text used while the panel is expanded (the action is "collapse"). */
  collapseLabel: string;
  children?: ReactNode;
}

// Generic disclosure toggle for a collapsible panel region. Keyboard-
// operable for free (native <button>: Enter/Space activate, natural tab
// order, visible focus via the browser's default focus-visible outline
// unless the consumer overrides styling).
export function CollapseToggleButton({
  collapsed,
  onToggle,
  expandLabel,
  collapseLabel,
  children,
  ...rest
}: CollapseToggleButtonProps) {
  return (
    <button type="button" aria-expanded={!collapsed} onClick={onToggle} {...rest}>
      {children ?? (collapsed ? expandLabel : collapseLabel)}
    </button>
  );
}
