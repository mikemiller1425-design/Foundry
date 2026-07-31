import { z } from "zod";

// docs/02-specification/event-model.md → "Demo control commands"
// (resolves audit finding M-01). This is the exhaustive, closed set of
// commandType values V1 accepts. No other demo commandType is valid.
export const DemoCommandTypeSchema = z.enum([
  "demo.start",
  "demo.pause",
  "demo.resume",
  "demo.set_speed",
  "demo.reset",
  "demo.replay",
]);
export type DemoCommandType = z.infer<typeof DemoCommandTypeSchema>;

const DemoStartCommandSchema = z.object({
  commandType: z.literal("demo.start"),
  params: z.strictObject({}),
});
const DemoPauseCommandSchema = z.object({
  commandType: z.literal("demo.pause"),
  params: z.strictObject({}),
});
const DemoResumeCommandSchema = z.object({
  commandType: z.literal("demo.resume"),
  params: z.strictObject({}),
});
const DemoSetSpeedCommandSchema = z.object({
  commandType: z.literal("demo.set_speed"),
  params: z.strictObject({ multiplier: z.number().positive() }),
});
const DemoResetCommandSchema = z.object({
  commandType: z.literal("demo.reset"),
  params: z.strictObject({}),
});
const DemoReplayCommandSchema = z.object({
  commandType: z.literal("demo.replay"),
  params: z.strictObject({ seed: z.string().optional() }),
});

export const DemoCommandSchema = z.discriminatedUnion("commandType", [
  DemoStartCommandSchema,
  DemoPauseCommandSchema,
  DemoResumeCommandSchema,
  DemoSetSpeedCommandSchema,
  DemoResetCommandSchema,
  DemoReplayCommandSchema,
]);
export type DemoCommand = z.infer<typeof DemoCommandSchema>;

// commandType values that may clear or re-emit event history; the rest
// (pause/resume/set_speed) affect emission timing only, never content.
export const HISTORY_ALTERING_DEMO_COMMANDS: readonly DemoCommandType[] = [
  "demo.reset",
  "demo.replay",
];
