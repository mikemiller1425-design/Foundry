import { expect, test } from "@playwright/test";
import { pauseDemoForStableFeed } from "./stable-state";

/**
 * FBL-033 — accessibility and reduced motion, across the completed app.
 *
 * The earlier rungs each checked their own surface. This is the
 * cross-cutting pass the ladder calls for: it exercises the *whole*
 * application after every feature exists, which is the only way to catch
 * a focus order or labelling regression that a later rung introduced
 * into an earlier rung's component.
 *
 * Waits here are on **stable state** — a control being enabled, a region
 * being present — never on elapsed time. A timing-based accessibility
 * test tells you the app was slow, not that it was reachable.
 */

/**
 * Advances focus and returns a stable description of what now has it.
 *
 * The sibling index matters. Timeline rows all share one `data-testid`
 * and carry no `aria-label`, so without it eight consecutive *distinct*
 * rows describe identically — and the no-trap check below, which looks
 * for a repeating suffix, reads that as focus being stuck. It fired only
 * at 5120×1440, because only there is the feed tall enough that a 60-key
 * walk is still inside the row list at the end. That was a defect in this
 * descriptor, not a keyboard trap in the application.
 *
 * The index is positional rather than content-derived on purpose: row text
 * changes as events arrive, and a descriptor that changed with it would
 * make the focus-order comparison below unstable for the opposite reason.
 */
async function focusedDescriptor(page: import("@playwright/test").Page): Promise<string> {
  return page.evaluate(() => {
    const el = document.activeElement;
    if (!el || el === document.body) return "<body>";
    const testId = el.getAttribute("data-testid");
    const label = el.getAttribute("aria-label");
    const siblingIndex = el.parentElement ? Array.from(el.parentElement.children).indexOf(el) : -1;
    return [
      el.tagName.toLowerCase(),
      testId && `#${testId}`,
      label && `[${label}]`,
      siblingIndex >= 0 && `@${siblingIndex}`,
    ]
      .filter(Boolean)
      .join("");
  });
}

