import { expect, test } from "@playwright/test";

test.describe("Frontend-local world atmosphere", () => {
  test("changes and persists visual treatment without changing fixture truth", async ({ page }) => {
    await page.goto("/");
    await page.getByLabel("Fixture journey").selectOption("completed-run");

    const eventCount = page.getByText(/^\d+ \/ \d+ events$/);
    const countBefore = await eventCount.textContent();
    const sourceBefore = await page.getByTestId("runtime-source").textContent();

    await page.getByRole("button", { name: "Atmosphere" }).click();
    const panel = page.getByRole("region", { name: "World atmosphere" });
    await panel.getByRole("radio", { name: /Aurora/ }).click();

    await expect(page.getByTestId("shell-root")).toHaveAttribute("data-atmosphere", "aurora");
    await expect(eventCount).toHaveText(countBefore!);
    await expect(page.getByTestId("runtime-source")).toHaveText(sourceBefore!);
    await expect(panel).toContainText(/change no events, severity, authority/i);

    await page.reload();
    await expect(page.getByTestId("shell-root")).toHaveAttribute("data-atmosphere", "aurora");
  });

  test("honors reduced motion and stays bounded at the compact breakpoint", async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Atmosphere" }).click();

    const panel = page.getByRole("region", { name: "World atmosphere" });
    await expect(panel.getByRole("checkbox", { name: /Ambient world motion/ })).toBeDisabled();
    await expect(panel).toContainText(/device requests reduced motion/i);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  });
});
