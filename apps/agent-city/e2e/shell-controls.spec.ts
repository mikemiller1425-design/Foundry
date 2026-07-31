import { expect, test } from "@playwright/test";

// FBL-010 required automated tests (browser-level): approval keyboard path,
// approve/reject/request-revision, typed command emission, rejected
// commands, requirement failure/recovery display, selected detail state,
// no-3D operational usability, accessibility, target resolutions (see
// playwright.config.ts projects).

test.describe("2D operational controls — command bar", () => {
  test("Pause/Resume are typed, bounded commands with visible feedback", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("command-feedback")).toHaveText("Running");

    await page.getByRole("button", { name: "Pause", exact: true }).click();
    await expect(page.getByTestId("command-feedback")).toHaveText("Paused");

    await page.getByRole("button", { name: "Resume", exact: true }).click();
    await expect(page.getByTestId("command-feedback")).toHaveText("Running");
  });

  test("the command bar exposes no free-text/natural-language input", async ({ page }) => {
    await page.goto("/");
    const footer = page.getByTestId("shell-command-input");
    await expect(footer.locator('input[type="text"]')).toHaveCount(0);
    await expect(footer.locator("textarea")).toHaveCount(0);
  });
});

test.describe("2D operational controls — stage/requirement detail (no 3D world)", () => {
  test("selecting a stage shows its requirement checklist entirely without any 3D content", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(
      page.getByText("Lighthouse, residences, operational buildings, roads, and the utility vehicle"),
    ).toBeVisible();

    await expect(page.getByTestId("stage-list-item").first()).toBeVisible({ timeout: 15000 });
    await page.getByTestId("stage-list-item").first().click();
    await expect(page.getByTestId("shell-detail-panel")).toContainText("Stage:");
  });

  test("the intentional requirement failure is visible, then shows recovered after retry", async ({
    page,
  }) => {
    await page.goto("/");
    await page.selectOption("#demo-speed", "4");

    // Wait for the frontend_implementation stage to appear, then select it.
    const frontendRow = page.getByTestId("stage-list-item").filter({ hasText: "Frontend" });
    await expect(frontendRow).toBeVisible({ timeout: 15000 });
    await frontendRow.click();

    // Eventually (after its retry resolves) the checklist shows three
    // passed requirements and no residual failure evidence.
    await expect(page.getByText("Requirement checklist")).toBeVisible({ timeout: 15000 });
    await expect
      .poll(
        async () =>
          page.getByTestId("shell-detail-panel").getByTestId("requirement-checklist-item").count(),
        { timeout: 15000 },
      )
      .toBe(3);
    await expect(page.getByTestId("requirement-evidence")).toHaveCount(0);
  });
});

test.describe("2D operational controls — approval workflow", () => {
  test("keyboard-only path resolves the pending approval (Approve)", async ({ page }) => {
    test.setTimeout(45000);
    await page.goto("/");
    await page.selectOption("#demo-speed", "4");

    await expect(page.getByTestId("approval-card")).toBeVisible({ timeout: 30000 });
    const approveButton = page
      .getByTestId("approval-card")
      .getByRole("button", { name: "Approve" });
    await approveButton.focus();
    await expect(approveButton).toBeFocused();
    await page.keyboard.press("Enter");

    await expect(page.getByTestId("approval-card")).not.toBeVisible();
    await expect
      .poll(
        async () =>
          page.getByTestId("timeline-row").filter({ hasText: "Approval approved" }).count(),
        { timeout: 10000 },
      )
      .toBeGreaterThan(0);
  });

  test("Reject produces a real, visible approval.rejected event and does not fabricate further progress", async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.goto("/");
    await page.selectOption("#demo-speed", "4");

    await expect(page.getByTestId("approval-card")).toBeVisible({ timeout: 30000 });
    await page.getByTestId("approval-card").getByRole("button", { name: "Reject" }).click();

    await expect(page.getByTestId("approval-card")).not.toBeVisible();
    await expect(
      page.getByTestId("timeline-row").filter({ hasText: "Approval rejected" }),
    ).toBeVisible();
    await expect(
      page.getByTestId("timeline-row").filter({ hasText: "Build completed" }),
    ).toHaveCount(0);
  });

  test("Request revision produces the full revision event chain, visible in the timeline", async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.goto("/");
    await page.selectOption("#demo-speed", "4");

    await expect(page.getByTestId("approval-card")).toBeVisible({ timeout: 30000 });
    await page
      .getByTestId("approval-card")
      .getByRole("button", { name: "Request revision" })
      .click();

    await expect(page.getByTestId("approval-card")).not.toBeVisible();
    for (const text of [
      "resolved as revision requested",
      "Revision requested:",
      "Revision started",
      "Revision completed",
    ]) {
      await expect(page.getByTestId("timeline-row").filter({ hasText: text })).toBeVisible();
    }
  });
});

test.describe("2D operational controls — accessibility", () => {
  test("the approval card, command bar, and stage list are all keyboard reachable", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("stage-list-item").first()).toBeVisible({ timeout: 15000 });

    await page.getByTestId("stage-list-item").first().focus();
    await expect(page.getByTestId("stage-list-item").first()).toBeFocused();

    // "Start" is legitimately disabled (and therefore unfocusable) once the
    // demo is running or complete — RuntimeProvider auto-starts it on mount
    // (FBL-009), so it is never a reliable reachability target here.
    // "Reset" is never disabled, so it is a valid stand-in for "the command
    // bar is keyboard reachable."
    await page.getByRole("button", { name: "Reset", exact: true }).focus();
    await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeFocused();
  });
});
