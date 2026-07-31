import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { CollapseToggleButton } from "./CollapseToggleButton";

describe("CollapseToggleButton", () => {
  it("shows the expand label and aria-expanded=false while collapsed", () => {
    render(
      <CollapseToggleButton
        collapsed
        onToggle={() => {}}
        expandLabel="Expand left navigation"
        collapseLabel="Collapse left navigation"
      />,
    );
    const button = screen.getByRole("button", { name: "Expand left navigation" });
    expect(button).toHaveAttribute("aria-expanded", "false");
  });

  it("shows the collapse label and aria-expanded=true while expanded", () => {
    render(
      <CollapseToggleButton
        collapsed={false}
        onToggle={() => {}}
        expandLabel="Expand left navigation"
        collapseLabel="Collapse left navigation"
      />,
    );
    const button = screen.getByRole("button", { name: "Collapse left navigation" });
    expect(button).toHaveAttribute("aria-expanded", "true");
  });

  it("calls onToggle when clicked, and is reachable/activatable by keyboard as a native button", () => {
    const onToggle = vi.fn();
    render(
      <CollapseToggleButton
        collapsed
        onToggle={onToggle}
        expandLabel="Expand"
        collapseLabel="Collapse"
      />,
    );
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(button.tabIndex).toBe(0);
  });
});
