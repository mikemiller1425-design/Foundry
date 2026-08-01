import { expect, test } from "@playwright/test";
import { stableProjectedPosition } from "./stable-state";

// FBL-014 required automated tests: every state maps correctly and is
// visually/textually distinguishable (not color-only — verified at the
// unit level in lighthouseVisuals.test.ts against the declarative
// state→visual table Lighthouse.tsx actually renders from; this file
// verifies the real runtime drives the textual label through a real state
// lifecycle, and that the Lighthouse itself — not just the environment —
// is what's rendered, via a targeted marker+pixel check), reduced-motion
// behavior, no duplicate object creation (also unit-tested in
// worldStateReducer.test.ts), target resolutions, no console/WebGL
// errors, and that existing 2D functionality (approval card, command bar,
// timeline) remains green — see playwright.config.ts projects for the
// three target viewports.

test.describe("Lighthouse", () => {
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

  test("the Lighthouse status is present, accessible as text, and starts healthy", async ({
    page,
  }) => {
    await page.goto("/");
    const status = page.getByTestId("lighthouse-status");
    await expect(status).toBeVisible();
    await expect(status).toHaveText(/Healthy/);
  });

  test("the Lighthouse's textual status reflects real runtime state through a full run", async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.goto("/");
    await page.selectOption("#demo-speed", "4");
    const status = page.getByTestId("lighthouse-status");

    // Healthy (no build yet) -> Active (build running) -> Attention
    // required (the one pending Approval) -> Healthy again once the
    // build completes and no approval remains pending. Each transition
    // is driven entirely by real mock-runtime events, not a UI toggle.
    await expect(status).toHaveText(/Active/, { timeout: 15000 });
    await expect(status).toHaveText(/Attention required/, { timeout: 30000 });

    await page.getByTestId("approval-card").getByRole("button", { name: "Approve" }).click();
    await expect(status).not.toHaveText(/Attention required/);
  });

  test("the canvas shows real rendered content (ground and Lighthouse), not a blank fill", async ({
    page,
  }) => {
    await page.goto("/");
    await page.waitForTimeout(1000);

    const samples = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[data-testid="shell-world"] canvas',
      );
      if (!canvas) return null;
      const off = document.createElement("canvas");
      off.width = canvas.width;
      off.height = canvas.height;
      const ctx = off.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(canvas, 0, 0);
      const points = [0.1, 0.3, 0.5, 0.7, 0.9].map((f) => Math.floor(canvas.height * f));
      return points.map((y) =>
        Array.from(ctx.getImageData(Math.floor(canvas.width / 2), y, 1, 1).data),
      );
    });

    expect(samples).not.toBeNull();
    const unique = new Set(samples!.map((p) => p.join(",")));
    expect(unique.size).toBeGreaterThan(1);
  });

  test("the Lighthouse specifically is mounted and rendered at its own reported screen position", async ({
    page,
  }) => {
    await page.goto("/");

    // LighthouseSceneObject (inside the canvas) projects the beacon's
    // world position to screen percentages every frame and writes them
    // into a shared ref; LighthouseMarker (outside the canvas) polls that
    // ref into this accessible marker element. If LighthouseSceneObject
    // were removed, nothing would ever write to the ref again and
    // data-visible could never become "true" — unlike sampling arbitrary
    // canvas pixels, this specifically fails if the Lighthouse is gone.
    const marker = page.getByTestId("lighthouse-marker");
    await expect(marker).toHaveAttribute("data-visible", "true", { timeout: 15000 });
    const state = await marker.getAttribute("data-state");
    expect(state).toBe("healthy");

    // FBL-034 (reopened) — the same camera-settling moving-target race
    // repaired in shell-selection.spec.ts. This test reads the beacon's
    // projected position once and then samples that pixel; if the camera
    // is still easing, it samples empty sky. It surfaced under the 12-core
    // contention run, where settling takes longest.
    const { xPercent, yPercent } = await stableProjectedPosition(marker);
    expect(Number.isFinite(xPercent)).toBe(true);
    expect(Number.isFinite(yPercent)).toBe(true);

    // The beacon rotates and pulses, so a single-instant sample reads
    // whatever phase the animation happened to be in — bright on one run,
    // dim on the next, with nothing about the application having changed.
    // Sampling across a window and keeping the brightest reading removes
    // the phase dependence: over a full cycle the beacon *must* light up,
    // and if the Lighthouse were missing no sample would ever be bright.
    const brightest = await page.evaluate(
      ({ xPercent, yPercent }) => {
        const canvas = document.querySelector<HTMLCanvasElement>(
          '[data-testid="shell-world"] canvas',
        );
        if (!canvas) return null;
        const off = document.createElement("canvas");
        off.width = canvas.width;
        off.height = canvas.height;
        const ctx = off.getContext("2d");
        if (!ctx) return null;
        const px = Math.min(
          canvas.width - 1,
          Math.max(0, Math.round((xPercent / 100) * canvas.width)),
        );
        const py = Math.min(
          canvas.height - 1,
          Math.max(0, Math.round((yPercent / 100) * canvas.height)),
        );

        return new Promise<number>((resolve) => {
          let best = 0;
          let framesLeft = 150;
          const sample = () => {
            ctx.drawImage(canvas, 0, 0);
            const [r = 0, g = 0, b = 0] = Array.from(ctx.getImageData(px, py, 1, 1).data);
            best = Math.max(best, r, g, b);
            framesLeft -= 1;
            if (framesLeft > 0) requestAnimationFrame(sample);
            else resolve(best);
          };
          requestAnimationFrame(sample);
        });
      },
      { xPercent, yPercent },
    );

    expect(brightest).not.toBeNull();
    // The healthy beacon (#f5f5f5, emissive) is much brighter than the
    // dark background (#151a24) or ground (#333c52) — a bright pixel at
    // the Lighthouse's own reported location is strong, targeted evidence
    // that the Lighthouse itself, not just the environment, is what's
    // rendered there.
    expect(brightest!).toBeGreaterThan(150);
  });

  test("reduced motion: the Lighthouse still renders and its status still updates", async ({
    page,
  }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.selectOption("#demo-speed", "4");
    await expect(page.getByTestId("lighthouse-status")).toHaveText(/Active/, { timeout: 15000 });
  });

  test("existing 2D functionality (command bar, approval workflow) remains unaffected", async ({
    page,
  }) => {
    test.setTimeout(45000);
    await page.goto("/");
    await expect(page.getByTestId("command-feedback")).toHaveText("Running");
    await page.selectOption("#demo-speed", "4");
    await expect(page.getByTestId("approval-card")).toBeVisible({ timeout: 30000 });
    await page.getByTestId("approval-card").getByRole("button", { name: "Approve" }).click();
    await expect(page.getByTestId("approval-card")).not.toBeVisible();
  });
});
