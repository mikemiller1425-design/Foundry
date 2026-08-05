import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TenantSpacePreview } from "./TenantSpacePreview";

describe("TenantSpacePreview", () => {
  it("shows fictional identity with no tenancy or agent permission", () => {
    render(<TenantSpacePreview tenantId="forgeworks-cooperative" onClose={vi.fn()} />);
    expect(
      screen.getByRole("region", { name: /Forgeworks Cooperative fixture showroom/ }),
    ).toBeInTheDocument();
    expect(screen.getAllByText("Not granted").length).toBeGreaterThan(0);
    expect(screen.getByText(/creates no tenant, lease, ownership/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /run|authorize|grant/i })).not.toBeInTheDocument();
  });

  it("switches role previews without emitting work", () => {
    render(<TenantSpacePreview tenantId="northstar-atelier" onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("tab", { name: /inspector/i }));
    expect(screen.getByText("Inspector preview")).toBeInTheDocument();
    expect(screen.getByText(/independent findings and evidence references/i)).toBeInTheDocument();
  });

  it("exits through an explicit callback", () => {
    const onClose = vi.fn();
    render(<TenantSpacePreview tenantId="signal-house" onClose={onClose} />);
    fireEvent.click(screen.getByRole("button", { name: "Exit preview" }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});
