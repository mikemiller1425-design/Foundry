import { expect, test } from "@playwright/test";

async function openCompletedTrace(page: import("@playwright/test").Page) {
  await page.goto("/");
  await page.getByLabel("Fixture journey").selectOption("completed-run");
  const expandIntelligence = page.getByRole("button", {
    name: "Expand right live-intelligence",
  });
  if (await expandIntelligence.isVisible()) await expandIntelligence.click();
  const trace = page.getByRole("region", { name: "Agent trace replay" });
  await trace.scrollIntoViewIfNeeded();
  return trace;
}

test.describe("Agent trace replay", () => {
  test("replays a declared departure and exposes its causal evidence boundary", async ({
    page,
  }) => {
    const trace = await openCompletedTrace(page);
    await expect(trace).toContainText("Causal route recording");
    await expect(trace).toContainText("3/3 events");

    const firstLeg = trace.getByRole("button", { name: /Replay trace 1:/ });
    await firstLeg.click();

    await expect(firstLeg).toHaveAttribute("aria-current", "step");
    await expect(page.getByTestId("runtime-source")).toContainText("Agent trace");
    await expect(page.getByRole("region", { name: "Agent life" })).toContainText("traveling");
    await expect(trace).toContainText(/not a precise path, live location/i);
  });

  test("remains recoverable and horizontally bounded on a compact viewport", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const trace = await openCompletedTrace(page);

    await expect(trace.getByRole("button", { name: /Replay trace 1:/ })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  });
});
