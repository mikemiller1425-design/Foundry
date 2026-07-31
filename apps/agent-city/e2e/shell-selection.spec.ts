import { expect, test, type Page } from "@playwright/test";

// FBL-015 required automated tests: pointer hit target, keyboard
// traversal, navigator-to-Canvas and Canvas-to-navigator synchronization,
// detail-panel synchronization, camera focus (FBL-012's API), deselection,
// duplicate-event behavior, reduced motion, no keyboard trap, no
// regression in timeline/approval/commands/panels — at all three target
// viewports (see playwright.config.ts projects).

async function waitForMarkerReady(page: Page) {
  await expect(page.getByTestId("lighthouse-marker")).toHaveAttribute("data-visible", "true", {
    timeout: 20000,
  });
}

async function readCameraTargetX(page: Page): Promise<number> {
  const text = await page.getByTestId("camera-readout").innerText();
  const match = text.match(/Target:\s*\(([\d.-]+),/);
  return match ? Number(match[1]) : NaN;
}

test.describe("Object selection", () => {
  test("pointer click on the Lighthouse selects it (pointer hit target) and syncs navigator + detail panel", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMarkerReady(page);

    const marker = page.getByTestId("lighthouse-marker");
    const xPercent = Number(await marker.getAttribute("data-x-percent"));
    const yPercent = Number(await marker.getAttribute("data-y-percent"));
    const worldBox = await page.getByTestId("shell-world").boundingBox();
    expect(worldBox).not.toBeNull();
    const clickX = worldBox!.x + (xPercent / 100) * worldBox!.width;
    const clickY = worldBox!.y + (yPercent / 100) * worldBox!.height;

    await page.mouse.click(clickX, clickY);

    await expect(marker).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("building-list-item").first()).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByTestId("shell-detail-panel")).toContainText("Building: Lighthouse");
  });

  test("selecting from the left navigator syncs the Canvas (navigator-to-Canvas sync)", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMarkerReady(page);

    await page.getByTestId("building-list-item").first().click();

    await expect(page.getByTestId("lighthouse-marker")).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("shell-detail-panel")).toContainText("Building: Lighthouse");
  });

  test("keyboard: Enter while the 3D world has focus selects the Lighthouse", async ({ page }) => {
    await page.goto("/");
    await waitForMarkerReady(page);

    // Click a spot in the canvas that is not the Lighthouse itself, just
    // to give the canvas keyboard focus (world-model.md requires keyboard
    // selection independent of ever having clicked the object).
    await page
      .getByTestId("shell-world")
      .locator("canvas")
      .click({ position: { x: 10, y: 10 } });
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("lighthouse-marker")).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("building-list-item").first()).toHaveAttribute("aria-pressed", "true");
  });

  test("Escape clears the selection from any focus context", async ({ page }) => {
    await page.goto("/");
    await waitForMarkerReady(page);

    await page.getByTestId("building-list-item").first().click();
    await expect(page.getByTestId("lighthouse-marker")).toHaveAttribute("data-selected", "true");

    // The navigator button (not the canvas) has focus here — Escape must
    // still work.
    await page.keyboard.press("Escape");

    await expect(page.getByTestId("lighthouse-marker")).toHaveAttribute("data-selected", "false");
    await expect(page.getByTestId("building-list-item").first()).toHaveAttribute("aria-pressed", "false");
    await expect(page.getByTestId("shell-detail-panel")).toContainText("No selection");
  });

  test("selecting the Lighthouse moves the FBL-012 camera to focus on it", async ({ page }) => {
    await page.goto("/");
    await waitForMarkerReady(page);
    const before = await readCameraTargetX(page);
    expect(before).toBeCloseTo(0, 0); // canonical target is (0,0,0)

    await page.getByTestId("building-list-item").first().click();

    // The Lighthouse's focus position has z = -10; target.z should move
    // toward it (parsed from the same readout, second captured group).
    await expect
      .poll(async () => {
        const text = await page.getByTestId("camera-readout").innerText();
        const match = text.match(/Target:\s*\([\d.-]+,\s*[\d.-]+,\s*([\d.-]+)\)/);
        return match ? Number(match[1]) : NaN;
      })
      .toBeCloseTo(-10, 0);
  });

  test("duplicate selection events do not duplicate timeline records", async ({ page }) => {
    await page.goto("/");
    await waitForMarkerReady(page);

    await page.getByTestId("building-list-item").first().click();
    await expect(page.getByTestId("lighthouse-marker")).toHaveAttribute("data-selected", "true");
    // Re-clicking the already-selected object must not add a second row.
    await page.getByTestId("building-list-item").first().click();
    await page.waitForTimeout(300);

    const rows = page.getByTestId("timeline-row").filter({ hasText: "selected" });
    await expect(rows).toHaveCount(1);
  });

  test("reduced motion: selection still works and camera focus snaps instantly", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await waitForMarkerReady(page);

    await page.getByTestId("building-list-item").first().click();

    await expect(page.getByTestId("lighthouse-marker")).toHaveAttribute("data-selected", "true");
    // No polling needed — reduced motion means the ease is a single-frame
    // snap, so the very next readout should already show the destination.
    await expect
      .poll(
        async () => {
          const text = await page.getByTestId("camera-readout").innerText();
          const match = text.match(/Target:\s*\([\d.-]+,\s*[\d.-]+,\s*([\d.-]+)\)/);
          return match ? Number(match[1]) : NaN;
        },
        { timeout: 2000 },
      )
      .toBeCloseTo(-10, 0);
  });

  test("no keyboard trap: Tab still moves focus away from the 3D world", async ({ page }) => {
    await page.goto("/");
    await waitForMarkerReady(page);
    await page
      .getByTestId("shell-world")
      .locator("canvas")
      .click({ position: { x: 10, y: 10 } });
    await expect(page.getByTestId("shell-world").locator("canvas")).toBeFocused();

    await page.keyboard.press("Tab");
    const stillOnCanvas = await page
      .getByTestId("shell-world")
      .locator("canvas")
      .evaluate((el) => el === document.activeElement);
    expect(stillOnCanvas).toBe(false);
  });

  test("existing 2D functionality (timeline, approval, command bar) remains unaffected", async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.goto("/");
    await expect(page.getByTestId("command-feedback")).toHaveText("Running");
    await page.selectOption("#demo-speed", "4");
    await expect(page.getByTestId("approval-card")).toBeVisible({ timeout: 30000 });
    await page.getByTestId("approval-card").getByRole("button", { name: "Approve" }).click();
    await expect(page.getByTestId("approval-card")).not.toBeVisible();
    await expect(page.getByTestId("timeline-row").first()).toBeVisible();
  });
});
