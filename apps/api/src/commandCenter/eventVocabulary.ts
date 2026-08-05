import { isV1Event, type PersistedEvent } from "@foundry/event-types";

/**
 * Event vocabulary negotiation (Decision 10.5, Package 1b-ii-a).
 *
 * Three rules, each load-bearing:
 *
 * **Absent means frozen V1.** The reconciled frontend validates every frame
 * and, since the projection-honesty checkpoint, treats a contract-invalid one
 * as a possible gap in canonical history — it marks the projection stale and
 * closes the stream. A default that widened would therefore not degrade
 * gracefully; it would break Package 1b-i on contact. Absence is not a
 * version, it is the frozen behaviour.
 *
 * **Opt-in is explicit.** `command-center-v1` adds the accepted Command Center
 * events and nothing else.
 *
 * **Unknown is refused, never downgraded.** A client that asked for a
 * vocabulary and quietly received a narrower one would believe it had seen
 * everything — the same false-coverage claim a fabricated
 * `external_action.none` would make. A 400 is honest; a silent fallback is
 * not.
 */

export const VOCABULARY_PARAM = "vocabulary";

/** Every value a caller may send. Absence is handled separately. */
export const SUPPORTED_VOCABULARIES = ["command-center-v1"] as const;
export type SupportedVocabulary = (typeof SUPPORTED_VOCABULARIES)[number];

export type VocabularyResolution =
  | { ok: true; vocabulary: "v1"; explicit: false }
  | { ok: true; vocabulary: SupportedVocabulary; explicit: true }
  | { ok: false; refusal: { error: string; message: string; supported: string[] } };

/**
 * Resolves the requested vocabulary.
 *
 * An empty-string parameter is treated as *supplied and unknown*, not as
 * absent: `?vocabulary=` is a caller stating a value, and guessing that they
 * meant the default is exactly the silent fallback this ruling prohibits.
 */
export function resolveVocabulary(raw: string | null | undefined): VocabularyResolution {
  if (raw === null || raw === undefined) {
    return { ok: true, vocabulary: "v1", explicit: false };
  }
  if ((SUPPORTED_VOCABULARIES as readonly string[]).includes(raw)) {
    return { ok: true, vocabulary: raw as SupportedVocabulary, explicit: true };
  }
  return {
    ok: false,
    refusal: {
      error: "unknown_vocabulary",
      message: `Unknown ${VOCABULARY_PARAM} "${raw}". Omit the parameter for the frozen V1 vocabulary, or send one of the supported values. This request is refused rather than served a narrower vocabulary than it asked for.`,
      supported: [...SUPPORTED_VOCABULARIES],
    },
  };
}

/**
 * The filter for a resolved vocabulary.
 *
 * `v1` keeps the exact `isV1Event` predicate the default transports already
 * used, so the frozen path is the same code rather than a re-implementation
 * that could drift away from it.
 */
export function eventFilterFor(
  vocabulary: "v1" | SupportedVocabulary,
): (event: PersistedEvent) => boolean {
  if (vocabulary === "v1") return isV1Event;
  // command-center-v1: everything the backend persists. There is no third
  // vocabulary, so this is total rather than a default branch.
  return () => true;
}
