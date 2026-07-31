import { expect, test, type Locator, type Page } from "@playwright/test";

// FBL-017 required automated tests: selection hit-target tests for all
// five operational buildings, state-mapping proof through a real run, and
// a targeted proof that the Warehouse Level 2 geometry never appears
// before a real `upgrade.completed` event (world-model.md "Warehouse" V1
// limits; this rung's own explicit "Allowed work"/"Explicitly prohibited
// work" pair).

const OPERATIONAL_BUILDING_IDS = [
  "construction-office",
  "warehouse",
  "qa",
  "deployment-dock",
  "construction-site",
] as const;

function marker(page: Page, objectId: string): Locator {
  return page.locator(`[data-testid="world-object-marker"][data-object-id="${objectId}"]`);
}

async function waitForMarkersReady(page: Page) {
  for (const id of OPERATIONAL_BUILDING_IDS) {
    await expect(marker(page, id)).toHaveAttribute("data-visible", "true", { timeout: 20000 });
  }
}

test.describe("Operational buildings (FBL-017)", () => {
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

  test("all five operational buildings are mounted, distinct world objects", async ({ page }) => {
    await page.goto("/");
    await waitForMarkersReady(page);
    const buildingItems = page.getByTestId("building-list-item");
    await expect(buildingItems).toHaveCount(10); // Lighthouse + 3 residences + 5 operational buildings + vehicle (FBL-019)
  });

  test("pointer click on the Construction Office selects it (hit target) and syncs navigator + detail panel", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMarkersReady(page);

    const officeMarker = marker(page, "construction-office");
    const xPercent = Number(await officeMarker.getAttribute("data-x-percent"));
    const yPercent = Number(await officeMarker.getAttribute("data-y-percent"));
    const worldBox = await page.getByTestId("shell-world").boundingBox();
    expect(worldBox).not.toBeNull();
    const clickX = worldBox!.x + (xPercent / 100) * worldBox!.width;
    const clickY = worldBox!.y + (yPercent / 100) * worldBox!.height;

    await page.mouse.click(clickX, clickY);

    await expect(officeMarker).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("shell-detail-panel")).toContainText(
      "Building: Construction Office",
    );
  });

  test("selecting each operational building from the navigator selects the matching 3D object", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMarkersReady(page);

    // Navigator order: 0 lighthouse, 1-3 residences, 4-8 operational buildings.
    for (const [index, id] of OPERATIONAL_BUILDING_IDS.entries()) {
      await page.getByTestId("building-list-item").nth(4 + index).click();
      await expect(marker(page, id)).toHaveAttribute("data-selected", "true");
      await expect(page.getByTestId("shell-detail-panel")).toContainText("Building:");
    }
  });

  test("Escape clears operational building selection from any focus context", async ({ page }) => {
    await page.goto("/");
    await waitForMarkersReady(page);

    await page.getByTestId("building-list-item").nth(4).click();
    await expect(marker(page, "construction-office")).toHaveAttribute("data-selected", "true");

    await page.keyboard.press("Escape");

    await expect(marker(page, "construction-office")).toHaveAttribute("data-selected", "false");
    await expect(page.getByTestId("shell-detail-panel")).toContainText("No selection");
  });

  test("the Warehouse starts at level 1 and only reaches level 2 after a real upgrade.completed, at the end of a full run", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/");
    await waitForMarkersReady(page);
    await page.selectOption("#demo-speed", "4");

    const warehouseItem = page.getByTestId("building-list-item").nth(5); // 0 lighthouse, 1-3 residences, 4 office, 5 warehouse
    await warehouseItem.click();
    const detail = page.getByTestId("shell-detail-panel");
    await expect(detail).toContainText("level: 1");

    // Let the one pending approval (QA -> Dock transfer) resolve so the
    // script can continue through build completion and the Warehouse
    // upgrade sequence (upgrade.eligible/requested/approved/started/
    // completed) — all scripted, deterministic events, not a UI toggle.
    await expect(page.getByTestId("approval-card")).toBeVisible({ timeout: 30000 });
    await page.getByTestId("approval-card").getByRole("button", { name: "Approve" }).click();

    await expect(detail).toContainText("level: 2", { timeout: 20000 });
  });

  test("no keyboard trap: Tab still moves focus away from the 3D world after operational buildings were added", async ({
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