test.describe("Accessibility — keyboard critical path (FBL-033)", () => {
  test("every critical control is reachable by Tab alone, with no keyboard trap", async ({
    page,
  }) => {
    await page.goto("/");
    // Wait on a stable landmark rather than a timer.
    await expect(page.getByTestId("shell-world")).toBeVisible();
    // Walk a feed that is at rest. Tabbing through a virtualized list
    // while rows are still mounting and unmounting can drop focus back to
    // the document — indistinguishable from a trap, and caused by the
    // test rather than by the interface.
    await pauseDemoForStableFeed(page);

    const seen: string[] = [];
    // A generous but bounded walk: enough to cycle the whole shell, small
    // enough that a trap shows up as a repeating suffix rather than a hang.
    for (let i = 0; i < 60; i += 1) {
      await page.keyboard.press("Tab");
      seen.push(await focusedDescriptor(page));
    }

    // A trap would mean the last many entries are all the same element.
    const tail = seen.slice(-8);
    expect(new Set(tail).size).toBeGreaterThan(1);

    // Focus genuinely moved through multiple distinct controls.
    expect(new Set(seen).size).toBeGreaterThan(4);
  });

  test("focus order is stable across repeated traversals", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("shell-world")).toBeVisible();
    await pauseDemoForStableFeed(page);

    const walk = async () => {
      const order: string[] = [];
      for (let i = 0; i < 12; i += 1) {
        await page.keyboard.press("Tab");
        order.push(await focusedDescriptor(page));
      }
      return order;
    };

    const first = await walk();

    // Reload to reset focus to the document start. `blur()` alone only
    // drops focus — the next Tab resumes from where the previous walk
    // ended, which would compare two different slices of the order
    // rather than the same one twice.
    await page.reload();
    await expect(page.getByTestId("shell-world")).toBeVisible();
    await pauseDemoForStableFeed(page);
    const second = await walk();

    // Order must be deterministic: an unstable order makes the interface
    // unlearnable for anyone navigating by keyboard.
    expect(second).toEqual(first);
  });

  test("the focused control always shows a visible focus indicator", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("shell-world")).toBeVisible();
    await pauseDemoForStableFeed(page);

    for (let i = 0; i < 12; i += 1) {
      await page.keyboard.press("Tab");
      const hasIndicator = await page.evaluate(() => {
        const el = document.activeElement as HTMLElement | null;
        if (!el || el === document.body) return true;
        // `next dev` injects its own devtools overlay (`<nextjs-portal>`)
        // into the tab order. It is not application UI, it does not exist
        // in the production build the operator runs, and it carries no
        // focus ring of its own — so asserting against it would be
        // reporting the dev server's accessibility, not Agent City's.
        if (el.tagName.toLowerCase() === "nextjs-portal") return true;
        const style = getComputedStyle(el);
        // Either a real outline, or a focus-visible class the design system uses.
        const outlined = style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0;
        const classed = el.className.toString().includes("focus-visible");
        return outlined || classed;
      });
      expect(hasIndicator).toBe(true);
    }
  });

  test("every canvas object has a navigator equivalent", async ({ page }) => {
    // v1-acceptance.md → Accessibility: "canvas objects have navigator
    // equivalents". The 3D world is not reachable by screen reader, so
    // the 2D navigator is the accessible path to the same objects.
    await page.goto("/");
    await expect(page.getByTestId("shell-world")).toBeVisible();

    const navigatorItems = page.getByTestId("building-list-item");
    await expect(navigatorItems.first()).toBeVisible();
    expect(await navigatorItems.count()).toBeGreaterThan(0);

    // The fixture concept layer added after FBL-033 has the same rule:
    // parcel borders are selectable in WebGL, and each one has a named 2D
    // atlas button for keyboard and assistive-technology access.
    const atlas = page.getByRole("region", { name: "Fixture world atlas" });
    await expect(atlas).toBeVisible();
    await expect(atlas.getByRole("button", { name: /Future Yard/ })).toBeVisible();
  });

  test("operational snapshot modes are keyboard operable and disclose evidence limits", async ({
    page,
  }) => {
    await page.goto("/");
    await expect(page.getByTestId("shell-world")).toBeVisible();

    const snapshot = page.getByRole("region", { name: "Operational snapshot" });
    const evidence = snapshot.getByRole("button", { name: "evidence", exact: true });
    await evidence.focus();
    await page.keyboard.press("Enter");
    await expect(snapshot.getByText(/contents are not inspected or verified here/i)).toBeVisible();
  });

  test("mandatory regions expose semantic structure", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("shell-world")).toBeVisible();

    // Landmarks, not a flat div soup.
    expect(await page.locator("main, [role=main]").count()).toBeGreaterThan(0);
    expect(await page.locator("[aria-label], [aria-labelledby]").count()).toBeGreaterThan(3);
  });
});

test.describe("Reduced motion (FBL-033)", () => {
  // `reducedMotion` is a *context* option, so it is applied per test via
  // `page.emulateMedia` rather than `test.use` — the latter only accepts
  // it at the project level, which typecheck correctly rejects here.
  test.beforeEach(async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
  });

  test("the primary journey communicates the same operational meaning", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("shell-world")).toBeVisible();

    // The textual equivalents must still update — reduced motion removes
    // the flourish, never the meaning (principle 24). Waits are on the
    // state itself, never on elapsed time.
    await expect(page.getByTestId("timeline-row").first()).toBeVisible();
    await expect(page.getByTestId("command-feedback")).not.toBeEmpty();

    // The Lighthouse's textual state remains readable throughout.
    await expect(page.getByTestId("lighthouse-status")).not.toBeEmpty();
  });

  test("status remains readable without motion cues", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByTestId("shell-world")).toBeVisible();

    // Every status surface still carries text with reduced motion on.
    await expect(page.getByTestId("lighthouse-status")).not.toBeEmpty();
    const rows = page.getByTestId("timeline-row");
    if ((await rows.count()) > 0) {
      await expect(rows.first()).not.toBeEmpty();
    }
    await expect(page.getByRole("region", { name: "Agent life" })).toContainText(
      /not autonomous simulation or precise location/i,
    );
  });
});
