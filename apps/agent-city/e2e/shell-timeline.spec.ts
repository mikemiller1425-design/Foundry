import { expect, test, type Page } from "@playwright/test";
import { pauseDemoForStableFeed, readEventTotal, waitForFeedToGrowBeyond } from "./stable-state";

// FBL-009 required automated tests (browser-level): full demo ordering as
// rendered in the real DOM, filtering, pause behavior, payload inspection,
// and keyboard access, verified at all three target viewports (see
// playwright.config.ts projects). Deterministic-ordering/idempotency at the
// data level is exhaustively unit-tested in src/lib/mock-runtime; this file
// verifies the same behavior renders correctly in a real browser.

async function readSummary(page: Page): Promise<{ filtered: number; total: number }> {
  const text = await page.getByTestId("event-count-summary").innerText();
  const match = text.match(/(\d+)\s*\/\s*(\d+)\s*events/);
  if (!match) throw new Error(`Unparseable event count summary: "${text}"`);
  return { filtered: Number(match[1]), total: Number(match[2]) };
}

async function readTotalEventsCount(page: Page): Promise<number> {
  return (await readSummary(page)).total;
}

async function readFilteredEventsCount(page: Page): Promise<number> {
  return (await readSummary(page)).filtered;
}

test.describe("Event timeline", () => {
  test("events render chronologically as the demo plays, in the correct canonical order", async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.goto("/");

    // The canonical script's first events are fixed and order-critical.
    // Auto-retrying assertions (not a fixed sleep) tolerate real-timer
    // pacing drift under parallel test load.
    await expect(page.getByTestId("timeline-row").filter({ hasText: "Build created" })).toBeVisible(
      { timeout: 30000 },
    );

    const texts = await page.getByTestId("timeline-row").allTextContents();
    // The very first row is the auto-issued demo.start command's own
    // feedback event; the canonical script's system.started follows it.
    expect(texts[0]).toContain("command submitted: demo.start");
    expect(texts.some((t) => t.includes("started") && t.includes("Neighborhood"))).toBe(true);
    expect(texts.some((t) => t.includes("registered as architect"))).toBe(true);
    expect(texts.some((t) => t.includes("submitted objective"))).toBe(true);

    const objectiveIndex = texts.findIndex((t) => t.includes("submitted objective"));
    const buildCreatedIndex = texts.findIndex((t) => t.includes("Build created"));
    expect(objectiveIndex).toBeGreaterThanOrEqual(0);
    expect(buildCreatedIndex).toBeGreaterThan(objectiveIndex);
  });

  test("event count increases over time without ever decreasing (append-only)", async ({
    page,
  }) => {
    await page.goto("/");
    // The subject here is *growth*, so the wait is on growth itself. A
    // fixed sleep asserts nothing about the feed and everything about how
    // busy the machine happened to be.
    await expect(page.getByTestId("timeline-row").first()).toBeVisible();
    const first = await readEventTotal(page);
    await waitForFeedToGrowBeyond(page, first);
    const second = await readEventTotal(page);
    expect(second).toBeGreaterThanOrEqual(first);
  });

  test("filtering by severity narrows the visible rows", async ({ page }) => {
    test.setTimeout(45000);
    await page.goto("/");

    // Wait for the "error" severity option to exist (emitted by the one
    // intentional requirement failure) rather than guessing a fixed delay.
    const severitySelect = page.getByLabel("Filter by severity");
    await expect(severitySelect.locator('option[value="error"]')).toBeAttached({ timeout: 30000 });

    // The rendered "timeline-row" count reflects the virtualization
    // window (bounded by container height), not the true total event
    // count, once the list exceeds that window's capacity — which it
    // reliably does partway through this test, since the demo keeps
    // playing in real time throughout. The "N / M events" summary is the
    // real total; that (not a DOM row count) is what "narrows" and
    // "restores" should be asserted against.
    const totalEventsBefore = await readTotalEventsCount(page);
    await severitySelect.selectOption("error");
    await expect(page.getByTestId("timeline-row").first()).toBeVisible();
    const filteredEventsCount = await readFilteredEventsCount(page);
    expect(filteredEventsCount).toBeGreaterThan(0);
    expect(filteredEventsCount).toBeLessThanOrEqual(await readTotalEventsCount(page));
    expect(await page.getByTestId("timeline-row").count()).toBeGreaterThan(0);

    await severitySelect.selectOption("__all__");
    // Monotonic growth (matches the adjacent "append-only" test) — new
    // events can arrive between the first snapshot and this one.
    await expect
      .poll(async () => readTotalEventsCount(page))
      .toBeGreaterThanOrEqual(totalEventsBefore);
    expect(await page.getByTestId("timeline-row").count()).toBeGreaterThan(0);
  });

  test("pause autoscroll stops the view from jumping, resume restores it", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("timeline-row").first()).toBeVisible();

    const pauseButton = page.getByRole("button", { name: "Pause autoscroll" });
    await pauseButton.click();
    await expect(page.getByRole("button", { name: "Resume autoscroll" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // The control must hold across further events arriving — so wait for
    // events to actually arrive, rather than for a duration during which
    // they may or may not have.
    await waitForFeedToGrowBeyond(page, await readEventTotal(page));
    await expect(page.getByRole("button", { name: "Resume autoscroll" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.getByRole("button", { name: "Resume autoscroll" }).click();
    await expect(page.getByRole("button", { name: "Pause autoscroll" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  test("selecting a row shows its payload and an explicit jump-to-world-object unavailable state", async ({
    page,
  }) => {
    await page.goto("/");
    // This is the FBL-028 §12.7 failure ("element detached from the DOM
    // while clicking a row in the live-updating timeline"). The feed is
    // virtualized: as events arrive the mounted window slides, so a row
    // resolved a moment ago can be gone before the click lands. Bringing
    // playback to rest first removes the race outright — a longer timeout
    // would only have given the list more time to move.
    await pauseDemoForStableFeed(page);

    await page.getByTestId("timeline-row").first().click();
    const detail = page.getByTestId("timeline-detail");
    await expect(detail.getByText("Payload")).toBeVisible();
    await expect(detail.locator("pre")).toBeVisible();

    const jumpButton = detail.getByRole("button", { name: /Jump to world object/ });
    await expect(jumpButton).toBeDisabled();
    await expect(jumpButton).toHaveText(/not yet available/);
  });

  test("timeline controls and rows are reachable and operable by keyboard alone", async ({
    page,
  }) => {
    await page.goto("/");
    // Focusing and activating a row requires that row to still exist when
    // the key lands — same detachment race as above.
    await pauseDemoForStableFeed(page);

    await page.getByLabel("Filter by severity").focus();
    await expect(page.getByLabel("Filter by severity")).toBeFocused();

    const firstRow = page.getByTestId("timeline-row").first();
    await firstRow.focus();
    await expect(firstRow).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(firstRow).toHaveAttribute("aria-pressed", "true");
  });
});
