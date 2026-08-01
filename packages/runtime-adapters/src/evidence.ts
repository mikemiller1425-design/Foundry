import type { Redactor } from "./redaction";
import type { CommandExecutionRecord, RunEvidence } from "./types";

/**
 * Evidence retention.
 *
 * Evidence is deep-frozen before it leaves this module. An `AgentRun`'s
 * evidence is a record of what happened; if a later caller could edit
 * it, it would be a record of what someone last said happened
 * (principle 18: events are immutable facts).
 *
 * Size is bounded, but bounding is done by *dropping command output*
 * rather than by refusing to retain evidence. An oversized run must
 * still leave an inspectable trace — the alternative is that the
 * noisiest runs, which are usually the interesting ones, are the ones
 * that vanish.
 */

export function serializedSize(value: unknown): number {
  return Buffer.byteLength(JSON.stringify(value) ?? "", "utf8");
}

export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value as Record<string, unknown>)) {
      deepFreeze(child);
    }
  }
  return value;
}

/**
 * Redacts, size-bounds, and freezes an evidence record.
 *
 * Redaction happens here — once, on the whole record — rather than at
 * each field's construction site, so a field added later cannot be
 * accidentally exempt.
 */
export function finalizeEvidence(
  draft: Omit<RunEvidence, "truncated" | "sizeBytes">,
  redactor: Redactor,
  maxEvidenceBytes: number,
): RunEvidence {
  const redacted = redactor.redactDeep(draft);

  let commands = redacted.commands as CommandExecutionRecord[];
  let truncated = false;

  const withMeta = (
    nextCommands: readonly CommandExecutionRecord[],
    isTruncated: boolean,
  ): RunEvidence => ({
    ...redacted,
    commands: nextCommands,
    truncated: isTruncated,
    sizeBytes: 0,
  });

  if (serializedSize(withMeta(commands, false)) > maxEvidenceBytes) {
    truncated = true;
    // Drop the bulky part (captured output) but keep every command's
    // identity, exit status, timing, and any denial — the facts an
    // operator needs to reconstruct what ran stay intact.
    commands = commands.map((command) => ({
      ...command,
      output: {
        stdout: "",
        stderr: "",
        stdoutTruncated: true,
        stderrTruncated: true,
        stdoutBytes: command.output.stdoutBytes,
        stderrBytes: command.output.stderrBytes,
      },
    }));
  }

  const result = withMeta(commands, truncated);
  return deepFreeze({ ...result, sizeBytes: serializedSize(result) });
}
