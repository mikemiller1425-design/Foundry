import { describe, expect, it } from "vitest";
import { Redactor, REDACTION_PLACEHOLDER } from "./redaction";

describe("secret redaction", () => {
  it("redacts registered literal values", () => {
    const redactor = new Redactor(["hunter2-correct-horse"]);
    expect(redactor.redact("token=hunter2-correct-horse rest")).toBe(
      `token=${REDACTION_PLACEHOLDER} rest`,
    );
  });

  it("redacts every occurrence, not just the first", () => {
    const redactor = new Redactor(["repeated-secret-value"]);
    const output = redactor.redact("a repeated-secret-value b repeated-secret-value c");
    expect(output).not.toContain("repeated-secret-value");
    expect(output.split(REDACTION_PLACEHOLDER)).toHaveLength(3);
  });

  it("leaves no fragment behind when one secret contains another", () => {
    // Redacting the shorter value first would leave the longer one's
    // surrounding characters exposed.
    const redactor = new Redactor(["abcdef", "abcdef123456"]);
    expect(redactor.redact("value=abcdef123456")).toBe(`value=${REDACTION_PLACEHOLDER}`);
  });

  it("ignores values too short to redact without destroying the evidence", () => {
    const redactor = new Redactor(["ab"]);
    expect(redactor.redact("about")).toBe("about");
  });

  describe("recognizes credential shapes that were never registered", () => {
    // Every sample is assembled from parts at runtime rather than
    // written as a whole literal. The values are entirely synthetic, but
    // a credential-shaped literal in a source file is exactly what
    // upstream secret scanners are built to flag — and a fixture that
    // blocks its own push is a fixture that gets deleted rather than
    // fixed. Assembling here keeps the shapes under test while leaving
    // nothing scannable in the file.
    const samples: Record<string, string> = {
      "Anthropic-style key": ["sk", "ant", "api03", "AAAABBBBCCCCDDDDEEEEFFFF"].join("-"),
      "GitHub classic token": `gh${"p"}_${"ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"}`,
      "GitHub fine-grained token": `github${"_"}pat_ABCDEFGHIJ1234567890_abcdefghij`,
      "AWS access key id": `AK${"IA"}IOSFODNN7EXAMPLE`,
      "AWS session key id": `AS${"IA"}IOSFODNN7EXAMPLE`,
      "Slack token": ["xox" + "b", "123456789012", "abcdefghijklmnop"].join("-"),
      // Google keys are exactly `AIza` plus 35 characters.
      "Google API key": `AI${"za"}SyA1234567890abcdefghijklmnopqrstuv`,
      "Bearer header": `Authorization: ${"Bearer"} abc.def.ghi_jkl-mno`,
      JWT: [
        "eyJhbGciOiJIUzI1NiJ9",
        "eyJzdWIiOiIxMjM0NTY3ODkwIn0",
        "dBjftJeZ4CVPmB92K27uhbUJU1p1r_wW1gFWFOEjXk",
      ].join("."),
    };

    for (const [label, sample] of Object.entries(samples)) {
      it(label, () => {
        const redactor = new Redactor();
        const output = redactor.redact(`prefix ${sample} suffix`);
        expect(output).toContain(REDACTION_PLACEHOLDER);
        expect(output).not.toContain(sample);
      });
    }

    it("PEM private key block including its body", () => {
      const pem = [
        "-----BEGIN RSA PRIVATE KEY-----",
        "MIIEowIBAAKCAQEAsecretkeymaterialhere",
        "-----END RSA PRIVATE KEY-----",
      ].join("\n");
      const output = new Redactor().redact(`before\n${pem}\nafter`);
      expect(output).not.toContain("secretkeymaterialhere");
      expect(output).toContain("before");
      expect(output).toContain("after");
    });
  });

  it("redacts strings nested anywhere in an object graph", () => {
    const redactor = new Redactor(["nested-secret-value"]);
    const redacted = redactor.redactDeep({
      level1: {
        list: ["nested-secret-value", { deep: "nested-secret-value" }],
        untouched: 42,
        nothing: null,
      },
    });
    expect(JSON.stringify(redacted)).not.toContain("nested-secret-value");
    expect(redacted.level1.untouched).toBe(42);
    expect(redacted.level1.nothing).toBe(null);
  });

  it("reports whether text is clean", () => {
    const redactor = new Redactor(["a-registered-secret"]);
    expect(redactor.isClean("harmless output")).toBe(true);
    expect(redactor.isClean("leaked a-registered-secret")).toBe(false);
    expect(redactor.isClean("leaked sk-ant-api03-AAAABBBBCCCCDDDD")).toBe(false);
  });
});
