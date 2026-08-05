import { describe, expect, it } from "vitest";
import {
  CONSEQUENTIAL_CONTRADICTION_DOMAINS,
  CanonicalPromotionCommandSchema,
  IntentCandidateSchema,
  evaluateCanonicalPromotion,
  type CanonicalPromotionCommand,
  type IntentCandidate,
} from "./intentCandidate";

/**
 * Construction Package 1a — the intent-candidate authority rules.
 *
 * These tests protect one property above all others: **assistant text
 * cannot become operator intent by proximity.** A transcript contains both
 * kinds of statement, they look identical once quoted, and a registry that
 * confuses them stops being a record of what the operator wants.
 */

function candidate(overrides: Partial<IntentCandidate> = {}): IntentCandidate {
  return {
    candidateId: "cand-1",
    statement: "Employment is the first complete revenue-oriented district.",
    source: {
      sourceId: "conv-2026-08-01",
      sourceKind: "conversation_export",
      locator: "message 42",
    },
    excerpt: { text: "Employment should be the first complete district." },
    speaker: {
      rawSpeakerLabel: "Human",
      authorship: "operator",
      basis: "explicit_source_role",
    },
    duplicates: [],
    contradictions: [],
    confidence: 0.9,
    status: "confirmed",
    operatorCorrection: null,
    extractedAt: "2026-08-04T00:00:00.000Z",
    ...overrides,
  };
}

function command(overrides: Partial<CanonicalPromotionCommand> = {}): CanonicalPromotionCommand {
  return {
    candidateId: "cand-1",
    authenticatedOperatorId: "operator-1",
    canonicalStatement: "Employment is the first complete revenue-oriented district.",
    issuedAt: "2026-08-04T00:05:00.000Z",
    ...overrides,
  };
}

describe("promotion requires an explicit operator command", () => {
  it("permits a confirmed, operator-authored candidate with a matching command", () => {
    expect(evaluateCanonicalPromotion(candidate(), command())).toEqual({ permitted: true });
  });

  it("REFUSES with no command at all — nothing is promoted by confidence or age", () => {
    const decision = evaluateCanonicalPromotion(candidate({ confidence: 1 }), null);
    expect(decision.permitted).toBe(false);
    if (decision.permitted) throw new Error("unreachable");
    expect(decision.refusals.map((r) => r.code)).toContain("missing_explicit_operator_command");
    expect(decision.refusals[0]?.reason).toMatch(/by confidence, by age, or in bulk/i);
  });

  it("REFUSES a command that names a different candidate", () => {
    const decision = evaluateCanonicalPromotion(
      candidate(),
      command({ candidateId: "cand-somebody-else" }),
    );
    expect(decision.permitted).toBe(false);
    if (decision.permitted) throw new Error("unreachable");
    expect(decision.refusals.map((r) => r.code)).toContain("missing_explicit_operator_command");
  });

  it("the command shape has no bulk form — it names exactly one candidate", () => {
    const parsed = CanonicalPromotionCommandSchema.safeParse({
      candidateIds: ["a", "b"],
      authenticatedOperatorId: "operator-1",
      canonicalStatement: "x",
      issuedAt: "2026-08-04T00:00:00.000Z",
    });
    expect(parsed.success).toBe(false);
  });

  it("requires an authenticated operator id on the command", () => {
    const parsed = CanonicalPromotionCommandSchema.safeParse({
      candidateId: "cand-1",
      canonicalStatement: "x",
      issuedAt: "2026-08-04T00:00:00.000Z",
    });
    expect(parsed.success).toBe(false);
  });
});

describe("assistant text cannot become operator intent by proximity", () => {
  it.each(["assistant", "unknown"] as const)("REFUSES %s-authored text", (authorship) => {
    const decision = evaluateCanonicalPromotion(
      candidate({
        speaker: { rawSpeakerLabel: "Assistant", authorship, basis: "explicit_source_role" },
      }),
      command(),
    );
    expect(decision.permitted).toBe(false);
    if (decision.permitted) throw new Error("unreachable");
    expect(decision.refusals.map((r) => r.code)).toContain("authorship_not_operator");
    expect(decision.refusals.find((r) => r.code === "authorship_not_operator")?.reason).toMatch(
      /proximity in a conversation is not evidence of adoption/i,
    );
  });

  it("refuses even when the assistant text sits in the same source as operator text", () => {
    // Same conversation, same locator neighbourhood, high confidence.
    // None of that makes it the operator's.
    const assistantLine = candidate({
      candidateId: "cand-2",
      speaker: { rawSpeakerLabel: "Assistant", authorship: "assistant", basis: "explicit_source_role" },
      source: { sourceId: "conv-2026-08-01", sourceKind: "conversation_export", locator: "message 43" },
      confidence: 0.99,
    });
    const decision = evaluateCanonicalPromotion(assistantLine, command({ candidateId: "cand-2" }));
    expect(decision.permitted).toBe(false);
  });

  it("an explicit operator correction CAN reattribute it — the rule is strict, not unfair", () => {
    const corrected = candidate({
      speaker: { rawSpeakerLabel: "Assistant", authorship: "assistant", basis: "explicit_source_role" },
      operatorCorrection: {
        correctedBy: "operator-1",
        correctedAt: "2026-08-04T00:04:00.000Z",
        correctedStatement: "Employment is the first complete revenue-oriented district.",
        correctedAuthorship: "operator",
        note: "I said this; the export mislabelled the speaker.",
      },
    });
    expect(evaluateCanonicalPromotion(corrected, command())).toEqual({ permitted: true });
  });

  it("keeps the raw speaker label rather than normalising it away", () => {
    const parsed = IntentCandidateSchema.safeParse(
      candidate({
        speaker: { rawSpeakerLabel: "  Mike (operator) ", authorship: "operator", basis: "explicit_speaker_label" },
      }),
    );
    expect(parsed.success).toBe(true);
    if (!parsed.success) throw new Error("unreachable");
    expect(parsed.data.speaker.rawSpeakerLabel).toBe("  Mike (operator) ");
  });
});

