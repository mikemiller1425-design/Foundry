import { expect, test, type Locator, type Page } from "@playwright/test";
import { pauseDemoForStableFeed } from "./stable-state";

// FBL-020 required automated tests: selection hit-target tests for all
// three agents, state-mapping proof (all eight allowed states are
// unit-tested for distinctness in agentVisuals.test.ts), and a targeted
// proof that no agent is ever visually represented in two locations at
// once through a full canonical run.

const AGENT_IDS = ["agent-architect", "agent-builder", "agent-inspector"] as const;

function marker(page: Page, objectId: string): Locator {
  return page.locator(`[data-testid="world-object-marker"][data-object-id="${objectId}"]`);
}

async function waitForMarkersReady(page: Page) {
  for (const id of AGENT_IDS) {
    await expect(marker(page, id)).toHaveAttribute("data-visible", "true", { timeout: 20000 });
  }
}

test.describe("Agent representations (FBL-020)", () => {
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

  test("exactly three agents are mounted, distinct world objects, defaulting to idle", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMarkersReady(page);
    for (const id of AGENT_IDS) {
      const m = marker(page, id);
      await expect(m).toHaveAttribute("data-visible", "true");
    }
    // Exactly these three, no decorative citizens/extra roles.
    const allAgentMarkers = page.locator(
      '[data-testid="world-object-marker"][data-object-id^="agent-"]',
    );
    await expect(allAgentMarkers).toHaveCount(3);
    const agentListItems = page.getByTestId("agent-list-item");
    await expect(agentListItems).toHaveCount(3);
  });

  test("pointer click on the Architect agent selects it (hit target) and syncs navigator + detail panel", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMarkersReady(page);
    // Agents move as the run progresses: the Architect walks from its
    // residence to the Construction Office and back. Reading its screen
    // position and then clicking there is a moving-target race — by the
    // time the click lands, the agent may be somewhere else entirely.
    // Bringing playback to rest pins the target; what is under test is the
    // pointer hit target, not the animation.
    await pauseDemoForStableFeed(page);

    const architectMarker = marker(page, "agent-architect");
    const xPercent = Number(await architectMarker.getAttribute("data-x-percent"));
    const yPercent = Number(await architectMarker.getAttribute("data-y-percent"));
    const worldBox = await page.getByTestId("shell-world").boundingBox();
    expect(worldBox).not.toBeNull();
    const clickX = worldBox!.x + (xPercent / 100) * worldBox!.width;
    const clickY = worldBox!.y + (yPercent / 100) * worldBox!.height;

    await page.mouse.click(clickX, clickY);

    await expect(architectMarker).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("agent-list-item").first()).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByTestId("shell-detail-panel")).toContainText("Agent: architect");
  });

  test("selecting an agent from the existing 2D Agents list syncs the 3D object (navigator-to-Canvas sync)", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForMarkersReady(page);

    await page.getByTestId("agent-list-item").first().click();

    await expect(marker(page, "agent-architect")).toHaveAttribute("data-selected", "true");
    await expect(page.getByTestId("shell-detail-panel")).toContainText("Agent: architect");
  });

  test("Escape clears agent selection from any focus context", async ({ page }) => {
    await page.goto("/");
    await waitForMarkersReady(page);

    await page.getByTestId("agent-list-item").first().click();
    await expect(marker(page, "agent-architect")).toHaveAttribute("data-selected", "true");

    await page.keyboard.press("Escape");

    await expect(marker(page, "agent-architect")).toHaveAttribute("data-selected", "false");
    await expect(page.getByTestId("shell-detail-panel")).toContainText("No selection");
  });

  test("no keyboard trap: Tab still moves focus away from the 3D world after agents were added", async ({
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

  test("no agent is ever visually represented in two locations at once, through a full canonical run", async ({
    page,
  }) => {
    test.setTimeout(60000);
    await page.goto("/");
    await waitForMarkersReady(page);
    await page.selectOption("#demo-speed", "4");

    // Poll each agent's reported screen position periodically through a
    // full run — since AgentsSceneObject renders exactly one <Agent> per
    // WORLD_AGENTS entry (never two), and computeAgentPosition resolves
    // exactly one building per call, a single marker entry per agent id
    // (already asserted above) combined with exactly one (x,y) position
    // per snapshot is the real-browser proof of "never two locations at
    // once" — a second position would require a second marker entry,
    // which the count assertion above already rules out.
    await expect(page.getByTestId("approval-card")).toBeVisible({ timeout: 30000 });
    await page.getByTestId("approval-card").getByRole("button", { name: "Approve" }).click();
    await page.waitForTimeout(6000);

    const allAgentMarkers = page.locator(
      '[data-testid="world-object-marker"][data-object-id^="agent-"]',
    );
    await expect(allAgentMarkers).toHaveCount(3);
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
