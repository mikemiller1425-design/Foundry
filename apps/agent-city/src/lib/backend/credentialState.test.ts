import { describe, expect, it } from "vitest";
import {
  deriveCredentialState,
  isAuthFailure,
  maskCredential,
  type CredentialInputs,
} from "./credentialState";

const base: CredentialInputs = { connected: true, stored: null, handoff: null, rejected: false };
const state = (o: Partial<CredentialInputs> = {}) => deriveCredentialState({ ...base, ...o });

/**
 * AC-105 / F-104 — absent, stale, invalid, and backend-unreachable must be
 * distinguishable. Before this rung all four produced one prompt.
 */
describe("deriveCredentialState — the four situations are distinct", () => {
  it("reports backend-unreachable when the stream is down", () => {
    expect(state({ connected: false }).kind).toBe("unreachable");
  });

  it("reports absent when no credential is held", () => {
    expect(state({ stored: null }).kind).toBe("absent");
  });

  it("reports stale when the held credential is not this session's", () => {
    expect(state({ stored: "old-token", handoff: "new-token" }).kind).toBe("stale");
  });

  it("reports invalid when the backend refused the credential", () => {
    expect(state({ stored: "wrong-token", rejected: true }).kind).toBe("invalid");
  });

  it("reports ready when a credential is held and nothing has refused it", () => {
    expect(state({ stored: "good-token" }).kind).toBe("ready");
  });

  it("gives every state a distinct label, explanation, and glyph-worthy identity", () => {
    const kinds = [
      state({ connected: false }),
      state({ stored: null }),
      state({ stored: "a", handoff: "b" }),
      state({ stored: "a", rejected: true }),
      state({ stored: "a" }),
    ];
    expect(new Set(kinds.map((s) => s.kind)).size).toBe(5);
    expect(new Set(kinds.map((s) => s.label)).size).toBe(5);
    expect(new Set(kinds.map((s) => s.explanation)).size).toBe(5);
  });

  it("never leaves a non-ready state without an explanation and an action", () => {
    for (const s of [
      state({ connected: false }),
      state({ stored: null }),
      state({ stored: "a", handoff: "b" }),
      state({ stored: "a", rejected: true }),
    ]) {
      expect(s.explanation.length, s.kind).toBeGreaterThan(0);
      expect(s.action.length, s.kind).toBeGreaterThan(0);
    }
  });
});

describe("deriveCredentialState — precedence", () => {
  it("an unreachable backend outranks every other diagnosis", () => {
    // A backend that is not answering cannot have rejected anything, and
    // telling the operator their credential is invalid would send them to
    // replace a token that is probably fine.
    expect(state({ connected: false, stored: "a", handoff: "b", rejected: true }).kind).toBe(
      "unreachable",
    );
  });

  it("absent outranks stale — there is nothing stale about holding nothing", () => {
    expect(state({ stored: null, handoff: "new" }).kind).toBe("absent");
  });

  it("stale outranks invalid, because it names the actual cause", () => {
    expect(state({ stored: "old", handoff: "new", rejected: true }).kind).toBe("stale");
  });

  it("a matching handoff is not stale", () => {
    expect(state({ stored: "same", handoff: "same" }).kind).toBe("ready");
  });
});

describe("deriveCredentialState — needsCredential", () => {
  it("is true exactly when the operator must supply or replace one", () => {
    expect(state({ stored: null }).needsCredential).toBe(true);
    expect(state({ stored: "a", handoff: "b" }).needsCredential).toBe(true);
    expect(state({ stored: "a", rejected: true }).needsCredential).toBe(true);
    expect(state({ stored: "a" }).needsCredential).toBe(false);
    // Nothing to fix by typing while the backend is unreachable.
    expect(state({ connected: false }).needsCredential).toBe(false);
  });
});

describe("deriveCredentialState — the action adapts to whether a handoff exists", () => {
  it("offers the session credential when one was handed over", () => {
    expect(state({ stored: null, handoff: "x" }).action).toMatch(/from this session/i);
  });

  it("falls back to manual instructions when none was", () => {
    expect(state({ stored: null, handoff: null }).action).toMatch(/paste/i);
  });
});

describe("maskCredential", () => {
  it("shows enough to tell two tokens apart and no more", () => {
    expect(maskCredential("abcdefghijklmnop")).toBe("abcd…mnop");
  });

  it("does not partially reveal a short value", () => {
    expect(maskCredential("short")).toBe("••••");
  });

  it("renders absence as a dash rather than an empty gap", () => {
    expect(maskCredential(null)).toBe("—");
  });
});

describe("isAuthFailure", () => {
  it("recognises the transport's 401 and 403", () => {
    expect(isAuthFailure(403, {})).toBe(true);
    expect(isAuthFailure(401, {})).toBe(true);
  });

  it("recognises the API's named authorization errors", () => {
    expect(isAuthFailure(403, { error: "actor_mismatch" })).toBe(true);
    expect(isAuthFailure(200, { error: "unauthorized" })).toBe(true);
  });

  it("recognises a 200 command outcome refused for lack of an authenticated operator", () => {
    expect(
      isAuthFailure(200, {
        accepted: false,
        reason:
          "Resolving an approval requires an authenticated operator (principle 14: humans govern).",
      }),
    ).toBe(true);
  });

  it("does not mistake an ordinary rejection for an auth failure", () => {
    expect(isAuthFailure(200, { accepted: false, reason: "Illegal transition." })).toBe(false);
    expect(isAuthFailure(400, { error: "invalid_request" })).toBe(false);
    expect(isAuthFailure(409, { error: "command_rejected" })).toBe(false);
  });

  it("tolerates unshaped bodies", () => {
    for (const body of [null, undefined, "", 0, []]) {
      expect(isAuthFailure(200, body)).toBe(false);
    }
  });
});
