import { COMMAND_TYPES } from "@foundry/contracts";
import { describe, expect, it } from "vitest";
import {
  interpretCommandResponse,
  isKnownCommandType,
  requestedCommandType,
  unreachableBackend,
  unsupportedCommand,
} from "./commandFeedback";

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

/**
 * AC-106 / F-105 — a 400, a 403, a network failure, an unsupported
 * command, and a state block must each render distinguishable text.
 * Before this rung they were one undifferentiated "Rejected: …" line.
 */
describe("interpretCommandResponse — the five situations are distinct", () => {
  const cases = [
    {
      label: "validation (400 on a real command)",
      failure: interpretCommandResponse(
        400,
        { error: "invalid_request", message: "params.outcome must be passed or failed." },
        "BuildStage.Validate",
      ),
      kind: "validation",
    },
    {
      label: "unauthorized (403)",
      failure: interpretCommandResponse(
        403,
        { error: "actor_mismatch", reason: "The actor does not match the credential." },
        "Approval.Approve",
      ),
      kind: "unauthorized",
    },
    {
      label: "unsupported (unknown command type)",
      failure: unsupportedCommand("demo.start"),
      kind: "unsupported",
    },
    {
      label: "blocked (200 with accepted:false)",
      failure: interpretCommandResponse(
        200,
        { accepted: false, reason: "Mandatory requirement(s) not passed (F-04)." },
        "BuildStage.Complete",
      ),
      kind: "blocked",
    },
    {
      label: "unreachable (network failure)",
      failure: unreachableBackend("Approval.Approve", "fetch failed"),
      kind: "unreachable",
    },
  ] as const;

  it.each(cases)("classifies $label as $kind", ({ failure, kind }) => {
    expect(failure?.kind).toBe(kind);
  });

  it("gives all five a distinct title", () => {
    expect(new Set(cases.map((c) => c.failure?.title)).size).toBe(5);
  });

  it("gives all five a distinct default action", () => {
    // Reasons come from the backend and could coincide; the action is
    // what tells the operator which of the five problems they have.
    expect(new Set(cases.map((c) => c.failure?.action)).size).toBe(5);
  });

  it("never produces a failure without a reason and an action", () => {
    for (const { failure, label } of cases) {
      expect(failure?.reason.length, label).toBeGreaterThan(0);
      expect(failure?.action.length, label).toBeGreaterThan(0);
    }
  });
});

describe("interpretCommandResponse — classification is structural, not textual", () => {
  it("treats a 400 naming an unknown command as unsupported, not invalid input", () => {
    // Telling the operator to "correct the input" for a control the
    // backend has no command for would send them to fix the wrong thing.
    const failure = interpretCommandResponse(
      400,
      { error: "invalid_request", commandType: "demo.reset" },
      "demo.reset",
    );
    expect(failure?.kind).toBe("unsupported");
  });

  it("treats a 400 naming a real command as validation", () => {
    const failure = interpretCommandResponse(400, { error: "invalid_request" }, "Build.Create");
    expect(failure?.kind).toBe("validation");
  });

  it("classifies 5xx separately from a refusal", () => {
    expect(interpretCommandResponse(500, { error: "internal_error" }, "Build.Create")?.kind).toBe(
      "server_error",
    );
  });

  it("classifies 404 as unsupported", () => {
    expect(interpretCommandResponse(404, { error: "not_found" }, "Build.Create")?.kind).toBe(
      "unsupported",
    );
  });

  it("does not depend on the wording of the backend's reason", () => {
    // Same status, wildly different prose — the kind must not move.
    for (const reason of ["Illegal transition", "anything at all", ""]) {
      expect(interpretCommandResponse(200, { accepted: false, reason }, "Build.Start")?.kind).toBe(
        "blocked",
      );
    }
  });
});

describe("interpretCommandResponse — the backend's own words are preferred", () => {
  it("shows the backend's reason verbatim", () => {
    const failure = interpretCommandResponse(
      200,
      { accepted: false, reason: "Producing stage stage-1 is not completed (invariant 3 / F-04)." },
      "Transfer.MarkReady",
    );
    expect(failure?.reason).toBe("Producing stage stage-1 is not completed (invariant 3 / F-04).");
  });

  it("prefers the backend's corrective action over the category default", () => {
    const failure = interpretCommandResponse(
      200,
      { accepted: false, reason: "r", correctiveAction: "Do this exact thing." },
      "Build.Start",
    );
    expect(failure?.action).toBe("Do this exact thing.");
  });

  it("falls back through reason, message, then error", () => {
    expect(
      interpretCommandResponse(400, { reason: "r", message: "m" }, "Build.Create")?.reason,
    ).toBe("r");
    expect(
      interpretCommandResponse(400, { message: "m", error: "e" }, "Build.Create")?.reason,
    ).toBe("m");
    expect(interpretCommandResponse(400, { error: "e" }, "Build.Create")?.reason).toBe("e");
  });

  it("still says something for a bodyless or unparseable failure", () => {
    for (const body of [null, undefined, "", 0, []]) {
      const failure = interpretCommandResponse(502, body, "Build.Create");
      expect(failure?.reason).toMatch(/HTTP 502/);
      expect(failure?.kind).toBe("server_error");
    }
  });

  it("names the command the operator pressed, since a 400 does not echo it", () => {
    expect(
      interpretCommandResponse(400, { error: "invalid_request" }, "Approval.Approve")?.commandType,
    ).toBe("Approval.Approve");
  });
});

