import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { WorldOverview } from "./WorldOverview";

describe("WorldOverview", () => {
  it("makes the fixture district enterable and future districts explicitly unavailable", () => {
    const onEnterDistrict = vi.fn();
    render(<WorldOverview onClose={vi.fn()} onEnterDistrict={onEnterDistrict} />);

    expect(screen.getByText(/only implemented fixture district/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Knowledge Reach/ }));
    expect(screen.getByText("No implementation")).toBeInTheDocument();
    expect(
      screen.getByText(/No parcels, tenants, agents, rights, or backend route/i),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: /Enter fixture district/ }),
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Agent City Operations/ }));
    fireEvent.click(screen.getByRole("button", { name: /Enter fixture district/ }));
    expect(onEnterDistrict).toHaveBeenCalledWith("agent-city-operations");
  });

  it("provides a direct keyboard-operable return action", () => {
    const onClose = vi.fn();
    render(<WorldOverview onClose={onClose} onEnterDistrict={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Return to district" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
