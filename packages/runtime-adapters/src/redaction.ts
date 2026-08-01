/**
 * Secret redaction.
 *
 * Applied at the boundary between "what a run produced" and "what
 * Foundry retains" — every result, log, error message, and evidence
 * record passes through here before it is stored or returned. That
 * placement is the point: redaction that happens at each call site is
 * redaction that gets forgotten at one of them.
 *
 * Two complementary strategies:
 *
 * - **Known values**: anything the operator registered as secret is
 *   matched literally. This is exact and cannot miss.
 * - **Known shapes**: credential formats that are recognizable on sight
 *   (provider API keys, PEM blocks, bearer headers). This catches
 *   secrets the operator never registered — including ones a *run*
 *   generated or read from a file — which the literal strategy
 *   structurally cannot.
 *
 * Shape matching is a safety net, not a guarantee. It is why secrets are
 * kept out of contained runs in the first place rather than relied upon
 * to be scrubbed on the way out.
 */

export const REDACTION_PLACEHOLDER = "[REDACTED]";

/** Credential shapes worth recognizing even when never registered. */
const SECRET_PATTERNS: readonly RegExp[] = [
  // Anthropic / OpenAI style keys.
  /\bsk-[A-Za-z0-9_-]{16,}/g,
  // GitHub tokens (classic, fine-grained, app, refresh).
  /\bgh[pousr]_[A-Za-z0-9]{16,}/g,
  /\bgithub_pat_[A-Za-z0-9_]{20,}/g,
  // AWS access key ids and their session tokens.
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/g,
  // Slack.
  /\bxox[abposr]-[A-Za-z0-9-]{10,}/g,
  // Google API keys.
  /\bAIza[A-Za-z0-9_-]{35}\b/g,
  // Bearer / Basic authorization headers.
  /\b(?:Authorization|authorization)\s*:\s*(?:Bearer|Basic)\s+[A-Za-z0-9._~+/=-]+/g,
  // PEM private key blocks, including the body.
  /-----BEGIN[A-Z ]*PRIVATE KEY-----[\s\S]*?-----END[A-Z ]*PRIVATE KEY-----/g,
  // JWTs.
  /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g,
];

/**
 * Registered values shorter than this are ignored, because redacting a
 * 3-character "secret" would blank out unrelated text everywhere it
 * happens to appear and make the evidence useless without making it
 * safer.
 */
const MIN_REDACTABLE_LENGTH = 6;

export class Redactor {
  private readonly literals: string[];

  constructor(secretValues: readonly string[] = []) {
    // Longest first, so an overlapping shorter secret can't leave a
    // fragment of a longer one behind.
    this.literals = [...new Set(secretValues)]
      .filter((value) => value.length >= MIN_REDACTABLE_LENGTH)
      .sort((a, b) => b.length - a.length);
  }

  redact(input: string): string {
    let output = input;
    for (const literal of this.literals) {
      output = output.split(literal).join(REDACTION_PLACEHOLDER);
    }
    for (const pattern of SECRET_PATTERNS) {
      output = output.replace(pattern, REDACTION_PLACEHOLDER);
    }
    return output;
  }

  /** Recursively redacts strings anywhere in a JSON-shaped value. */
  redactDeep<T>(value: T): T {
    if (typeof value === "string") return this.redact(value) as unknown as T;
    if (Array.isArray(value)) return value.map((item) => this.redactDeep(item)) as unknown as T;
    if (value !== null && typeof value === "object") {
      const result: Record<string, unknown> = {};
      for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
        result[key] = this.redactDeep(item);
      }
      return result as unknown as T;
    }
    return value;
  }

  /** True when nothing in `input` matches a known secret value or shape. */
  isClean(input: string): boolean {
    return this.redact(input) === input;
  }
}