describe("isKnownCommandType — the closed vocabulary", () => {
  it("accepts every declared command type", () => {
    for (const type of COMMAND_TYPES) expect(isKnownCommandType(type), type).toBe(true);
  });

  it("rejects every demo control — none is a backend command", () => {
    for (const type of [
      "demo.start",
      "demo.pause",
      "demo.resume",
      "demo.set_speed",
      "demo.reset",
      "demo.replay",
    ]) {
      expect(isKnownCommandType(type), type).toBe(false);
    }
  });

  it("rejects an invented command", () => {
    expect(isKnownCommandType("Objective.Submit")).toBe(false);
    expect(isKnownCommandType("shell.execute")).toBe(false);
  });
});

describe("unsupportedCommand", () => {
  it("names the command and says nothing the operator does will help", () => {
    const failure = unsupportedCommand("demo.replay");
    expect(failure.kind).toBe("unsupported");
    expect(failure.reason).toContain("demo.replay");
    expect(failure.action).toMatch(/no backend equivalent/i);
  });
});

describe("unreachableBackend", () => {
  it("carries the transport detail when there is one", () => {
    expect(unreachableBackend("Build.Start", "fetch failed").reason).toBe("fetch failed");
  });

  it("still explains itself with no detail", () => {
    const failure = unreachableBackend("Build.Start");
    expect(failure.reason.length).toBeGreaterThan(0);
    expect(failure.action).toMatch(/API process is running/i);
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

/**
 * AC-106 — the backend states "unauthorized" two ways, and both must
 * classify as unauthorized.
 *
 * Found by live verification: an `Approval.Approve` submitted with no
 * credential returns HTTP 200 with `accepted: false`, not 403, because
 * `CommandHandler`'s operator guard refuses it like any other command. A
 * status-only rule filed that under "Blocked by current state" and told
 * the operator to satisfy a prerequisite when the fix was a credential.
 */
describe("interpretCommandResponse — authorization arrives two ways", () => {
  it("classifies the transport's 403 actor_mismatch as unauthorized", () => {
    expect(
      interpretCommandResponse(
        403,
        { accepted: false, error: "actor_mismatch", reason: "…" },
        "Approval.Approve",
      )?.kind,
    ).toBe("unauthorized");
  });

  it("classifies the operator guard's 200 refusal as unauthorized, not blocked", () => {
    const failure = interpretCommandResponse(
      200,
      {
        accepted: false,
        reason:
          "Resolving an approval requires an authenticated operator (principle 14: humans govern). Agent, frontend, backend, and unauthenticated or authority-asserting callers are rejected.",
      },
      "Approval.Approve",
    );
    expect(failure?.kind).toBe("unauthorized");
    expect(failure?.title).toBe("Not authorized");
  });

  it("classifies the Inspector guard's 200 refusal as unauthorized", () => {
    expect(
      interpretCommandResponse(
        200,
        {
          accepted: false,
          reason:
            "Validation requires an authenticated, independent Inspector-role agent (F-05): the actor must be an agent whose persisted role is `inspector`.",
        },
        "BuildStage.Validate",
      )?.kind,
    ).toBe("unauthorized");
  });

  it("still classifies a genuine state guard as blocked, not unauthorized", () => {
    for (const reason of [
      "No Build with id no-such-build.",
      "Mandatory requirement(s) not passed (F-04): spec review.",
      "Illegal transition for Build build-1: completed → running.",
    ]) {
      expect(
        interpretCommandResponse(200, { accepted: false, reason }, "Build.Start")?.kind,
        reason,
      ).toBe("blocked");
    }
  });

  it("points an unauthorized failure at the credential panel", () => {
    const failure = interpretCommandResponse(
      200,
      { accepted: false, reason: "requires an authenticated operator" },
      "Approval.Approve",
    );
    expect(failure?.action).toMatch(/credential/i);
  });
});
