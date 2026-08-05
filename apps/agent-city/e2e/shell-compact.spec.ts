import { expect, test } from "@playwright/test";

const COMPACT_VIEWPORT = { width: 390, height: 844 };

test.describe("Compact world-first shell", () => {
  test.beforeEach(async ({ page }) => {
    await page.setViewportSize(COMPACT_VIEWPORT);
    await page.goto("/");
  });

  test("preserves the world as the primary surface with recoverable panels", async ({ page }) => {
    await expect(page.getByRole("button", { name: "Expand left navigation" })).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Expand right live-intelligence" }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Expand event timeline" })).toBeVisible();

    const worldBox = await page.getByTestId("shell-world").boundingBox();
    expect(worldBox).not.toBeNull();
    expect(worldBox!.width).toBeGreaterThanOrEqual(COMPACT_VIEWPORT.width * 0.7);
    expect(worldBox!.height).toBeGreaterThan(COMPACT_VIEWPORT.height * 0.6);
  });

  test("keeps fixture navigation usable without causing document-level overflow", async ({
    page,
  }) => {
    await expect(page.getByLabel("Fixture journey")).toBeVisible();
    await page.getByLabel("Fixture journey").selectOption("approval-gate");
    await expect(page.getByTestId("runtime-source")).toContainText("Approval gate");

    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
      commandClient: document.querySelector<HTMLElement>('[data-testid="shell-command-input"]')
        ?.clientWidth,
      commandScroll: document.querySelector<HTMLElement>('[data-testid="shell-command-input"]')
        ?.scrollWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
    expect(dimensions.commandScroll).toBeGreaterThan(dimensions.commandClient ?? 0);
  });
});
