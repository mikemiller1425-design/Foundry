import { z } from "zod";
import { IdSchema, TimestampSchema } from "../common";
import { EvidenceRefSchema } from "./attested";

/**
 * Monetary outcomes (Package 1b-ii scope item 5).
 *
 * The six statuses are **not interchangeable and must never be summed
 * together**. "Projected" is a hope, "invoiced" is a claim, "received" is a
 * fact — and an interface that adds them produces a revenue figure no bank
 * statement will ever agree with. The type keeps them apart by construction:
 * there is no field holding a bare total, and every amount carries the status
 * it belongs to.
 */

export const MoneyStatusSchema = z.enum([
  "projected",
  "quoted",
  "invoiced",
  "received",
  "spent",
  "refunded",
]);
export type MoneyStatus = z.infer<typeof MoneyStatusSchema>;

/** Statuses that represent money actually in hand. Only `received` qualifies. */
export const REALIZED_INCOME_STATUSES: readonly MoneyStatus[] = ["received"];

/** Statuses that represent money actually paid out. */
export const REALIZED_OUTFLOW_STATUSES: readonly MoneyStatus[] = ["spent", "refunded"];

/**
 * One monetary record.
 *
 * Every field here is required for a reason: an amount with no currency is
 * ambiguous, an amount with no source event is unverifiable, and an amount
 * with no responsible entity cannot be chased when it is wrong.
 */
export const MonetaryRecordSchema = z.object({
  recordId: IdSchema,
  status: MoneyStatusSchema,
  /** ISO 4217. Held as a string so a future non-USD package needs no change. */
  currency: z.string().length(3),
  /** Exact amount. Non-negative — direction is carried by `status`. */
  amount: z.number().nonnegative(),
  /** The event or evidence this amount was read from. Never optional. */
  evidence: z.array(EvidenceRefSchema).min(1),
  recordedAt: TimestampSchema,
  /** Who or what is answerable for this amount. */
  responsibleEntityType: z.string().min(1),
  responsibleEntityId: IdSchema,
  note: z.string().optional(),
});
export type MonetaryRecord = z.infer<typeof MonetaryRecordSchema>;

/**
 * Money for one interval, kept per status.
 *
 * There is deliberately no `total`, no `netRevenue`, and no `balance`. A
 * caller that wants one must choose which statuses it means and say so,
 * which makes the choice visible in the calling code rather than buried in
 * this type.
 */
export const MonetaryOutcomeSchema = z.object({
  currency: z.string().length(3),
  byStatus: z.object({
    projected: z.array(MonetaryRecordSchema),
    quoted: z.array(MonetaryRecordSchema),
    invoiced: z.array(MonetaryRecordSchema),
    received: z.array(MonetaryRecordSchema),
    spent: z.array(MonetaryRecordSchema),
    refunded: z.array(MonetaryRecordSchema),
  }),
});
export type MonetaryOutcome = z.infer<typeof MonetaryOutcomeSchema>;

/** Sum of one status. The status must be named — there is no default. */
export function sumStatus(outcome: MonetaryOutcome, status: MoneyStatus): number {
  return outcome.byStatus[status].reduce((total, record) => total + record.amount, 0);
}

/**
 * Revenue actually received. Returns 0 when no `received` record exists, and
 * that zero is a fact rather than a placeholder: the Command Center may label
 * money as earned only when a received record backs it.
 */
export function receivedRevenue(outcome: MonetaryOutcome): number {
  return sumStatus(outcome, "received");
}

/** True when nothing has been received. Rendered honestly, never hidden. */
export function hasNoReceivedRevenue(outcome: MonetaryOutcome): boolean {
  return outcome.byStatus.received.length === 0;
}

export const NO_RECEIVED_REVENUE_STATEMENT =
  "No received revenue is recorded in Foundry's operational ledger.";
