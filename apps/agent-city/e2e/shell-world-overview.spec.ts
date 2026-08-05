import { expect, test } from "@playwright/test";

test.describe("Foundry world overview", () => {
  test("distinguishes the implemented fixture district from uncommissioned concepts", async ({
    page,
  }) => {
    await page.goto("/");
    await page.getByRole("button", { name: "Map", exact: true }).click();

    const overview = page.getByRole("region", { name: "Foundry world overview" });
    await expect(overview).toBeVisible();
    await expect(overview).toContainText(/only implemented fixture district/i);

    await overview.getByRole("button", { name: /Knowledge Reach/ }).click();
    await expect(overview.getByText("No implementation")).toBeVisible();
    await expect(overview).toContainText(/No parcels, tenants, agents, rights, or backend route/i);
    await expect(overview.getByRole("button", { name: /Enter fixture district/ })).toHaveCount(0);

    await overview.getByRole("button", { name: /Agent City Operations/ }).click();
    await overview.getByRole("button", { name: /Enter fixture district/ }).click();
    await expect(overview).toHaveCount(0);
    await expect(page.getByRole("button", { name: "World", exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  test("keeps every map action visible and the document bounded at the compact breakpoint", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await page.getByRole("button", { name: "Map", exact: true }).click();

    const overview = page.getByRole("region", { name: "Foundry world overview" });
    await expect(overview.getByRole("button", { name: "Return to district" })).toBeVisible();
    await expect(overview.getByRole("button", { name: /Enter fixture district/ })).toBeVisible();
    await expect(overview.getByRole("button", { name: /Knowledge Reach/ })).toBeVisible();

    const documentWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(documentWidth).toBeLessThanOrEqual(390);
  });
});
