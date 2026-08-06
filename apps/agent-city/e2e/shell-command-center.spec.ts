import { expect, test } from "@playwright/test";

/**
 * Mock-mode Command Center surface: unavailable is stated honestly, and the
 * panel is reachable from the world glance without inventing figures.
 *
 * Live SSE refresh with vocabulary=command-center-v1 is covered by
 * `backendClient.test.ts` (opt-in stream + briefing.created refresh without
 * corrupting the V1 event log). That unit test is the live integration proof
 * that does not require a provisioned backend in CI.
 */

test.describe("Command Center panel in mock mode", () => {
  test("shows unavailable status and keeps 1b-i panels intact", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("shell-world")).toBeVisible();

    const expandIntelligence = page.getByRole("button", {
      name: "Expand right live-intelligence",
    });
    if (await expandIntelligence.isVisible()) await expandIntelligence.click();

    const panel = page.getByTestId("command-center-panel");
    await panel.scrollIntoViewIfNeeded();
    await expect(panel).toBeVisible();
    await expect(page.getByTestId("command-center-status")).toContainText(/Unavailable/i);
    await expect(page.getByTestId("command-center-glance")).toHaveCount(0);

    // 1b-i surfaces remain present beside Command Center.
    await expect(page.getByRole("region", { name: "Agent trace replay" })).toBeVisible();
    await expect(page.getByRole("region", { name: "Operational snapshot" })).toBeVisible();
  });

  test("is keyboard-focusable from the intel column", async ({ page }) => {
    await page.goto("/");
    const expandIntelligence = page.getByRole("button", {
      name: "Expand right live-intelligence",
    });
    if (await expandIntelligence.isVisible()) await expandIntelligence.click();

    const panel = page.getByTestId("command-center-panel");
    await panel.scrollIntoViewIfNeeded();
    await page.keyboard.press("Tab");
    await expect(panel).toBeVisible();
  });
});
