"use client";

import { useThree } from "@react-three/fiber";
import { useEffect } from "react";
import { SELECTABLE_WORLD_OBJECTS } from "@/lib/world/selectableObjects";

// FBL-015 keyboard selection: Enter/Space (while the canvas has focus —
// already tabbable per FBL-012's CameraRig) selects the sole selectable
// world object today. Deselection (Escape) is handled at the shell level
// (AppShell), not scoped to canvas focus, since a user may have moved
// focus to the navigator's own selected-object button and still expect
// Escape to clear the selection (interface-model.md "Keyboard operation":
// "Escape closes panels where appropriate"). Reusable as-is once more
// than one object exists — Enter/Space would then act on whichever
// object currently has hover/roving focus.
export function WorldSelectionController({ onSelect }: { onSelect: (id: string) => void }) {
  const { gl } = useThree();

  useEffect(() => {
    const el = gl.domElement;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== "Enter" && e.key !== " ") return;
      const onlySelectable = SELECTABLE_WORLD_OBJECTS[0];
      if (!onlySelectable) return;
      e.preventDefault();
      onSelect(onlySelectable.id);
    }
    el.addEventListener("keydown", onKeyDown);
    return () => el.removeEventListener("keydown", onKeyDown);
  }, [gl, onSelect]);

  return null;
}
