import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AppShell } from "./AppShell";

describe("AppShell panel interactivity (FBL-006)", () => {
  it("left navigation starts expanded and collapses/expands via its toggle", () => {
    render(<AppShell />);
    const toggle = screen.getByRole("button", { name: "Collapse left navigation" });
    expect(toggle).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByText(/Left navigation/)).toBeInTheDocument();

    fireEvent.click(toggle);
    const expandToggle = screen.getByRole("button", { name: "Expand left navigation" });
    expect(expandToggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText(/^Left navigation$/)).not.toBeInTheDocument();

    fireEvent.click(expandToggle);
    expect(screen.getByRole("button", { name: "Collapse left navigation" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("right live-intelligence and the event timeline are independently collapsible", () => {
    render(<AppShell />);

    const intelToggle = screen.getByRole("button", { name: "Collapse right live-intelligence" });
    fireEvent.click(intelToggle);
    expect(screen.getByRole("button", { name: "Expand right live-intelligence" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    const timelineToggle = screen.getByRole("button", { name: "Collapse event timeline" });
    fireEvent.click(timelineToggle);
    expect(screen.getByRole("button", { name: "Expand event timeline" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );

    // Left navigation is unaffected by collapsing the other two panels.
    expect(screen.getByRole("button", { name: "Collapse left navigation" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });

  it("exposes a resize handle (ARIA separator) for each resizable panel while expanded", () => {
    render(<AppShell />);
    expect(screen.getByRole("separator", { name: "Resize left navigation" })).toBeInTheDocument();
    expect(
      screen.getByRole("separator", { name: "Resize right live-intelligence" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize event timeline" })).toBeInTheDocument();
  });

  it("hides a panel's resize handle while that panel is collapsed", () => {
    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse left navigation" }));
    expect(
      screen.queryByRole("separator", { name: "Resize left navigation" }),
    ).not.toBeInTheDocument();
  });

  it("reset layout expands every panel again after collapsing all three", () => {
    render(<AppShell />);
    fireEvent.click(screen.getByRole("button", { name: "Collapse left navigation" }));
    fireEvent.click(screen.getByRole("button", { name: "Collapse right live-intelligence" }));
    fireEvent.click(screen.getByRole("button", { name: "Collapse event timeline" }));

    fireEvent.click(screen.getByRole("button", { name: "Reset layout" }));

    expect(screen.getByRole("button", { name: "Collapse left navigation" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(
      screen.getByRole("button", { name: "Collapse right live-intelligence" }),
    ).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "Collapse event timeline" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
  });
});
