import { describe, expect, it } from "vitest";
import { commandCenterStatusLabel } from "./status";
import { formatAttested, formatCoverageLine, formatMoneyGlance } from "./format";
import type { CommandCenterSnapshot } from "@foundry/contracts";

describe("command-center format helpers", () => {
  it("labels attested absences with their supplied reason", () => {
    expect(
      formatAttested({ state: "not_recorded", reason: "historical builds carry no autonomy" }),
    ).toBe("not recorded: historical builds carry no autonomy");
  });

  it("formats coverage without collapsing connection and progress", () => {
    expect(
      formatCoverageLine({
        sourceId: "email",
        sourceLabel: "Email",
        declaredScope: "Not integrated",
        declaredInterval: "(0, 4]",
        connection: "not_connected",
        progress: "not_yet_checked",
        uncertainty: { result_uncertain: false },
        counts: {
          scanned: 0,
          skipped: 0,
          refused: 0,
          inaccessible: 0,
          unsupported: 0,
          not_yet_scanned: 0,
        },
        observedAt: "2026-08-05T00:00:00.000Z",
      }),
    ).toBe("Email: Not connected, Not checked yet");
  });

  it("states received revenue as the ledger statement when nothing was received", () => {
    const money = {
      outcome: {
        currency: "USD",
        byStatus: {
          projected: [],
          quoted: [],
          invoiced: [],
          received: [],
          spent: [],
          refunded: [],
        },
      },
      hasNoReceivedRevenue: true,
      noReceivedRevenueStatement: "No received revenue is recorded in Foundry's operational ledger.",
    } as CommandCenterSnapshot["money"];
    expect(
      formatMoneyGlance({ money } as CommandCenterSnapshot).received,
    ).toContain("No received revenue");
  });

  it("never renders an absent spend record as a recorded zero", () => {
    const money = {
      outcome: {
        currency: "USD",
        byStatus: {
          projected: [],
          quoted: [],
          invoiced: [],
          received: [],
          spent: [],
          refunded: [],
        },
      },
      hasNoReceivedRevenue: true,
      noReceivedRevenueStatement: "No received revenue is recorded in Foundry's operational ledger.",
    } as CommandCenterSnapshot["money"];
    const spent = formatMoneyGlance({ money } as CommandCenterSnapshot).spent;
    expect(spent).toContain("No spend record exists");
    expect(spent).not.toContain("0.00");
  });

  it("states a recorded spend as a figure once a spend record exists", () => {
    const money = {
      outcome: {
        currency: "USD",
        byStatus: {
          projected: [],
          quoted: [],
          invoiced: [],
          received: [],
          spent: [
            {
              recordId: "spend-1",
              status: "spent",
              currency: "USD",
              amount: 4.25,
              evidence: [{ eventId: "e-1", eventType: "agentrun.completed" }],
              recordedAt: "2026-08-05T00:00:00.000Z",
              responsibleEntityType: "Build",
              responsibleEntityId: "build-1",
            },
          ],
          refunded: [],
        },
      },
      hasNoReceivedRevenue: true,
      noReceivedRevenueStatement: "No received revenue is recorded in Foundry's operational ledger.",
    } as unknown as CommandCenterSnapshot["money"];
    expect(formatMoneyGlance({ money } as CommandCenterSnapshot).spent).toBe("USD 4.25");
  });

  it("surfaces a stop reason so a stopped scan cannot read as complete coverage", () => {
    expect(
      formatCoverageLine({
        sourceId: "nas",
        sourceLabel: "NAS archive",
        declaredScope: "All shares",
        declaredInterval: "(0, 9]",
        connection: "connected",
        progress: "checked",
        uncertainty: { result_uncertain: false },
        counts: {
          scanned: 12,
          skipped: 0,
          refused: 0,
          inaccessible: 0,
          unsupported: 0,
          not_yet_scanned: 0,
        },
        stopReason: "cancelled by operator",
        observedAt: "2026-08-05T00:00:00.000Z",
      }),
    ).toBe("NAS archive: Connected, Checked · stopped: cancelled by operator");
  });
});

describe("commandCenterStatusLabel", () => {
  it("names every honest status", () => {
    expect(commandCenterStatusLabel("invalid_contract")).toBe("Invalid contract");
    expect(commandCenterStatusLabel("unavailable")).toBe("Unavailable");
  });
});