describe("status gates", () => {
  it.each(["unreviewed", "rejected", "merged", "superseded"] as const)(
    "REFUSES a %s candidate",
    (status) => {
      const decision = evaluateCanonicalPromotion(candidate({ status }), command());
      expect(decision.permitted).toBe(false);
    },
  );

  it("explains a merged candidate by pointing at the survivor", () => {
    const decision = evaluateCanonicalPromotion(candidate({ status: "merged" }), command());
    if (decision.permitted) throw new Error("unreachable");
    expect(decision.refusals.map((r) => r.code)).toContain("merged_into_another_candidate");
    expect(decision.refusals.find((r) => r.code === "merged_into_another_candidate")?.reason).toMatch(
      /Promote the surviving candidate/i,
    );
  });
});

describe("contradictions in consequential domains block promotion", () => {
  it.each(CONSEQUENTIAL_CONTRADICTION_DOMAINS)("blocks on an unresolved %s contradiction", (domain) => {
    const decision = evaluateCanonicalPromotion(
      candidate({
        contradictions: [{ contradictsCandidateId: "cand-9", domain, resolved: false }],
      }),
      command(),
    );
    expect(decision.permitted).toBe(false);
    if (decision.permitted) throw new Error("unreachable");
    expect(decision.refusals.map((r) => r.code)).toContain(
      "unresolved_consequential_contradiction",
    );
  });

  it("does NOT block on a mere preference contradiction", () => {
    const decision = evaluateCanonicalPromotion(
      candidate({
        contradictions: [
          { contradictsCandidateId: "cand-9", domain: "preference", resolved: false },
        ],
      }),
      command(),
    );
    expect(decision.permitted).toBe(true);
  });

  it("a resolved consequential contradiction no longer blocks", () => {
    const decision = evaluateCanonicalPromotion(
      candidate({
        contradictions: [
          { contradictsCandidateId: "cand-9", domain: "spending", resolved: true, note: "superseded 2026-08-02" },
        ],
      }),
      command(),
    );
    expect(decision.permitted).toBe(true);
  });

  it("reports every blocking contradiction, not just the first", () => {
    const decision = evaluateCanonicalPromotion(
      candidate({
        contradictions: [
          { contradictsCandidateId: "a", domain: "authority", resolved: false },
          { contradictsCandidateId: "b", domain: "spending", resolved: false },
        ],
      }),
      command(),
    );
    if (decision.permitted) throw new Error("unreachable");
    expect(
      decision.refusals.filter((r) => r.code === "unresolved_consequential_contradiction"),
    ).toHaveLength(2);
  });
});

describe("the guard fails closed and reports everything at once", () => {
  it("returns every reason rather than stopping at the first", () => {
    const decision = evaluateCanonicalPromotion(
      candidate({
        status: "unreviewed",
        speaker: { rawSpeakerLabel: "Assistant", authorship: "assistant", basis: "explicit_source_role" },
        contradictions: [{ contradictsCandidateId: "x", domain: "authority", resolved: false }],
      }),
      null,
    );
    if (decision.permitted) throw new Error("unreachable");
    const codes = decision.refusals.map((r) => r.code);
    expect(codes).toContain("missing_explicit_operator_command");
    expect(codes).toContain("not_confirmed_by_operator");
    expect(codes).toContain("authorship_not_operator");
    expect(codes).toContain("unresolved_consequential_contradiction");
  });

  it("requires a source locator and a verbatim excerpt", () => {
    expect(
      IntentCandidateSchema.safeParse({ ...candidate(), source: { sourceId: "s", sourceKind: "markdown", locator: "" } })
        .success,
    ).toBe(false);
    expect(
      IntentCandidateSchema.safeParse({ ...candidate(), excerpt: { text: "" } }).success,
    ).toBe(false);
  });

  it("refuses an invented field rather than dropping it", () => {
    expect(
      IntentCandidateSchema.safeParse({ ...candidate(), promoteMe: true }).success,
    ).toBe(false);
  });
});
