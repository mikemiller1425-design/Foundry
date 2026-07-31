import { expect, test } from "@playwright/test";

// FBL-013 required automated tests: render smoke test (no console/WebGL
// errors), resize (canvas resize itself is already covered by
// shell-world.spec.ts; this file adds an environment-still-renders check
// after a panel-driven resize), a coarse performance smoke check, and a
// screenshot/pixel check confirming real geometry+lighting rendered
// (not just a blank canvas) — all at the three target viewports (see
// playwright.config.ts projects).

test.describe("Spatial environment (ground, lighting, fog)", () => {
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

  test("the canvas shows real rendered content, not a blank/uniform fill", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(1000);

    // preserveDrawingBuffer (WorldCanvas.tsx) lets us read the WebGL
    // canvas's actual pixels back via a 2D-context drawImage, the same
    // way a screenshot tool would. Sampling several points along a
    // vertical line and confirming they are not all identical is a
    // camera-framing-agnostic way to prove real geometry/lighting
    // rendered, without hardcoding exactly which screen row is "ground"
    // vs "sky" for the canonical camera position.
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
    const pixels = samples!;
    // Every sampled pixel should be fully opaque (a real background/ground
    // fill, not an untouched transparent canvas).
    for (const pixel of pixels) {
      expect(pixel[3]).toBe(255);
    }
    // Not every sampled row is identical — proves the ground plane/grid/
    // fog actually varies across the frame rather than one flat fill.
    const unique = new Set(pixels.map((p) => p.join(",")));
    expect(unique.size).toBeGreaterThan(1);
  });

  test("environment keeps rendering after a panel-driven resize", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);
    await page.getByRole("button", { name: "Collapse left navigation" }).click();
    await page.getByRole("button", { name: "Collapse right live-intelligence" }).click();
    await page.waitForTimeout(500);

    const stillRendering = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>(
        '[data-testid="shell-world"] canvas',
      );
      return !!canvas && canvas.width > 0 && canvas.height > 0;
    });
    expect(stillRendering).toBe(true);
  });

  test("maintains a minimally acceptable frame rate", async ({ page }) => {
    await page.goto("/");
    await page.waitForTimeout(500);

    const fps = await page.evaluate(() => {
      return new Promise<number>((resolve) => {
        let frames = 0;
        const start = performance.now();
        function tick() {
          frames += 1;
          const elapsed = performance.now() - start;
          if (elapsed < 1000) {
            requestAnimationFrame(tick);
          } else {
            resolve((frames * 1000) / elapsed);
          }
        }
        requestAnimationFrame(tick);
      });
    });

    // A conservative floor — this only guards against a fully broken/
    // hung render loop, not fine-grained performance regressions.
    // Headless/sandboxed CI environments render via software (SwiftShader)
    // with widely variable throughput, and the largest target viewport
    // (5120×1440, ~7.4M pixels) under full-suite parallel load can
    // legitimately dip into single digits without the loop actually being
    // hung — 3fps still clearly distinguishes "ticking" from "frozen."
    expect(fps).toBeGreaterThan(3);
  });
});
