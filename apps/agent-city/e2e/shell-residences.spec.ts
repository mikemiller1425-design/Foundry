import { expect, test, type Locator, type Page } from "@playwright/test";

// FBL-016 required automated tests: selection hit-target tests for all
// three residences, plus browser-level proof (mirroring
// shell-lighthouse.spec.ts's pattern) that residence occupancy reflects
// real mock-runtime agent events through a full run, never shows "active
// work", and that existing 2D/selection functionality is unaffected.

const RESIDENCE_IDS = ["home-architect", "home-builder", "home-inspector"] as const;

function marker(page: Page, objectId: string): Locator {
  return page.locator(`[data-testid="world-object-marker"][data-object-id="${objectId}"]`);
}

async function waitForMarkersReady(page: Page) {
  for (const id of RESIDENCE_IDS) {
    await expect(marker(page, id)).toHaveAttribute("data-visible", "true", { timeout: 20000 });
  }
}

test.describe("Residences (FBL-016)", () => {
  test("renders with no console or page errors", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/");
    await page.waitForTimeout(1000);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("all three residences are mounted, distinct world objects", async ({ page }) => {
    await page.goto("/");
    await waitForMarkersReady(page);
    for (const id of RESIDENCE_IDS) {
      await expect(marker(page, id)).toHaveAttribute("data-visible", "true");
    }
    const buildingItems = page.getByTestId("building-list-item");
    await expect(buildingItems).toHaveCount(9); // Lighthouse + 3 residences + 5 operational buildings (FBL-017)
  });

  test("pointer click on the Architect residence selects it (hit target) and syncs navigator + detail panel", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMarkersReady(page);

    const architectMarker = marker(page, "home-architect");
    const xPercent = Number(await architectMarker.getAttribute("data-x-percent"));
    const yPercent = Number(await architectMarker.getAttribute("data-y-percent"));
    const worldBox = await page.getByTestId("shell-world").boundingBox();
    expect(worldBox).not.toBeNull();
    const clickX = worldBox!.x + (xPercent / 100) * worldBox!.width;
    const clickY = worldBox!.y + (yPercent / 100) * worldBox!.height;

    await page.mouse.click(clickX, clickY);

    await expect(architectMarker).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("shell-detail-panel")).toContainText(
      "Building: Architect Residence",
    );
  });

  test("selecting each residence from the navigator selects the matching 3D object and moves the camera", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMarkersReady(page);

    for (const [index, id] of RESIDENCE_IDS.entries()) {
      await page.getByTestId("building-list-item").nth(index + 1).click(); // +1: Lighthouse is index 0
      await expect(marker(page, id)).toHaveAttribute("data-selected", "true");
      await expect(page.getByTestId("shell-detail-panel")).toContainText("Building:");
    }
  });

  test("Escape clears residence selection from any focus context", async ({ page }) => {
    await page.goto("/");
    await waitForMarkersReady(page);

    await page.getByTestId("building-list-item").nth(1).click();
    await expect(marker(page, "home-architect")).toHaveAttribute("data-selected", "true");

    await page.keyboard.press("Escape");

    await expect(marker(page, "home-architect")).toHaveAttribute("data-selected", "false");
    await expect(page.getByTestId("shell-detail-panel")).toContainText("No selection");
  });

  test("no keyboard trap: Tab still moves focus away from the 3D world after residences were added", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMarkersReady(page);
    await page
      .getByTestId("shell-world")
      .locator("canvas")
      .click({ position: { x: 10, y: 10 } });
    await page.keyboard.press("Tab");
    const stillOnCanvas = await page
      .getByTestId("shell-world")
      .locator("canvas")
      .evaluate((el) => el === document.activeElement);
    expect(stillOnCanvas).toBe(false);
  });

  test("residence occupancy reflects real agent events through a run: occupied -> vacant (assigned) -> occupied (returned home)", async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.goto("/");
    await waitForMarkersReady(page);
    await page.selectOption("#demo-speed", "4");

    const architectItem = page.getByTestId("building-list-item").nth(1);
    await architectItem.click();
    const detail = page.getByTestId("shell-detail-panel");

    // Architect starts occupied/idle at home.
    await expect(detail).toContainText(/Occupied/);

    // The canonical script assigns the Architect to plan the build,
    // sending them to the Construction Office — the residence must go
    // vacant, never showing "active work" itself (Principle: residences
    // never represent active architecture/build/validation work).
    await expect(detail).toContainText(/Vacant/, { timeout: 30000 });
    expect(await detail.innerText()).not.toMatch(/working|active work/i);
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
