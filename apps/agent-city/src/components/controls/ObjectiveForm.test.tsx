import { RuntimeContext, type RuntimeContextValue } from "@/lib/mock-runtime/RuntimeProvider";
import type { ObjectiveSubmissionResult } from "@/lib/backend/objectiveSubmission";
import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { ObjectiveForm } from "./ObjectiveForm";

const OBJECTIVE = "Add a JSON task store module with a test suite";

function renderForm(overrides: Partial<RuntimeContextValue> = {}) {
  const submitObjective = vi.fn<
    (input: { objective: string }) => Promise<ObjectiveSubmissionResult>
  >(async () => ({ accepted: true, projectId: "project-1", buildId: "build-1" }));

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RuntimeContext.Provider
        value={{
          events: [],
          worldState: createInitialWorldState(),
          isRunning: false,
          isComplete: false,
          connectionStatus: "connected",
          mutationsEnabled: true,
          submitCommand: vi.fn(),
          submitObjective,
          resolveApproval: vi.fn(),
          selectBuilding: vi.fn(),
          clearSelection: vi.fn(),
          lastRejection: null,
          operatorCredentialRequired: false,
          ...overrides,
        }}
      >
        {children}
      </RuntimeContext.Provider>
    );
  }
  return { ...render(<ObjectiveForm />, { wrapper: Wrapper }), submitObjective };
}

function typeAndSubmit(objective = OBJECTIVE) {
  fireEvent.change(screen.getByLabelText("Objective"), { target: { value: objective } });
  fireEvent.click(screen.getByRole("button", { name: /submit objective/i }));
}

describe("ObjectiveForm — presence", () => {
  it("renders nothing when the runtime cannot submit an objective (mock mode)", () => {
    const { container } = renderForm({ submitObjective: undefined });
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the bounded control in backend mode", () => {
    renderForm();
    expect(screen.getByTestId("objective-form")).toBeTruthy();
    expect(screen.getByLabelText("Objective")).toBeTruthy();
    expect(screen.getByLabelText("Risk class")).toBeTruthy();
  });

  it("offers only the R0–R2 risk classes, so R3+ cannot be selected", () => {
    renderForm();
    const options = Array.from(screen.getByLabelText<HTMLSelectElement>("Risk class").options).map(
      (option) => option.value,
    );
    expect(options).toEqual(["R0", "R1", "R2"]);
  });

  it("states the workspace policy rather than offering a choice of directory", () => {
    renderForm();
    expect(screen.getByText(/Foundry-managed \(the only permitted workspace\)/i)).toBeTruthy();
  });

  it("says plainly that nothing is planned or executed", () => {
    renderForm();
    expect(screen.getByText(/nothing is planned or executed/i)).toBeTruthy();
  });
});

describe("ObjectiveForm — submission", () => {
  it("submits the typed objective in the Foundry-managed workspace at the chosen risk class", async () => {
    const { submitObjective } = renderForm();
    fireEvent.change(screen.getByLabelText("Risk class"), { target: { value: "R1" } });
    typeAndSubmit();

    await waitFor(() => expect(submitObjective).toHaveBeenCalledTimes(1));
    expect(submitObjective).toHaveBeenCalledWith({
      objective: OBJECTIVE,
      workspace: "foundry_managed",
      riskClass: "R1",
    });
  });

  it("reports acceptance with the created project and build", async () => {
    renderForm();
    typeAndSubmit();

    await waitFor(() =>
      expect(screen.getByTestId("objective-result").textContent).toMatch(
        /Objective accepted — project project-1, build build-1/,
      ),
    );
  });

  it("clears the field on acceptance so the next state is unambiguous", async () => {
    renderForm();
    typeAndSubmit();
    await waitFor(() =>
      expect(screen.getByLabelText<HTMLInputElement>("Objective").value).toBe(""),
    );
  });
});

describe("ObjectiveForm — refusals are visible and understandable", () => {
  it("renders the backend's reason, per-field issues, and corrective action", async () => {
    const { submitObjective } = renderForm();
    submitObjective.mockResolvedValueOnce({
      accepted: false,
      reason: "The objective is outside the bounded envelope this slice accepts.",
      correctiveAction: "Correct the fields listed below and resubmit.",
      issues: [
        { field: "objective", message: "Objective must be at least 12 characters." },
        { field: "riskClass", message: "Invalid option" },
      ],
    });
    typeAndSubmit("short");

    await waitFor(() => {
      const result = screen.getByTestId("objective-result").textContent ?? "";
      expect(result).toMatch(/outside the bounded envelope/);
      expect(result).toMatch(/objective: Objective must be at least 12 characters\./);
      expect(result).toMatch(/riskClass: Invalid option/);
      expect(result).toMatch(/Correct the fields listed below and resubmit\./);
    });
  });

  it("keeps the rejected text in the field so the operator can correct it", async () => {
    const { submitObjective } = renderForm();
    submitObjective.mockResolvedValueOnce({ accepted: false, reason: "Rejected." });
    typeAndSubmit("short");

    await waitFor(() =>
      expect(screen.getByTestId("objective-result").textContent).toMatch(/Rejected/),
    );
    expect(screen.getByLabelText<HTMLInputElement>("Objective").value).toBe("short");
  });

  it("announces results in a live region so they are not silent to a screen reader", () => {
    renderForm();
    expect(screen.getByTestId("objective-result").getAttribute("aria-live")).toBe("polite");
  });
});

describe("ObjectiveForm — an unavailable control explains itself", () => {
  it("explains a disabled submit when the backend is disconnected", () => {
    renderForm({ mutationsEnabled: false });
    expect(screen.getByTestId("objective-blocked").textContent).toMatch(/Backend disconnected/i);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /submit objective/i }).disabled,
    ).toBe(true);
  });

  it("explains a disabled submit when this browser holds no operator credential", () => {
    renderForm({ operatorCredentialRequired: true });
    expect(screen.getByTestId("objective-blocked").textContent).toMatch(/No operator credential/i);
    expect(
      screen.getByRole<HTMLButtonElement>("button", { name: /submit objective/i }).disabled,
    ).toBe(true);
  });

  it("distinguishes the two unavailable states rather than showing one generic message", () => {
    const { unmount } = renderForm({ mutationsEnabled: false });
    const disconnected = screen.getByTestId("objective-blocked").textContent;
    unmount();

    renderForm({ operatorCredentialRequired: true });
    expect(screen.getByTestId("objective-blocked").textContent).not.toBe(disconnected);
  });
});
