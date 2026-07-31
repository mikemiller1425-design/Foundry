import { expect, test } from "@playwright/test";

// FBL-011 required automated tests: canvas mounts without console/WebGL
// errors, and resize handling — verified at all three target viewports
// (see playwright.config.ts projects) plus an explicit container-resize
// check, since jsdom (used by the Vitest unit suite) cannot create a real
// WebGL context and so cannot verify this at the unit level.

test.describe("Empty React Three Fiber world", () => {
  test("mounts a canvas inside the world region with no console or page errors", async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/");

    const world = page.getByTestId("shell-world");
    const canvas = world.locator("canvas");
    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    expect(box!.width).toBeGreaterThan(0);
    expect(box!.height).toBeGreaterThan(0);

    // Give WebGL context creation and the first R3F frame a moment to run.
    await page.waitForTimeout(500);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("the canvas fills the world region and tracks it when the region resizes", async ({
    page,
  }) => {
    await page.goto("/");

    const worldBox = await page.getByTestId("shell-world").boundingBox();
    expect(worldBox).not.toBeNull();

    // react-use-measure's ResizeObserver callback fires asynchronously
    // after the first paint, so the canvas may briefly report its default
    // intrinsic size (300×150) before R3F applies the measured container
    // size — poll rather than reading the bounding box once, synchronously.
    await expect
      .poll(async () => {
        const canvasBox = await page.getByTestId("shell-world").locator("canvas").boundingBox();
        return canvasBox?.width;
      })
      .toBeCloseTo(worldBox!.width, 0);
    const canvasBoxBefore = await page.getByTestId("shell-world").locator("canvas").boundingBox();
    expect(canvasBoxBefore!.height).toBeCloseTo(worldBox!.height, 0);

    // Collapsing the left navigation panel grows the world region — the
    // canvas (via R3F's built-in ResizeObserver) must track it without a
    // page reload.
    await page.getByRole("button", { name: "Collapse left navigation" }).click();

    const worldBoxAfter = await page.getByTestId("shell-world").boundingBox();
    await expect
      .poll(async () => {
        const canvasBox = await page.getByTestId("shell-world").locator("canvas").boundingBox();
        return canvasBox?.width;
      })
      .toBeCloseTo(worldBoxAfter!.width, 0);
  });
});
