"use client";

import { useCallback, useRef, useState } from "react";
import type { KeyboardEvent, PointerEvent } from "react";

// "x" = the handle changes width (a vertical divider line);
// "y" = the handle changes height (a horizontal divider line).
export type ResizeAxis = "x" | "y";

export interface UseResizableOptions {
  /** Default size, in whatever unit the consumer applies to CSS (e.g. vw/vh percent points). */
  defaultSize: number;
  min: number;
  max: number;
  /** Size change per keyboard arrow press. */
  step?: number;
  axis: ResizeAxis;
  /**
   * Set when the panel being resized sits on the opposite side of the
   * pointer's positive-delta direction from the handle (e.g. a panel to the
   * *left* of its own trailing-edge handle, or *above* a handle on its
   * bottom edge) so that dragging/keying "toward" the panel grows it.
   */
  invert?: boolean;
}

export interface ResizableHandleProps {
  role: "separator";
  "aria-orientation": "horizontal" | "vertical";
  "aria-valuenow": number;
  "aria-valuemin": number;
  "aria-valuemax": number;
  tabIndex: number;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onPointerDown: (event: PointerEvent<HTMLElement>) => void;
  onPointerMove: (event: PointerEvent<HTMLElement>) => void;
  onPointerUp: (event: PointerEvent<HTMLElement>) => void;
}

export interface UseResizableResult {
  size: number;
  setSize: (next: number) => void;
  reset: () => void;
  handleProps: ResizableHandleProps;
}

// A WAI-ARIA "window splitter" resize handle: role="separator", keyboard
// arrow-adjustable, pointer-draggable. Generic — no panel content or domain
// behavior. See docs/02-specification/interface-model.md ("Panels are
// collapsible and resizable").
export function useResizable({
  defaultSize,
  min,
  max,
  step = 2,
  axis,
  invert = false,
}: UseResizableOptions): UseResizableResult {
  const [size, setSizeState] = useState(defaultSize);
  const dragOrigin = useRef<{ pointerPosition: number; size: number } | null>(null);

  const clamp = useCallback((value: number) => Math.min(max, Math.max(min, value)), [min, max]);
  const setSize = useCallback((next: number) => setSizeState(clamp(next)), [clamp]);
  const reset = useCallback(() => setSizeState(defaultSize), [defaultSize]);

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      event.currentTarget.setPointerCapture(event.pointerId);
      dragOrigin.current = {
        pointerPosition: axis === "x" ? event.clientX : event.clientY,
        size,
      };
    },
    [axis, size],
  );

  const onPointerMove = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      if (!dragOrigin.current) return;
      const pointerPosition = axis === "x" ? event.clientX : event.clientY;
      const viewportExtent = axis === "x" ? window.innerWidth : window.innerHeight;
      const rawDeltaPercent =
        ((pointerPosition - dragOrigin.current.pointerPosition) / viewportExtent) * 100;
      const deltaPercent = invert ? -rawDeltaPercent : rawDeltaPercent;
      setSize(dragOrigin.current.size + deltaPercent);
    },
    [axis, invert, setSize],
  );

  const onPointerUp = useCallback((event: PointerEvent<HTMLElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    dragOrigin.current = null;
  }, []);

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const negativeAxisKey = axis === "x" ? "ArrowLeft" : "ArrowUp";
      const positiveAxisKey = axis === "x" ? "ArrowRight" : "ArrowDown";
      const sign = invert ? -1 : 1;

      if (event.key === negativeAxisKey) {
        event.preventDefault();
        setSize(size - sign * step);
      } else if (event.key === positiveAxisKey) {
        event.preventDefault();
        setSize(size + sign * step);
      } else if (event.key === "Home") {
        event.preventDefault();
        setSize(min);
      } else if (event.key === "End") {
        event.preventDefault();
        setSize(max);
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        reset();
      }
    },
    [axis, invert, step, size, min, max, setSize, reset],
  );

  return {
    size,
    setSize,
    reset,
    handleProps: {
      role: "separator",
      "aria-orientation": axis === "x" ? "vertical" : "horizontal",
      "aria-valuenow": Math.round(size),
      "aria-valuemin": min,
      "aria-valuemax": max,
      tabIndex: 0,
      onKeyDown,
      onPointerDown,
      onPointerMove,
      onPointerUp,
    },
  };
}
