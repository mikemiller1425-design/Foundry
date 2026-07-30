import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import Home from "./page";

describe("Home page (FBL-005 shell smoke test)", () => {
  it("renders without throwing", () => {
    expect(() => render(<Home />)).not.toThrow();
  });

  it("renders every mandatory shell region", () => {
    render(<Home />);
    expect(screen.getByTestId("shell-root")).toBeInTheDocument();
    expect(screen.getByTestId("shell-top-bar")).toBeInTheDocument();
    expect(screen.getByTestId("shell-left-nav")).toBeInTheDocument();
    expect(screen.getByTestId("shell-world")).toBeInTheDocument();
    expect(screen.getByTestId("shell-intel")).toBeInTheDocument();
    expect(screen.getByTestId("shell-timeline")).toBeInTheDocument();
    expect(screen.getByTestId("shell-command-input")).toBeInTheDocument();
    expect(screen.getByTestId("shell-detail-panel")).toBeInTheDocument();
  });

  it("has no app-wide max-width utility on the shell root", () => {
    render(<Home />);
    const root = screen.getByTestId("shell-root");
    expect(root.className).not.toMatch(/(^|\s)max-w-/);
  });

  it("exposes an accessible landmark label for every region", () => {
    const { container } = render(<Home />);
    const expectedLabels = [
      "System status bar",
      "Primary navigation",
      "Operational world",
      "Live intelligence",
      "Event timeline",
      "Command input",
      "Selected object details",
    ];
    const actualLabels = Array.from(container.querySelectorAll("[aria-label]")).map((el) =>
      el.getAttribute("aria-label"),
    );
    for (const label of expectedLabels) {
      expect(actualLabels).toContain(label);
    }
  });
});
