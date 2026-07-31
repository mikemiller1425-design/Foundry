"use client";

import { useRuntime } from "@/lib/mock-runtime";
import { useEffect, useState } from "react";

// docs/02-specification/event-model.md § "Demo control commands" —
// the exhaustive, closed set. Buttons (not a free-text/NL input) so the
// bounded set is enforced by construction, not by parsing user text
// (interface-model.md "Prohibit: unrestricted natural-language ... shell
// execution").
const SPEED_OPTIONS = [1, 2, 4] as const;

export function CommandBar() {
  const { submitCommand, isRunning, isComplete, lastRejection } = useRuntime();
  const [speed, setSpeed] = useState<(typeof SPEED_OPTIONS)[number]>(1);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (!lastRejection) return;
    setFeedback(`Rejected: ${lastRejection.commandType} — ${lastRejection.reason}`);
    const timer = setTimeout(() => setFeedback(null), 4000);
    return () => clearTimeout(timer);
  }, [lastRejection]);

  function send(commandType: string, params: Record<string, unknown> = {}) {
    submitCommand({ commandType, params });
  }

  return (
    <div className="flex w-full items-center gap-2">
      <div className="flex items-center gap-1" role="group" aria-label="Demo playback commands">
        <button
          type="button"
          onClick={() => send("demo.start")}
          disabled={isRunning || isComplete}
          className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        >
          Start
        </button>
        <button
          type="button"
          onClick={() => send("demo.pause")}
          disabled={!isRunning}
          className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-900 disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        >
          Pause
        </button>
        <button
          type="button"
          onClick={() => send("demo.resume")}
          disabled={isRunning || isComplete}
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
          onChange={(e) => {
            const multiplier = Number(e.target.value) as (typeof SPEED_OPTIONS)[number];
            setSpeed(multiplier);
            send("demo.set_speed", { multiplier });
          }}
          className="rounded border border-neutral-700 bg-neutral-900 px-1 py-1 text-xs"
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
          className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        >
          Reset
        </button>
        <button
          type="button"
          onClick={() => send("demo.replay")}
          className="rounded border border-neutral-700 px-2 py-1 text-xs hover:bg-neutral-900 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
        >
          Replay
        </button>
      </div>
      <span
        role="status"
        aria-live="polite"
        data-testid="command-feedback"
        className={`ml-auto text-xs ${feedback ? "text-red-400" : "text-neutral-500"}`}
      >
        {feedback ?? (isComplete ? "Demo complete" : isRunning ? "Running" : "Paused")}
      </span>
    </div>
  );
}
