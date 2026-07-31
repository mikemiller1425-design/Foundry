"use client";

import { useFrame, useThree } from "@react-three/fiber";
import { useCallback, useEffect, useRef, type RefObject } from "react";
import {
  CANONICAL_CAMERA_STATE,
  clampCameraState,
  clampDistance,
  easeCameraState,
  isCloseTo,
  orbitState,
  panTarget,
  sphericalToPosition,
  zoomState,
  type CameraSphericalState,
  type Vec3,
} from "@/lib/world/cameraMath";
import { useReducedMotion } from "@/lib/world/useReducedMotion";
import type { CameraControllerHandle } from "./cameraController";

const KEY_ORBIT_STEP = 0.08;
const KEY_ZOOM_STEP = 1.5;
const KEY_PAN_STEP = 0.6;
const POINTER_ORBIT_SPEED = 0.006;
const POINTER_PAN_SPEED = 0.02;
const WHEEL_ZOOM_SPEED = 0.01;
const FOCUS_EASE_PER_SECOND = 4;

const CAMERA_ARIA_LABEL =
  "3D operational world. Arrow keys orbit, Shift+Arrow keys pan, plus and minus keys zoom, Home resets the view.";

type DragMode = "orbit" | "pan";

// Rendered as a child of <Canvas> (FBL-011's WorldCanvas). Owns the
// camera's spherical state, applies it to the real Three.js camera every
// frame, and exposes an imperative controller (reset/focus/orbit/pan/zoom)
// through a plain ref so 2D controls (CameraHud) outside the canvas can
// drive it — see cameraController.ts for why a ref rather than context.
export function CameraRig({
  controllerRef,
}: {
  controllerRef: RefObject<CameraControllerHandle | null>;
}) {
  const { camera, gl } = useThree();
  const reducedMotion = useReducedMotion();
  const stateRef = useRef<CameraSphericalState>({ ...CANONICAL_CAMERA_STATE });
  const focusTargetRef = useRef<CameraSphericalState | null>(null);
  const dragRef = useRef<{ mode: DragMode; lastX: number; lastY: number } | null>(null);

  useFrame((_state, delta) => {
    if (focusTargetRef.current) {
      const to = focusTargetRef.current;
      if (reducedMotion) {
        stateRef.current = to;
        focusTargetRef.current = null;
      } else {
        const t = delta * FOCUS_EASE_PER_SECOND;
        const next = easeCameraState(stateRef.current, to, t);
        stateRef.current = next;
        if (isCloseTo(next, to)) {
          stateRef.current = to;
          focusTargetRef.current = null;
        }
      }
    }
    const position = sphericalToPosition(stateRef.current);
    camera.position.set(position.x, position.y, position.z);
    camera.lookAt(stateRef.current.target.x, stateRef.current.target.y, stateRef.current.target.z);
  });

  const reset = useCallback(() => {
    focusTargetRef.current = null;
    stateRef.current = { ...CANONICAL_CAMERA_STATE };
  }, []);

  const focus = useCallback(
    (point: Vec3, options?: { distance?: number }) => {
      const to = clampCameraState({
        target: point,
        azimuth: stateRef.current.azimuth,
        polar: stateRef.current.polar,
        distance:
          options?.distance !== undefined
            ? clampDistance(options.distance)
            : stateRef.current.distance,
      });
      if (reducedMotion) {
        stateRef.current = to;
        focusTargetRef.current = null;
      } else {
        focusTargetRef.current = to;
      }
    },
    [reducedMotion],
  );

  const orbitBy = useCallback((dAzimuth: number, dPolar: number) => {
    focusTargetRef.current = null;
    stateRef.current = orbitState(stateRef.current, dAzimuth, dPolar);
  }, []);

  const panBy = useCallback((dx: number, dy: number) => {
    focusTargetRef.current = null;
    stateRef.current = { ...stateRef.current, target: panTarget(stateRef.current, dx, dy) };
  }, []);

  const zoomBy = useCallback((delta: number) => {
    focusTargetRef.current = null;
    stateRef.current = zoomState(stateRef.current, delta);
  }, []);

  const getState = useCallback(() => stateRef.current, []);

  useEffect(() => {
    controllerRef.current = { reset, focus, orbitBy, panBy, zoomBy, getState };
    return () => {
      controllerRef.current = null;
    };
  }, [controllerRef, reset, focus, orbitBy, panBy, zoomBy, getState]);

  // Input is attached directly to the real canvas element (not passed as
  // React props to <Canvas>) so the focus target and the keydown/pointer
  // listener target are always the same node.
  useEffect(() => {
    const el = gl.domElement;
    el.tabIndex = 0;
    el.setAttribute("aria-label", CAMERA_ARIA_LABEL);

    function onPointerDown(e: PointerEvent) {
      dragRef.current = {
        mode: e.shiftKey || e.button === 1 ? "pan" : "orbit",
        lastX: e.clientX,
        lastY: e.clientY,
      };
      el.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e: PointerEvent) {
      const drag = dragRef.current;
      if (!drag) return;
      const dx = e.clientX - drag.lastX;
      const dy = e.clientY - drag.lastY;
      drag.lastX = e.clientX;
      drag.lastY = e.clientY;
      if (drag.mode === "orbit") {
        orbitBy(-dx * POINTER_ORBIT_SPEED, -dy * POINTER_ORBIT_SPEED);
      } else {
        panBy(-dx * POINTER_PAN_SPEED, dy * POINTER_PAN_SPEED);
      }
    }
    function onPointerUp(e: PointerEvent) {
      dragRef.current = null;
      if (el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
    }
    function onWheel(e: WheelEvent) {
      e.preventDefault();
      zoomBy(e.deltaY * WHEEL_ZOOM_SPEED);
    }
    function onKeyDown(e: KeyboardEvent) {
      switch (e.key) {
        case "ArrowLeft":
          if (e.shiftKey) panBy(-KEY_PAN_STEP, 0);
          else orbitBy(-KEY_ORBIT_STEP, 0);
          break;
        case "ArrowRight":
          if (e.shiftKey) panBy(KEY_PAN_STEP, 0);
          else orbitBy(KEY_ORBIT_STEP, 0);
          break;
        case "ArrowUp":
          if (e.shiftKey) panBy(0, KEY_PAN_STEP);
          else orbitBy(0, -KEY_ORBIT_STEP);
          break;
        case "ArrowDown":
          if (e.shiftKey) panBy(0, -KEY_PAN_STEP);
          else orbitBy(0, KEY_ORBIT_STEP);
          break;
        case "+":
        case "=":
          zoomBy(-KEY_ZOOM_STEP);
          break;
        case "-":
        case "_":
          zoomBy(KEY_ZOOM_STEP);
          break;
        case "Home":
          reset();
          break;
        default:
          return;
      }
      e.preventDefault();
    }

    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("wheel", onWheel, { passive: false });
    el.addEventListener("keydown", onKeyDown);
    return () => {
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("keydown", onKeyDown);
    };
  }, [gl, orbitBy, panBy, zoomBy, reset]);

  return null;
}
