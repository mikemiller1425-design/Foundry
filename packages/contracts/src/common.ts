import { z } from "zod";

// IDs are stable opaque strings (domain-model.md "Global conventions").
export const IdSchema = z.string().min(1);
export type Id = z.infer<typeof IdSchema>;

// ISO 8601 UTC storage (domain-model.md "Global conventions").
export const TimestampSchema = z.iso.datetime();
export type Timestamp = z.infer<typeof TimestampSchema>;

// Principle 19 risk classes. R0–R2 are the only classes V1 may implement.
export const RiskClassSchema = z.enum(["R0", "R1", "R2", "R3", "R4", "R5"]);
export type RiskClass = z.infer<typeof RiskClassSchema>;

export const V1RiskClassSchema = z.enum(["R0", "R1", "R2"]);
export type V1RiskClass = z.infer<typeof V1RiskClassSchema>;

export const RuntimeTypeSchema = z.enum(["mock", "claude_code"]);
export type RuntimeType = z.infer<typeof RuntimeTypeSchema>;

// A simple 3D world-space position; exact axes are a rendering concern for
// later rungs (FBL-011+), not a domain invariant.
export const PositionSchema = z.object({
  x: z.number(),
  y: z.number(),
  z: z.number(),
});
export type Position = z.infer<typeof PositionSchema>;
