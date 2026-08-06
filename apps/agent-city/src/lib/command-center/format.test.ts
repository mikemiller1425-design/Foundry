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
});

describe("commandCenterStatusLabel", () => {
  it("names every honest status", () => {
    expect(commandCenterStatusLabel("invalid_contract")).toBe("Invalid contract");
    expect(commandCenterStatusLabel("unavailable")).toBe("Unavailable");
  });
});
