import { expect, test } from "@playwright/test";

/**
 * FBL-026 — automated visual validation of the disconnected and restored
 * states (F-10), driven in a real browser.
 *
 * These run against the default mock runtime, so the app under test has
 * no backend to disconnect from. To exercise the real disconnect path
 * without standing up a backend in CI, the page is loaded with a stub
 * EventSource/fetch installed before hydration, which lets the test drive
 * the connection lifecycle deterministically — the same
 * `BackendRuntimeProvider` code path a real deployment uses.
 */

const API_URL = "http://backend.test";

/** Installs a controllable fake backend before any app code runs. */
async function installFakeBackend(page: import("@playwright/test").Page) {
  await page.addInitScript((apiUrl: string) => {
    const snapshot = {
      buildings: [],
      agents: [],
      currentBuild: null,
      activeTransfers: [],
      approvals: [],
      inventoryCounts: { successfulPackages: 9 },
      health: { status: "healthy", reasons: ["nominal"] },
      lastProcessedEventId: null,
    };

    const w = window as unknown as {
      __foundryTest: {
        sources: { fail: () => void; open: () => void }[];
        failAll: () => void;
        openAll: () => void;
      };
      EventSource: unknown;
      fetch: typeof fetch;
    };

    const sources: { fail: () => void; open: () => void }[] = [];
    w.__foundryTest = {
      sources,
      failAll: () => sources.forEach((s) => s.fail()),
      openAll: () => sources.forEach((s) => s.open()),
    };

    const originalFetch = w.fetch.bind(window);
    w.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.startsWith(apiUrl)) {
        if (url.includes("/command-center")) {
          const emptyCc = {
            snapshotVersion: "command-center-v1",
            observedAt: "2026-08-05T00:00:00.000Z",
            latestSequence: 0,
            externalActionClassifierVersion: 1,
            missions: [],
            briefing: {
              record: null,
              cursor: 0,
              proposedNextInterval: { previousAcknowledgedSequence: 0, capturedEndSequence: 0 },
              intervalIsEmpty: true,
            },
            decisionBatchPolicy: {
              timezone: null,
              schedule: { kind: "unconfigured" },
              nextExpectedBatchAt: null,
              enabled: false,
              immediateInterruptionCategories: [],
              configuredAt: null,
              configuredBy: null,
            },
            externalActions: {
              projection: {
                classifierVersion: 1,
                fromSequenceExclusive: 0,
                toSequenceInclusive: 0,
                actions: [],
                counts: { attempted: 0, running: 0, succeeded: 0, failed: 0, cancelled: 0 },
              },
              noQualifyingActionsStatement:
                "No qualifying external actions were recorded in Foundry's operational ledger for this briefing interval.",
            },
            money: {
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
              noReceivedRevenueStatement:
                "No received revenue is recorded in Foundry's operational ledger.",
            },
            coverage: [],
            recommendations: [],
          };
          return Promise.resolve(new Response(JSON.stringify(emptyCc), { status: 200 }));
        }
        const body = url.includes("/world-state") ? snapshot : [];
        return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
      }
      return originalFetch(input as RequestInfo, init);
    }) as typeof fetch;

    class FakeEventSource {
      onopen: ((ev: unknown) => void) | null = null;
      onerror: ((ev: unknown) => void) | null = null;
      private listeners: ((event: MessageEvent) => void)[] = [];
      constructor(public url: string) {
        sources.push({
          open: () => this.onopen?.({}),
          fail: () => this.onerror?.({}),
        });
        // Open on the next tick, mimicking a real connection handshake.
        setTimeout(() => this.onopen?.({}), 0);
      }
      addEventListener(type: string, listener: (event: MessageEvent) => void) {
        if (type === "foundry-event") this.listeners.push(listener);
      }
      close() {}
    }
    w.EventSource = FakeEventSource;
  }, API_URL);
}

test.describe("FBL-026 realtime connection — disconnected and restored states", () => {
  test.skip(
    !process.env.NEXT_PUBLIC_FOUNDRY_API_URL,
    "Requires the app to be built against a backend URL; see README for the backend-mode run.",
  );

  test("disconnect shows the stale banner and disables mutation controls; restore clears both", async ({
    page,
  }) => {
    await installFakeBackend(page);
    await page.goto("/");

    // Connected: no stale banner.
    await expect(page.getByTestId("connection-banner")).toHaveCount(0);

    // Drop the stream.
    await page.evaluate(() => {
      (window as unknown as { __foundryTest: { failAll: () => void } }).__foundryTest.failAll();
    });

    const banner = page.getByTestId("connection-banner");
    await expect(banner).toBeVisible();
    await expect(banner).toHaveAttribute("data-connection-status", "disconnected");
    await expect(banner).toContainText(/disconnected/i);

    // Every playback/mutation control is disabled while disconnected.
    for (const name of ["Start", "Pause", "Resume", "Reset", "Replay"]) {
      await expect(page.getByRole("button", { name, exact: true })).toBeDisabled();
    }

    await expect(page).toHaveScreenshot("realtime-disconnected.png", { maxDiffPixelRatio: 0.02 });

    // Restore the stream.
    await page.evaluate(() => {
      (window as unknown as { __foundryTest: { openAll: () => void } }).__foundryTest.openAll();
    });

    await expect(page.getByTestId("connection-banner")).toHaveCount(0);
    await expect(page).toHaveScreenshot("realtime-restored.png", { maxDiffPixelRatio: 0.02 });
  });
});
