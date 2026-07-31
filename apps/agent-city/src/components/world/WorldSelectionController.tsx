"use client";

import { useThree } from "@react-three/fiber";
import { useEffect, type RefObject } from "react";
import { SELECTABLE_WORLD_OBJECTS } from "@/lib/world/selectableObjects";

// FBL-015 keyboard selection, generalized at FBL-016 for more than one
// selectable world object: Enter/Space (while the canvas has focus —
// already tabbable per FBL-012's CameraRig) acts on whichever object
// currently has pointer hover (`hoveredIdRef`, written by each object's own
// `onHoverChange`), exactly as FBL-015's own comment anticipated. With no
// hover in effect, it falls back to the first registered selectable object
// (the Lighthouse) — preserving FBL-015's original keyboard-selection
// behavior unchanged for that case. Deselection (Escape) is handled at the
// shell level (AppShell), not scoped to canvas focus, since a user may have
// moved focus to the navigator's own selected-object button and still
// expect Escape to clear the selection (interface-model.md "Keyboard
// operation": "Escape closes panels where appropriate").
export function WorldSelectionController({
  onSelect,
  hoveredIdRef,
}: {
  onSelect: (id: string) => void;
  hoveredIdRef: RefObject<string | null>;
}) {
  const { gl } = useThree();

  useEffect(() => {
    const el = gl.domElement;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter" && e.key !== " ") return;
      const fallback = SELECTABLE_WORLD_OBJECTS[0];
      const targetId = hoveredIdRef.current ?? fallback?.id;
      if (!targetId) return;
      e.preventDefault();
      onSelect(targetId);
    }
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [gl, onSelect, hoveredIdRef]);

  return null;
}
