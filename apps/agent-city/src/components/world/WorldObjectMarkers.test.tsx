import { act, render, screen } from "@testing-library/react";
import type { RefObject } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WorldObjectMarkerMap } from "@/lib/world/objectMarkerState";
import { WorldObjectMarkers } from "./WorldObjectMarkers";

afterEach(() => vi.useRealTimers());

describe("WorldObjectMarkers spatial labels", () => {
  it("shows a truthful visual label only for a visible selected or hovered object", () => {
    vi.useFakeTimers();
    const markerMap: WorldObjectMarkerMap = new Map([
      [
        "warehouse",
        {
          id: "warehouse",
          label: "Warehouse",
          visible: true,
          xPercent: 62,
          yPercent: 41,
          state: "Dim",
          hovered: false,
          selected: true,
        },
      ],
      [
        "qa",
        {
          id: "qa",
          label: "QA Building",
          visible: true,
          xPercent: 48,
          yPercent: 37,
          state: "Healthy",
          hovered: false,
          selected: false,
        },
      ],
    ]);
    const markerMapRef: RefObject<WorldObjectMarkerMap> = { current: markerMap };

    render(<WorldObjectMarkers markerMapRef={markerMapRef} />);
    act(() => vi.advanceTimersByTime(150));

    const label = screen.getByTestId("world-object-label");
    expect(label).toHaveAttribute("data-object-id", "warehouse");
    expect(label).toHaveTextContent("Warehouse");
    expect(label).toHaveTextContent("Dim");
    expect(
      screen.queryByText("QA Building", { selector: '[data-testid="world-object-label"]' }),
    ).toBeNull();
  });
});
