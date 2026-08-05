import { expect, test } from "@playwright/test";

async function openForgeworksShowroom(page: import("@playwright/test").Page) {
  await page.goto("/");
  const expandNavigation = page.getByRole("button", { name: "Expand left navigation" });
  if (await expandNavigation.isVisible()) await expandNavigation.click();
  await page.getByRole("button", { name: /Production Row\s*Forgeworks Cooperative/ }).click();
  const expandIntelligence = page.getByRole("button", {
    name: "Expand right live-intelligence",
  });
  if (await expandIntelligence.isVisible()) await expandIntelligence.click();
  await page.getByRole("button", { name: /Preview fictional tenant space/ }).click();
  return page.getByRole("region", { name: "Forgeworks Cooperative fixture showroom" });
}

test.describe("Fixture tenant spaces", () => {
  test("previews agent relationships without granting access or exposing execution", async ({
    page,
  }) => {
    const showroom = await openForgeworksShowroom(page);

    await expect(showroom).toBeVisible();
    await expect(showroom).toContainText("Not granted");
    await expect(showroom).toContainText("runtime actionnone");
    await expect(showroom).toContainText("backend recordnone");
    await expect(showroom).toContainText(/creates no tenant, lease, ownership/i);
    await expect(
      showroom.getByRole("button", { name: /authorize|grant|run|execute/i }),
    ).toHaveCount(0);

    const builderTab = showroom.getByRole("tab", { name: "Builder" });
    await builderTab.click();
    await expect(builderTab).toHaveAttribute("aria-selected", "true");
    await expect(showroom.getByRole("tabpanel")).toContainText(
      "Explore how authorized work might appear spatially while underway.",
    );

    await showroom.getByRole("button", { name: "Exit preview" }).click();
    await expect(showroom).toHaveCount(0);
  });

  test("keeps the showroom bounded and its escape action visible on a compact viewport", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    const showroom = await openForgeworksShowroom(page);

    await expect(showroom.getByRole("button", { name: "Exit preview" })).toBeVisible();
    await expect(showroom.getByRole("tab", { name: "Inspector" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      390,
    );
  });
});
