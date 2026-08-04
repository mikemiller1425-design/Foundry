"use client";

import { useRuntime } from "@/lib/mock-runtime";
import { useState } from "react";

// docs/02-specification/event-model.md § "Demo control commands" —
// the exhaustive, closed set. Buttons (not a free-text/NL input) so the
// bounded set is enforced by construction, not by parsing user text
// (interface-model.md "Prohibit: unrestricted natural-language ... shell
// execution").
const SPEED_OPTIONS = [1, 2, 4] as const;

/**
 * Demo playback controls, and their disposition in backend mode (AC-106).
 *
 * These six `demo.*` commands are the exhaustive V1 command set for the
 * bottom strip (`interface-model.md` § "Persistent command input"). They
 * control the **deterministic mock runtime** — its playback cursor, its
 * speed, its replay. They are not domain commands, and `COMMAND_TYPES`,
 * transcribed from `domain-model.md`, contains none of them.
 *
 * **Disposition: disabled in backend mode, with the reason stated.**
 *
 * The alternative the rung allowed — backing them with a declared command
 * — was rejected on the merits, not just because adding a `demo.*` type
 * without a specification amendment is prohibited work. In backend mode
 * there is no recording to start, pause, or replay: the world advances
 * from real backend events. A "Pause" that did something would have to
 * invent a meaning the domain does not have.
 *
 * Until this rung they were *enabled* and posted an unknown command type
 * on every press, which the backend answered `400` — and which the
 * frontend, before `AC-103P`, discarded silently (PV1-012). Now the
 * control is unavailable and says why, which is the honest version of the
 * same fact.
 *
 * Mock mode is untouched: every control behaves exactly as it did at V1.
 */
export function CommandBar() {
  const { runtimeMode, submitCommand, isRunning, isComplete, lastRejection, mutationsEnabled } =
    useRuntime();
  const [speed, setSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(1);

  const isBackend = runtimeMode === "backend";

  function send(commandType: string, params: Record<string, unknown> = {}) {
    // Guarded here as well as by `disabled`, so "no unknown command type is
    // ever posted in backend mode" holds by construction rather than by
    // the attribute alone. A disabled `<select>` still dispatches `change`
    // when driven programmatically, which is exactly how this was caught.
    if (isBackend) return;
    submitCommand({ commandType, params });
  }

  const unavailableReason = isBackend
    ? "Demo playback controls the deterministic mock runtime. In backend mode the world advances from real backend events, so there is nothing to start, pause, or replay."
    : null;

  // Disabled for a *stated* reason in backend mode; otherwise the original
  // V1 enablement rules, unchanged.
  const disabled = (extra: boolean) => isBackend || !mutationsEnabled || extra;

  return (
    <div className="flex w-full items-center gap-2">
      <div
        className="flex items-center gap-1"
        role="group"
        aria-label="Demo playback commands"
        aria-describedby={unavailableReason ? "demo-controls-unavailable" : undefined}
        data-testid="demo-controls"
        data-available={isBackend ? "false" : "true"}
      >
        <button
          type="button"
          onClick={() => send("demo.start")}
          disabled={disabled(isRunning || isComplete)}
          className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        >
          Start
        </button>
        <button
          type="button"
          onClick={() => send("demo.pause")}
          disabled={disabled(!isRunning)}
          className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        >
          Pause
        </button>
        <button
          type="button"
          onClick={() => send("demo.resume")}
          disabled={disabled(isRunning || isComplete)}
          className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        >
          Resume
        </button>
        <label htmlFor="demo-speed" className="sr-only">
          Playback speed
        </label>
        <select
          id="demo-speed"
          value={speed}
          disabled={disabled(false)}
          onChange={(e) => {
            const multiplier = Number(e.target.value) as (typeof SPEED_OPTIONS)[number];
            setSpeed(multiplier);
            send("demo.set_speed", { multiplier });
          }}
          className="rounded border border-neutral-700 bg-neutral-900 px-1 py-1 text-xs disabled:cursor-not-allowed disabled:opacity-40"
        >
          {SPEED_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m}×
            </option>
          ))}
        </select>
        <button
          type="button"
          onClick={() => send("demo.reset")}
          disabled={disabled(false)}
          className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => send("demo.replay")}
          disabled={disabled(false)}
          className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        >
          Replay
        </button>
      </div>

      {/* Rendered as text, not a tooltip: a greyed-out control that
          explains itself only on hover is unavailable to keyboard and
          screen-reader users, and the explanation is the whole point. */}
      {unavailableReason && (
        <span
          id="demo-controls-unavailable"
          data-testid="demo-controls-unavailable"
          className="max-w-md text-[11px] text-neutral-400"
        >
          {unavailableReason}
        </span>
      )}

      <CommandStatus
        failure={lastRejection}
        idle={
          isBackend
            ? mutationsEnabled
              ? "Backend mode — live"
              : "Backend mode — disconnected"
            : isComplete
              ? "Demo complete"
              : isRunning
                ? "Running"
                : "Paused"
        }
      />
    </div>
  );
}

/**
 * The persistent outcome line (F-105, F-106).
 *
 * Shows the category, the backend's own reason, and the next corrective
 * action. It does **not** clear itself on a timer: the previous version
 * wiped the message after four seconds, which meant the record of a
 * refusal outlived the operator's chance to read it by exactly as long as
 * they happened to be looking elsewhere. A failure stays until the next
 * command replaces it.
 */
function CommandStatus({ failure, idle }: { failure: RuntimeFailure; idle: string }) {
  return (
    <span
      role="status"
      aria-live="polite"
      data-testid="command-feedback"
      data-failure-kind={failure?.kind ?? "none"}
      className={`ml-auto max-w-2xl text-right text-xs ${failure ? "text-red-400" : "text-neutral-500"}`}
    >
      {failure ? (
        <>
          <span className="font-medium">{failure.title}</span>
          {" — "}
          <span data-testid="command-feedback-reason">{failure.reason}</span>{" "}
          <span data-testid="command-feedback-action" className="text-neutral-400">
            {failure.action}
          </span>
        </>
      ) : (
        idle
      )}
    </span>
  );
}

type RuntimeFailure = ReturnType<typeof useRuntime>["lastRejection"];
