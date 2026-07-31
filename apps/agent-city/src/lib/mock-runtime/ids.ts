// Deterministic id/timestamp generation: the same seed always produces the
// same sequence of ids and timestamps (FBL-008 "same seed and command
// sequence produces identical events"). No real randomness is used —
// nothing in the canonical V1 script branches on chance.
export function createIdGenerator(seed: string) {
  let counter = 0;
  return (kind: string): string => {
    counter += 1;
    return `${seed}-${kind}-${counter}`;
  };
}

const EPOCH_MS = Date.parse("2026-07-30T00:00:00.000Z");
const STEP_MS = 1000;

export function createClock() {
  let tick = 0;
  return (): string => {
    const value = new Date(EPOCH_MS + tick * STEP_MS).toISOString();
    tick += 1;
    return value;
  };
}
