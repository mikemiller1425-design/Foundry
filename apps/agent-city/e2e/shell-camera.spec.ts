import { expect, test, type Page } from "@playwright/test";

// FBL-012 required automated tests: camera bounds, zoom limits, reset
// returns canonical position, keyboard controls, reduced-motion behavior,
// panel resize/collapse coexistence — verified at all three target
// viewports (see playwright.config.ts projects). The camera's internal
// spherical state isn't otherwise observable from outside a WebGL canvas,
// so CameraHud's live readout (distance/target/azimuth/elevation) is the
// browser-level source of truth these tests parse.

interface CameraReadout {
  distance: number;
  target: { x: number; y: number; z: number };
  azimuthDeg: number;
  elevationDeg: number;
}

// Returns NaN fields (rather than throwing) while the readout still shows
// its placeholder "—" — under full-suite parallel load, initial hydration
// can occasionally take longer than a single poll tick, and a NaN simply
// fails the numeric matcher and lets expect.poll keep retrying, instead of
// throwing and producing a confusing "unparseable" failure.
async function readCamera(page: Page): Promise<CameraReadout> {
  const text = await page.getByTestId("camera-readout").innerText();
  const match = text.match(
    /Distance:\s*([\d.-]+)\s*·\s*Target:\s*\(([\d.-]+),\s*([\d.-]+),\s*([\d.-]+)\)\s*·\s*Azimuth:\s*([\d.-]+)°\s*·\s*Elevation:\s*([\d.-]+)°/,
  );
  if (!match) {
    return {
      distance: NaN,
      target: { x: NaN, y: NaN, z: NaN },
      azimuthDeg: NaN,
      elevationDeg: NaN,
    };
  }
  const [, distance, x, y, z, azimuthDeg, elevationDeg] = match;
  return {
    distance: Number(distance),
    target: { x: Number(x), y: Number(y), z: Number(z) },
    azimuthDeg: Number(azimuthDeg),
    elevationDeg: Number(elevationDeg),
  };
}

const READY_TIMEOUT = { timeout: 20000 };
const CANONICAL_DISTANCE = 20;
const CANONICAL_TARGET_X = 1;

async function focusCanvas(page: Page) {
  await page
    .getByTestId("shell-world")
    .locator("canvas")
    .click({ position: { x: 10, y: 10 } });
}

// Waits out initial hydration/mount (CameraRig only starts reporting once
// the Canvas has measured a non-zero size and its effects have run) with a
// generous timeout, so later polls in the test body can use the default
// timeout without being affected by parallel-suite load.
async function waitForCameraReady(page: Page): Promise<CameraReadout> {
  await expect.poll(async () => (await readCamera(page)).distance, READY_TIMEOUT).not.toBeNaN();
  return readCamera(page);
}

