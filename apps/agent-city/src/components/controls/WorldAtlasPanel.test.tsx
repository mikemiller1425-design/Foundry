import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorldAtlasPanel } from "./WorldAtlasPanel";

describe("WorldAtlasPanel", () => {
  it("labels the concept layer as fixture-only and disclaims real rights", () => {
    render(<WorldAtlasPanel selection={null} onSelect={vi.fn()} />);

    expect(screen.getByText("Fixture only")).toBeInTheDocument();
    expect(screen.getByText(/no ownership, lease, price, entitlement/i)).toBeInTheDocument();
    expect(screen.getByText("Northstar Atelier")).toBeInTheDocument();
    expect(screen.getByText("Unassigned")).toBeInTheDocument();
  });

  it("selects districts and parcels through the shared selection funnel", () => {
    const onSelect = vi.fn();
    render(<WorldAtlasPanel selection={null} onSelect={onSelect} />);

    fireEvent.click(screen.getByRole("button", { name: /Agent City Operations/ }));
    fireEvent.click(screen.getByRole("button", { name: /Future Yard/ }));

    expect(onSelect).toHaveBeenNthCalledWith(1, {
      kind: "district",
      id: "agent-city-operations",
    });
    expect(onSelect).toHaveBeenNthCalledWith(2, { kind: "parcel", id: "future-yard" });
  });
});
