import { describe, expect, it } from "vitest";
import { interpretCommandResponse, requestedCommandType } from "./commandFeedback";

describe("interpretCommandResponse — success", () => {
  it("returns null for an accepted command", () => {
    expect(
      interpretCommandResponse(
        200,
        { accepted: true, commandType: "Approval.Approve" },
        "Approval.Approve",
      ),
    ).toBeNull();
  });
});

describe("interpretCommandResponse — the silent-no-op regression (AC-103)", () => {
  /**
   * The exact body `apps/api` returns for a command that fails envelope
   * validation. It carries no `accepted` key, which is why the previous
   * implementation read `undefined`, cleared the rejection, and showed the
   * operator nothing at all.
   */
  const ENVELOPE_REJECTION = {
    error: "invalid_request",
    message: "Request does not match the known command envelope shape",
    issues: [{ path: ["commandType"], message: "Invalid option" }],
  };

  it("surfaces a 400 that contains no `accepted` key", () => {
    const rejection = interpretCommandResponse(400, ENVELOPE_REJECTION, "demo.start");
    expect(rejection).not.toBeNull();
    expect(rejection?.reason).toBe("Request does not match the known command envelope shape");
  });

  it("names the command the operator actually pressed, since a 400 does not echo it", () => {
    expect(interpretCommandResponse(400, ENVELOPE_REJECTION, "demo.reset")?.commandType).toBe(
      "demo.reset",
    );
  });

  it("surfaces a 403 actor mismatch", () => {
    const rejection = interpretCommandResponse(
      403,
      {
        accepted: false,
        commandType: "Approval.Approve",
        error: "actor_mismatch",
        reason: "Nope.",
      },
      "Approval.Approve",
    );
    expect(rejection?.reason).toBe("Nope.");
  });

  it("surfaces a shaped 200 rejection from the command handler", () => {
    const rejection = interpretCommandResponse(
      200,
      {
        accepted: false,
        commandType: "Upgrade.Approve",
        reason: "Requires an authenticated operator.",
        correctiveAction: "Present the operator credential.",
      },
      "Upgrade.Approve",
    );
    expect(rejection?.reason).toBe(
      "Requires an authenticated operator. Present the operator credential.",
    );
  });

  it("still says something for a bodyless or unparseable failure", () => {
    for (const body of [null, undefined, "", 0, []]) {
      const rejection = interpretCommandResponse(502, body, "demo.start");
      expect(rejection?.reason).toMatch(/HTTP 502/);
      expect(rejection?.commandType).toBe("demo.start");
    }
  });

  it("prefers reason, then message, then error", () => {
    expect(
      interpretCommandResponse(400, { reason: "r", message: "m", error: "e" }, "x")?.reason,
    ).toBe("r");
    expect(interpretCommandResponse(400, { message: "m", error: "e" }, "x")?.reason).toBe("m");
    expect(interpretCommandResponse(400, { error: "e" }, "x")?.reason).toBe("e");
  });
});

describe("requestedCommandType", () => {
  it("reads the commandType from an outgoing body", () => {
    expect(requestedCommandType({ commandType: "demo.pause", params: {} })).toBe("demo.pause");
  });

  it("falls back to `unknown` for anything unreadable", () => {
    for (const raw of [null, undefined, "string", 3, {}, { commandType: 7 }]) {
      expect(requestedCommandType(raw)).toBe("unknown");
    }
  });
});