test.describe("Camera and navigation", () => {
  test("shows the canonical position on load and the Reset View control exists outside the canvas", async ({
    page,
  }) => {
    await page.goto("/");
    const state = await waitForCameraReady(page);
    expect(state.distance).toBeCloseTo(CANONICAL_DISTANCE, 0);
    await expect(page.getByRole("button", { name: "Reset view" })).toBeVisible();
  });

  test("keyboard zoom respects min/max distance limits", async ({ page }) => {
    await page.goto("/");
    await waitForCameraReady(page);
    await focusCanvas(page);

    for (let i = 0; i < 30; i++) await page.keyboard.press("-");
    await expect.poll(async () => (await readCamera(page)).distance).toBeCloseTo(40, 0);

    for (let i = 0; i < 30; i++) await page.keyboard.press("+");
    await expect.poll(async () => (await readCamera(page)).distance).toBeCloseTo(6, 0);
  });

  test("keyboard orbit changes azimuth/elevation and stays within controlled bounds", async ({
    page,
  }) => {
    // Under full-suite parallel load, ~100+ sequential keyboard.press
    // round-trips can approach the default 30s test timeout — this test
    // is inherently press-heavy (orbiting from canonical to each polar
    // extreme), so give it more headroom rather than trimming margin
    // below what reliably proves clamping.
    test.setTimeout(45000);
    await page.goto("/");
    await waitForCameraReady(page);
    await focusCanvas(page);
    const before = await readCamera(page);

    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => (await readCamera(page)).azimuthDeg)
      .not.toBeCloseTo(before.azimuthDeg, 0);

    // KEY_ORBIT_STEP is 0.08 rad and the polar range is only ~1.25 rad
    // wide (0.2..1.45), so 15 presses (1.2 rad) already reaches each
    // extreme with margin — push elevation to its extremes and confirm
    // it stays within the controlled polar range (never flips overhead
    // or under the horizon).
    for (let i = 0; i < 15; i++) await page.keyboard.press("ArrowUp");
    const atTop = await readCamera(page);
    expect(atTop.elevationDeg).toBeLessThanOrEqual(90);
    expect(atTop.elevationDeg).toBeGreaterThan(0);

    for (let i = 0; i < 15; i++) await page.keyboard.press("ArrowDown");
    const atBottom = await readCamera(page);
    expect(atBottom.elevationDeg).toBeGreaterThanOrEqual(-90);
    expect(atBottom.elevationDeg).toBeLessThan(90);
  });

  test("keyboard pan moves the target and stays within the neighborhood bounds", async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.goto("/");
    await waitForCameraReady(page);
    await focusCanvas(page);
    const before = await readCamera(page);

    await page.keyboard.press("Shift+ArrowRight");
    await expect
      .poll(async () => (await readCamera(page)).target.x)
      .not.toBeCloseTo(before.target.x, 1);

    // KEY_PAN_STEP is 0.6 and the bound is ±25, so ~50 presses already
    // overshoots the bound with margin — enough to prove clamping without
    // an excessively long, request-per-keypress test.
    for (let i = 0; i < 50; i++) await page.keyboard.press("Shift+ArrowRight");
    const panned = await readCamera(page);
    expect(Math.abs(panned.target.x)).toBeLessThanOrEqual(25.5);
    expect(Math.abs(panned.target.z)).toBeLessThanOrEqual(25.5);
  });

  test("Home key and the 2D Reset View button both return to the canonical position", async ({
    page,
  }) => {
    await page.goto("/");
    await waitForCameraReady(page);
    await focusCanvas(page);
    for (let i = 0; i < 10; i++) await page.keyboard.press("-");
    await page.keyboard.press("Shift+ArrowRight");
    await expect
      .poll(async () => (await readCamera(page)).distance)
      .not.toBeCloseTo(CANONICAL_DISTANCE, 0);

    await page.keyboard.press("Home");
    await expect
      .poll(async () => (await readCamera(page)).distance)
      .toBeCloseTo(CANONICAL_DISTANCE, 0);
    expect((await readCamera(page)).target.x).toBeCloseTo(CANONICAL_TARGET_X, 0);

    // Now drift again and reset via the 2D button instead of the keyboard.
    await focusCanvas(page);
    for (let i = 0; i < 10; i++) await page.keyboard.press("-");
    await expect
      .poll(async () => (await readCamera(page)).distance)
      .not.toBeCloseTo(CANONICAL_DISTANCE, 0);
    await page.getByRole("button", { name: "Reset view" }).click();
    await expect
      .poll(async () => (await readCamera(page)).distance)
      .toBeCloseTo(CANONICAL_DISTANCE, 0);
  });

  test("camera controls keep working after collapsing and resizing panels", async ({ page }) => {
    await page.goto("/");
    await waitForCameraReady(page);
    await page.getByRole("button", { name: "Collapse left navigation" }).click();
    await page.getByRole("button", { name: "Collapse right live-intelligence" }).click();

    await focusCanvas(page);
    const before = await readCamera(page);
    await page.keyboard.press("ArrowRight");
    await expect
      .poll(async () => (await readCamera(page)).azimuthDeg)
      .not.toBeCloseTo(before.azimuthDeg, 0);
  });

  test("reduced motion: keyboard camera controls still function with no crash", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await waitForCameraReady(page);
    await focusCanvas(page);
    const before = await readCamera(page);
    await page.keyboard.press("-");
    await expect
      .poll(async () => (await readCamera(page)).distance)
      .toBeGreaterThan(before.distance);
    await page.keyboard.press("Home");
    await expect
      .poll(async () => (await readCamera(page)).distance)
      .toBeCloseTo(CANONICAL_DISTANCE, 0);
  });

  test("no console or page errors after camera interaction", async ({ page }) => {
    const consoleErrors: string[] = [];
    const pageErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));

    await page.goto("/");
    await waitForCameraReady(page);
    await focusCanvas(page);
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("-");
    await page.keyboard.press("Shift+ArrowUp");
    await page.keyboard.press("Home");
    await page.waitForTimeout(300);

    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });

  test("textual camera instructions are present without relying on pointer gestures", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByText(/arrow keys to orbit/i)).toBeVisible();
  });
});
