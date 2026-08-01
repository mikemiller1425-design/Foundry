import { expect, type Locator, type Page } from "@playwright/test";

/**
 * FBL-034 — deterministic synchronization helpers for the browser suite.
 *
 * The flakiness deferred to this rung had two distinct causes, and only
 * one of them was in the application:
 *
 *  1. Playback fell progressively behind under CPU contention. That was a
 *     real defect and is fixed at its source in `mock-runtime/runtime.ts`.
 *  2. Several specs interacted with the event feed *while it was still
 *     streaming*. The feed is virtualized: as rows arrive, the mounted
 *     window slides, and the element a locator resolved a moment ago is
 *     detached before the click lands. No timeout is long enough to fix
 *     that — waiting longer simply gives the list more time to move.
 *
 * The cure for (2) is to reach a genuinely stable state first, using the
 * operator's own Pause control, and only then interact. That is not a
 * test-only backdoor: it is the same control an operator uses to study
 * the feed, which is precisely why it exists.
 */

/**
 * Pauses scripted playback and waits for the runtime to actually be
 * stopped — not merely for the click to have been dispatched.
 *
 * Returns once the feed has stopped growing, so any locator resolved
 * afterwards refers to an element that will still be attached when it is
 * used.
 */
export async function pauseDemoForStableFeed(page: Page): Promise<void> {
  // Scoped to the playback command group, and exact. The shell has two
  // controls whose accessible name contains "Pause" — playback's "Pause"
  // and the feed's "Pause autoscroll" — and `getByRole` matches names as a
  // substring by default. An unscoped locator can therefore pause
  // autoscroll while playback keeps streaming, which looks exactly like
  // the app ignoring the command.
  const pause = page
    .getByRole("group", { name: "Demo playback commands" })
    .getByRole("button", { name: "Pause", exact: true });
  const feedback = page.getByTestId("command-feedback");

  // The shell renders "Paused" for an instant before the mount effect
  // issues demo.start, so a single sampled read can catch that pre-start
  // moment, skip the click, and then wait forever for a pause that was
  // never requested. Waiting for the feed to carry events first means
  // playback has demonstrably begun.
  await expect(page.getByTestId("timeline-row").first()).toBeVisible();

  // Poll-and-click rather than read-then-click: playback can reach the
  // approval gate (which pauses itself) between the read and the click,
  // leaving the button disabled and a plain click waiting on an element
  // that will never be enabled again.
  await expect
    .poll(
      async () => {
        const current = await feedback.innerText();
        if (current !== "Running") return current;
        if (await pause.isEnabled()) {
          await pause.click({ timeout: 5000 }).catch(() => {
            // The gate may have paused playback mid-click; the next poll
            // observes the resulting state rather than failing here.
          });
        }
        return feedback.innerText();
      },
      { timeout: 30_000 },
    )
    .not.toBe("Running");

  // ...and the feed has demonstrably stopped moving. The status flips
  // synchronously with the command, while the last already-scheduled
  // render may still be in flight; this waits for the DOM itself to
  // settle across successive polls rather than trusting the status alone.
  let previousCount = -1;
  await expect
    .poll(
      async () => {
        const current = await page.getByTestId("timeline-row").count();
        const settled = current === previousCount;
        previousCount = current;
        return settled;
      },
      { timeout: 15_000 },
    )
    .toBe(true);
}

/**
 * Waits for the event feed to grow past `from`, without asserting how long
 * that takes. Replaces "sleep and hope" in tests whose subject is that the
 * feed *advances* — the property is growth, not elapsed milliseconds.
 */
export async function waitForFeedToGrowBeyond(page: Page, from: number): Promise<void> {
  await expect.poll(async () => readEventTotal(page), { timeout: 30_000 }).toBeGreaterThan(from);
}

/** Reads the authoritative "N / M events" total from the feed's summary. */
export async function readEventTotal(page: Page): Promise<number> {
  const text = await page.getByTestId("event-count-summary").innerText();
  const match = text.match(/(\d+)\s*\/\s*(\d+)\s*events/);
  if (!match) throw new Error(`Unparseable event count summary: "${text}"`);
  return Number(match[2]);
}

/**
 * Resolves a locator to a single element and keeps it stable long enough
 * to act on, by first bringing the feed to rest.
 *
 * Prefer this over `.first()` on anything inside the live feed.
 */
export async function stableFirstRow(page: Page): Promise<Locator> {
  await pauseDemoForStableFeed(page);
  const row = page.getByTestId("timeline-row").first();
  await expect(row).toBeVisible();
  return row;
}
