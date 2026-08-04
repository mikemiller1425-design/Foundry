import { createHash } from "node:crypto";
import { canonicalPlanContent, type BuildPlan } from "@foundry/contracts";

/**
 * The execution binding: a backend-generated SHA-256 over canonical
 * persisted plan content (AC-110, `F-113a`).
 *
 * ## Why this lives here and not in `@foundry/contracts`
 *
 * Not module hygiene — it is the requirement.
 *
 * The operator's `AC-107` contract review required that the binding be
 * *"backend-generated … and compared server-side. A client-supplied value
 * is never accepted as the binding."* `@foundry/contracts` ships into the
 * browser bundle. A hash function there would be a hash function the
 * client can call, and the distinction between "the backend computed this"
 * and "something computed this" would rest on a convention rather than on
 * a boundary.
 *
 * `@foundry/persistence` is backend-only and imports `node:crypto`, which
 * a browser bundle cannot resolve. So the producer of the binding is
 * unreachable from the client **by construction**, and that is the whole
 * design.
 *
 * ## Why SHA-256 and not `planRevision`
 *
 * `planRevision` is FNV-1a: short, fast, non-cryptographic, and computable
 * anywhere. It answers "did this change?" and offers nothing against a
 * party that wants two different plans to share a value. It is retained as
 * a change indicator and is explicitly **not** a security boundary
 * (`F-113a`). Anything that gates a real model invocation compares this.
 *
 * ## Canonical content
 *
 * The bytes hashed come from `canonicalPlanContent`, the single shared
 * definition both fingerprints use. Two canonical forms that drifted apart
 * would let a plan be "unchanged" by one measure and "changed" by the
 * other, with no principled answer as to which was right.
 *
 * Deterministic: the same plan always produces the same hash, so a replay
 * or a restart recomputes the identical binding rather than invalidating
 * every authorization it rebuilt.
 */

/** Prefix, so a stored value announces which algorithm produced it. */
export const PLAN_CONTENT_HASH_PREFIX = "sha256:";

export function planContentHash(plan: BuildPlan): string {
  const digest = createHash("sha256").update(canonicalPlanContent(plan), "utf8").digest("hex");
  return `${PLAN_CONTENT_HASH_PREFIX}${digest}`;
}

/**
 * Constant-time comparison of two plan content hashes.
 *
 * The threat this addresses is modest — the hashes are not secrets, and a
 * timing oracle on a local single-operator service buys an attacker very
 * little. It is here because the alternative is `===` on a value that
 * decides whether real execution proceeds, and the cost of not having to
 * argue about that is one function.
 *
 * Length is compared first and separately: `timingSafeEqual` throws on
 * unequal lengths, and a differing length is not a secret worth protecting.
 */
export function plansContentHashEquals(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i += 1) {
    difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return difference === 0;
}
