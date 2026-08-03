import { RuntimeContext, type RuntimeContextValue } from "@/lib/mock-runtime/RuntimeProvider";
import { deriveCredentialState } from "@/lib/backend/credentialState";
import { createInitialWorldState } from "@/lib/mock-runtime/worldStateReducer";
import { fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";
import { OperatorCredentialPanel } from "./OperatorCredentialPanel";

function renderPanel(overrides: Partial<RuntimeContextValue> = {}) {
  const setOperatorCredential = vi.fn();
  const clearOperatorCredential = vi.fn();
  const useHandoffCredential = vi.fn();

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <RuntimeContext.Provider
        value={{
          events: [],
          worldState: createInitialWorldState(),
          isRunning: true,
          isComplete: false,
          connectionStatus: "connected",
          mutationsEnabled: true,
          submitCommand: vi.fn(),
          resolveApproval: vi.fn(),
          selectBuilding: vi.fn(),
          clearSelection: vi.fn(),
          lastRejection: null,
          setOperatorCredential,
          clearOperatorCredential,
          useHandoffCredential,
          credentialState: deriveCredentialState({
            connected: true,
            stored: "operator-token-value",
            handoff: null,
            rejected: false,
          }),
          storedCredential: "operator-token-value",
          handoffAvailable: false,
          ...overrides,
        }}
      >
        {children}
      </RuntimeContext.Provider>
    );
  }
  return {
    ...render(<OperatorCredentialPanel />, { wrapper: Wrapper }),
    setOperatorCredential,
    clearOperatorCredential,
    useHandoffCredential,
  };
}

function withState(
  stored: string | null,
  handoff: string | null,
  rejected: boolean,
  connected = true,
) {
  return {
    credentialState: deriveCredentialState({ connected, stored, handoff, rejected }),
    storedCredential: stored,
    handoffAvailable: handoff !== null,
    connectionStatus: connected ? ("connected" as const) : ("disconnected" as const),
  };
}

describe("OperatorCredentialPanel — presence", () => {
  it("renders nothing in mock mode, which needs no credential", () => {
    const { container } = renderPanel({ credentialState: undefined });
    expect(container).toBeEmptyDOMElement();
  });

  it("is present in backend mode even when everything is fine", () => {
    // The whole point: a mistaken token is only recoverable if the control
    // exists before you know it is wrong.
    renderPanel();
    expect(screen.getByTestId("credential-panel")).toBeInTheDocument();
    expect(screen.getByTestId("credential-panel")).toHaveAttribute(
      "data-credential-state",
      "ready",
    );
  });
});

describe("OperatorCredentialPanel — the four states are visibly distinct", () => {
  it.each([
    ["backend unreachable", withState("t", null, false, false), "unreachable"],
    ["absent", withState(null, null, false), "absent"],
    ["stale", withState("old", "new", false), "stale"],
    ["invalid", withState("bad", null, true), "invalid"],
    ["ready", withState("good", null, false), "ready"],
  ])("renders %s as its own state with its own explanation", (_label, overrides, kind) => {
    renderPanel(overrides);
    expect(screen.getByTestId("credential-panel")).toHaveAttribute("data-credential-state", kind);
    expect(screen.getByTestId("credential-explanation").textContent?.length).toBeGreaterThan(0);
  });

  it("gives stale and invalid different text, so they are not one message", () => {
    const { unmount } = renderPanel(withState("old", "new", false));
    const stale = screen.getByTestId("credential-explanation").textContent;
    unmount();

    renderPanel(withState("bad", null, true));
    expect(screen.getByTestId("credential-explanation").textContent).not.toBe(stale);
  });

  it("does not signal state by colour alone", () => {
    renderPanel(withState("old", "new", false));
    // A label and a glyph carry the state in addition to the palette.
    expect(screen.getByTestId("credential-label").textContent).toMatch(/stale/i);
  });

  it("announces the explanation in a live region", () => {
    renderPanel(withState(null, null, false));
    expect(screen.getByTestId("credential-explanation")).toHaveAttribute("role", "status");
  });
});

describe("OperatorCredentialPanel — recovery controls", () => {
  it("offers Change and Clear while a credential is held and working", () => {
    renderPanel(withState("good", null, false));
    expect(screen.getByTestId("credential-change")).toBeInTheDocument();
    expect(screen.getByTestId("credential-clear")).toBeInTheDocument();
  });

  it("clears the stored credential when Clear is pressed", () => {
    const { clearOperatorCredential } = renderPanel(withState("good", null, false));
    fireEvent.click(screen.getByTestId("credential-clear"));
    expect(clearOperatorCredential).toHaveBeenCalledTimes(1);
  });

  it("Change reveals the entry field so a mistaken token can be replaced", () => {
    renderPanel(withState("good", null, false));
    expect(screen.queryByTestId("credential-panel-input")).toBeNull();
    fireEvent.click(screen.getByTestId("credential-change"));
    expect(screen.getByTestId("credential-panel-input")).toBeInTheDocument();
  });

  it("stores a manually entered credential — manual entry is never removed", () => {
    const { setOperatorCredential } = renderPanel(withState(null, null, false));
    fireEvent.change(screen.getByTestId("credential-panel-input"), {
      target: { value: "typed-token" },
    });
    fireEvent.click(screen.getByTestId("credential-panel-save"));
    expect(setOperatorCredential).toHaveBeenCalledWith("typed-token");
  });

  it("shows the held credential masked, not in full", () => {
    renderPanel(withState("abcdefghijklmnop", null, false));
    const masked = screen.getByTestId("credential-masked").textContent ?? "";
    expect(masked).toContain("abcd…mnop");
    expect(masked).not.toContain("abcdefghijklmnop");
  });
});

describe("OperatorCredentialPanel — the handoff", () => {
  it("offers this session's credential when one was handed over and something is wrong", () => {
    renderPanel(withState("old", "new", false));
    expect(screen.getByTestId("credential-use-handoff")).toBeInTheDocument();
  });

  it("adopts the session credential when the offer is taken", () => {
    const { useHandoffCredential } = renderPanel(withState("old", "new", false));
    fireEvent.click(screen.getByTestId("credential-use-handoff"));
    expect(useHandoffCredential).toHaveBeenCalledTimes(1);
  });

  it("does not offer it when there is nothing to fix", () => {
    renderPanel({ ...withState("same", "same", false) });
    expect(screen.queryByTestId("credential-use-handoff")).toBeNull();
  });

  it("still offers manual entry when no handoff exists", () => {
    renderPanel(withState(null, null, false));
    expect(screen.queryByTestId("credential-use-handoff")).toBeNull();
    expect(screen.getByTestId("credential-panel-input")).toBeInTheDocument();
  });
});
