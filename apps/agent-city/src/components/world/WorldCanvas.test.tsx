import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it, vi } from "vitest";
import type { WorldObjectMarkerMap } from "@/lib/world/objectMarkerState";
import type { CameraControllerHandle } from "./cameraController";
import type { LighthouseMarkerState } from "./lighthouseMarkerState";
import { WorldCanvas } from "./WorldCanvas";

describe("WorldCanvas", () => {
  it("mounts an empty R3F canvas without throwing", () => {
    const controllerRef = createRef<CameraControllerHandle>();
    const lighthouseMarkerRef = createRef<LighthouseMarkerState>();
    const worldObjectMarkerMapRef = createRef<WorldObjectMarkerMap>() as {
      current: WorldObjectMarkerMap;
    };
    worldObjectMarkerMapRef.current = new Map();
    const { container } = render(
      <WorldCanvas
        controllerRef={controllerRef}
        lighthouseMarkerRef={lighthouseMarkerRef}
        worldObjectMarkerMapRef={worldObjectMarkerMapRef}
        selection={null}
        onSelect={vi.fn()}
      />,
    );
    expect(container.querySelector("canvas")).not.toBeNull();
  });
});
