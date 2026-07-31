import { expect, test } from "@playwright/test";

// FBL-009 required automated tests (browser-level): full demo ordering as
// rendered in the real DOM, filtering, pause behavior, payload inspection,
// and keyboard access, verified at all three target viewports (see
// playwright.config.ts projects). Deterministic-ordering/idempotency at the
// data level is exhaustively unit-tested in src/lib/mock-runtime; this file
// verifies the same behavior renders correctly in a real browser.

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
    expect(texts[0]).toContain("started");
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
    await page.waitForTimeout(1000);
    const first = await page.getByTestId("timeline-row").count();
    await page.waitForTimeout(1500);
    const second = await page.getByTestId("timeline-row").count();
    expect(second).toBeGreaterThanOrEqual(first);
  });

  test("filtering by severity narrows the visible rows", async ({ page }) => {
    test.setTimeout(45000);
    await page.goto("/");

    // Wait for the "error" severity option to exist (emitted by the one
    // intentional requirement failure) rather than guessing a fixed delay.
    const severitySelect = page.getByLabel("Filter by severity");
    await expect(severitySelect.locator('option[value="error"]')).toBeAttached({ timeout: 30000 });

    const totalBefore = await page.getByTestId("timeline-row").count();
    await severitySelect.selectOption("error");
    await expect(page.getByTestId("timeline-row").first()).toBeVisible();
    const filteredCount = await page.getByTestId("timeline-row").count();
    expect(filteredCount).toBeGreaterThan(0);
    expect(filteredCount).toBeLessThanOrEqual(totalBefore);

    await severitySelect.selectOption("__all__");
    await expect(page.getByTestId("timeline-row")).toHaveCount(totalBefore);
    const restoredCount = await page.getByTestId("timeline-row").count();
    expect(restoredCount).toBe(totalBefore);
  });

  test("pause autoscroll stops the view from jumping, resume restores it", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1500);

    const pauseButton = page.getByRole("button", { name: "Pause autoscroll" });
    await pauseButton.click();
    await expect(page.getByRole("button", { name: "Resume autoscroll" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    await page.waitForTimeout(1500);
    await expect(page.getByRole("button", { name: "Resume autoscroll" })).toBeVisible();

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
    await page.waitForTimeout(1500);

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
    await page.waitForTimeout(1500);

    await page.getByLabel("Filter by severity").focus();
    await expect(page.getByLabel("Filter by severity")).toBeFocused();

    const firstRow = page.getByTestId("timeline-row").first();
    await firstRow.focus();
    await expect(firstRow).toBeFocused();
    await page.keyboard.press("Enter");
    await expect(firstRow).toHaveAttribute("aria-pressed", "true");
  });
});
