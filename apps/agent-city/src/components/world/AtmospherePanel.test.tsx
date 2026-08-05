import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AtmospherePanel } from "./AtmospherePanel";

describe("AtmospherePanel", () => {
  it("changes visual preference while declaring the semantic boundary", () => {
    const onModeChange = vi.fn();
    render(
      <AtmospherePanel
        mode="focus"
        ambientMotion
        reducedMotion={false}
        onModeChange={onModeChange}
        onAmbientMotionChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    fireEvent.click(screen.getByRole("radio", { name: /Aurora/ }));
    expect(onModeChange).toHaveBeenCalledWith("aurora");
    expect(screen.getByText(/change no events, severity, authority/i)).toBeInTheDocument();
  });

  it("defers to the device reduced-motion preference", () => {
    render(
      <AtmospherePanel
        mode="ember"
        ambientMotion
        reducedMotion
        onModeChange={vi.fn()}
        onAmbientMotionChange={vi.fn()}
        onClose={vi.fn()}
      />,
    );

    expect(screen.getByRole("checkbox", { name: /Ambient world motion/ })).toBeDisabled();
    expect(screen.getByText(/device requests reduced motion/i)).toBeInTheDocument();
  });
});
