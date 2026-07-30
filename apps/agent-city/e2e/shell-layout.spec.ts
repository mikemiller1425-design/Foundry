import { expect, test } from "@playwright/test";

// FBL-005 required automated tests: layout assertions at all three target
// viewports (see playwright.config.ts projects), and an assertion that no
// app-wide max-width constrains the primary shell.

const REGIONS = [
  { label: "top system bar", testId: "shell-top-bar" },
  { label: "left navigation", testId: "shell-left-nav" },
  { label: "central operational world", testId: "shell-world" },
  { label: "right live-intelligence", testId: "shell-intel" },
  { label: "bottom event timeline", testId: "shell-timeline" },
  { label: "persistent command input", testId: "shell-command-input" },
  { label: "selected-object details", testId: "shell-detail-panel" },
] as const;

test.describe("Ultrawide application shell", () => {
  test("uses the full viewport with no app-wide max-width clipping", async ({ page, viewport }) => {
    await page.goto("/");
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(viewport!.width);

    const rootMaxWidth = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="shell-root"]');
      return root ? getComputedStyle(root).maxWidth : null;
    });
    expect(rootMaxWidth).toBe("none");

    const rootBox = await page.locator('[data-testid="shell-root"]').boundingBox();
    expect(rootBox).not.toBeNull();
    expect(rootBox!.width).toBeGreaterThanOrEqual(viewport!.width * 0.99);
  });

  for (const region of REGIONS) {
    test(`${region.label} region is present and not collapsed`, async ({ page }) => {
      await page.goto("/");
      const locator = page.getByTestId(region.testId);
      await expect(locator).toBeVisible();
      const box = await locator.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.width).toBeGreaterThan(0);
      expect(box!.height).toBeGreaterThan(0);
    });
  }

  test("central world region remains dominant by width", async ({ page }) => {
    await page.goto("/");
    const worldBox = await page.getByTestId("shell-world").boundingBox();
    const navBox = await page.getByTestId("shell-left-nav").boundingBox();
    const intelBox = await page.getByTestId("shell-intel").boundingBox();
    expect(worldBox).not.toBeNull();
    expect(navBox).not.toBeNull();
    expect(intelBox).not.toBeNull();
    expect(worldBox!.width).toBeGreaterThan(navBox!.width);
    expect(worldBox!.width).toBeGreaterThan(intelBox!.width);
  });

  test("no mandatory region collapses to zero size at this viewport", async ({ page }) => {
    await page.goto("/");
    for (const region of REGIONS) {
      const box = await page.getByTestId(region.testId).boundingBox();
      expect(box, `${region.label} should have a bounding box`).not.toBeNull();
      expect(box!.width, `${region.label} width`).toBeGreaterThan(0);
      expect(box!.height, `${region.label} height`).toBeGreaterThan(0);
    }
  });
});
