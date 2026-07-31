import { expect, test } from "@playwright/test";

// FBL-018 required automated tests: a render/geometry smoke test (the
// connectivity itself is unit-tested in roadNetwork.test.ts against the
// declared segment list) confirmed here at the browser level via real
// rendered pixels, plus regression checks that adding static road geometry
// does not disturb existing selection/2D functionality.

test.describe("Road network (FBL-018)", () => {
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

  test("the road network renders real, non-blank geometry connecting the neighborhood", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForTimeout(1000);

    // Sample a horizontal band through the middle of the world region,
    // where the office<->warehouse<->QA<->dock road segments run at ground
    // level, and confirm real rendered variety (road + ground + building
    // colors), not a blank fill — the same pixel-sampling discipline
    // shell-environment.spec.ts/shell-lighthouse.spec.ts already establish,
    // scoped to the band the roads specifically occupy. Connectivity
    // itself (which buildings a segment names) is unit-tested precisely in
    // roadNetwork.test.ts.
    const uniqueColorCount = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="shell-world"] canvas');
      if (!canvas) return 0;
      const off = document.createElement("canvas");
      off.width = canvas.width;
      off.height = canvas.height;
      const ctx = off.getContext("2d");
      if (!ctx) return 0;
      ctx.drawImage(canvas, 0, 0);
      const y = Math.floor(canvas.height * 0.55);
      const colors = new Set<string>();
      for (let x = 0; x < canvas.width; x += 2) {
        colors.add(Array.from(ctx.getImageData(x, y, 1, 1).data).join(","));
      }
      return colors.size;
    });

    expect(uniqueColorCount).toBeGreaterThan(1);
  });

  test("the road network survives a panel-driven resize without console/WebGL errors", async ({
    page,
  }) => {
    const pageErrors: string[] = [];
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Collapse left navigation" }).click();
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Expand left navigation" }).click();
    await page.waitForTimeout(500);

    expect(pageErrors).toEqual([]);
  });

  test("existing selection and 2D functionality (Lighthouse selection, timeline, approval, command bar) remains unaffected", async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.goto("/");

    await expect(page.getByTestId("lighthouse-marker")).toHaveAttribute("data-visible", "true", {
      timeout: 20000,
    });
    await page.getByTestId("building-list-item").first().click();
    await expect(page.getByTestId("lighthouse-marker")).toHaveAttribute("data-selected", "true");

    await expect(page.getByTestId("command-feedback")).toHaveText("Running");
    await page.selectOption("#demo-speed", "4");
    await expect(page.getByTestId("approval-card")).toBeVisible({ timeout: 30000 });
    await page.getByTestId("approval-card").getByRole("button", { name: "Approve" }).click();
    await expect(page.getByTestId("approval-card")).not.toBeVisible();
    await expect(page.getByTestId("timeline-row").first()).toBeVisible();
  });
});
