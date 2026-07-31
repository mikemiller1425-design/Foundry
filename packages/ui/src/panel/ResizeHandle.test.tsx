import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ResizeHandle } from "./ResizeHandle";
import { useResizable } from "./useResizable";
import { renderHook } from "@testing-library/react";

describe("ResizeHandle", () => {
  it("renders as a keyboard-focusable ARIA separator with the resizable hook's live values", () => {
    const { result } = renderHook(() =>
      useResizable({ defaultSize: 15, min: 8, max: 30, axis: "x" }),
    );
    render(
      <ResizeHandle handleProps={result.current.handleProps} label="Resize left navigation" />,
    );

    const handle = screen.getByRole("separator", { name: "Resize left navigation" });
    expect(handle).toHaveAttribute("aria-orientation", "vertical");
    expect(handle).toHaveAttribute("aria-valuenow", "15");
    expect(handle).toHaveAttribute("aria-valuemin", "8");
    expect(handle).toHaveAttribute("aria-valuemax", "30");
    expect(handle.tabIndex).toBe(0);
  });
});
