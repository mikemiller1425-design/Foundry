import type { ConnectionStatus, WorldState } from "@foundry/contracts";
import type { FoundryEvent } from "@foundry/event-types";

/**
 * Provider-neutral identity for the authority currently driving the world.
 *
 * Fixture playback and a live backend can produce the same canonical event
 * envelopes, so visual components must not guess their source from event
 * content or connection state. This explicit discriminator is the stable
 * read-side seam the future backend connects to.
 */
export type RuntimeSource =
  | {
      kind: "fixture";
      fixtureId: string;
      label: string;
      authority: "fixture";
    }
  | {
      kind: "backend";
      label: string;
      authority: "backend";
    };

export type ProjectionStatus = "current" | "stale" | "unavailable";

/**
 * The complete read model required by the Foundry world. Providers may add
 * optional operator capabilities, but scene and projection code consumes only
 * this contract and therefore remains transport-independent.
 */
export interface RuntimeReadAdapter {
  runtimeMode?: "mock" | "backend";
  /** Optional only for legacy hand-built test contexts. Real providers set it. */
  runtimeSource?: RuntimeSource;
  /** Optional only for legacy test contexts. Real providers always set it. */
  projectionStatus?: ProjectionStatus;
  events: FoundryEvent[];
  worldState: WorldState;
  isRunning: boolean;
  isComplete: boolean;
  connectionStatus: ConnectionStatus;
  mutationsEnabled: boolean;
}

export function runtimeSourceLabel(source: RuntimeSource | undefined): string {
  if (!source) return "Test fixture";
  return source.kind === "backend" ? source.label : `Fixture · ${source.label}`;
}
