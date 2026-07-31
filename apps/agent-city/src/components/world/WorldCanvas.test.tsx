import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import type { CameraControllerHandle } from "./cameraController";
import { WorldCanvas } from "./WorldCanvas";

describe("WorldCanvas", () => {
  it("mounts an empty R3F canvas without throwing", () => {
    const controllerRef = createRef<CameraControllerHandle>();
    const { container } = render(<WorldCanvas controllerRef={controllerRef} />);
    expect(container.querySelector("canvas")).not.toBeNull();
  });
});
