import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defineRuntimePolicy, type RuntimePolicy } from "../policy";
import { evaluateCommand } from "./commands";
import { canonicalizeRoots, type ContainmentContext } from "./paths";

describe("command allowlist", () => {
  let sandbox: string;
  let policy: RuntimePolicy;
  let context: ContainmentContext;

  beforeAll(() => {
    sandbox = mkdtempSync(path.join(tmpdir(), "foundry-commands-"));
    mkdirSync(path.join(sandbox, "src"), { recursive: true });
    writeFileSync(path.join(sandbox, "src", "index.ts"), "export {};\n");

    policy = defineRuntimePolicy({
      id: "test-policy",
      workingDirectoryRoots: [sandbox],
      maxRiskClass: "R2",
      limits: {
        timeoutMs: 5_000,
        maxStdoutBytes: 1024,
        maxStderrBytes: 1024,
        maxEvidenceBytes: 16 * 1024,
      },
      allowedCommands: [
        { executable: "node", args: [{ kind: "literal", value: "--version" }] },
        {
          executable: "git",
          args: [{ kind: "enum", values: ["status", "diff", "add"] }],
          variadicTail: { kind: "containedPath" },
          maxArgs: 4,
        },
        { executable: "cat", args: [{ kind: "containedPath" }] },
      ],
    });

    const canonical = canonicalizeRoots(policy.workingDirectoryRoots);
    if (!canonical.allowed) throw new Error("fixture roots must canonicalize");
    const root = canonical.value[0];
    if (root === undefined) throw new Error("fixture root missing");
    context = {
      canonicalRoots: canonical.value,
      canonicalWorkingDirectory: root,
      declaredRoots: policy.workingDirectoryRoots,
    };
  });

  afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

  it("allows an allowlisted command with an exact-literal argument", () => {
    const decision = evaluateCommand(policy, context, "node", ["--version"]);
    expect(decision.allowed).toBe(true);
  });

  it("allows an enumerated argument and canonicalizes contained path arguments", () => {
    const decision = evaluateCommand(policy, context, "git", ["add", "src/index.ts"]);
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(path.isAbsolute(decision.value.args[1] ?? "")).toBe(true);
      expect(decision.value.args[1]?.endsWith(path.join("src", "index.ts"))).toBe(true);
    }
  });

  it("denies an executable that is not on the allowlist", () => {
    const decision = evaluateCommand(policy, context, "curl", ["https://example.com"]);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("command_not_allowed");
  });

  it("denies a plausible-but-unlisted neighbour of an allowed command", () => {
    // `npm` is not `node`. Nothing about the allowlist is fuzzy.
    const decision = evaluateCommand(policy, context, "npm", ["--version"]);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("command_not_allowed");
  });

  it("denies a disallowed argument to an allowed command", () => {
    const decision = evaluateCommand(policy, context, "node", ["--eval"]);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("argument_not_allowed");
  });

  it("denies a disallowed subcommand to an allowed command", () => {
    // `git push` is exactly the kind of thing the enum exists to stop.
    const decision = evaluateCommand(policy, context, "git", ["push"]);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("argument_not_allowed");
  });

  it("denies extra arguments beyond the declared rules", () => {
    const decision = evaluateCommand(policy, context, "node", ["--version", "extra"]);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("argument_not_allowed");
  });

  it("denies an argument vector longer than maxArgs", () => {
    const decision = evaluateCommand(policy, context, "git", [
      "add",
      "src/index.ts",
      "src/index.ts",
      "src/index.ts",
      "src/index.ts",
    ]);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("argument_count_exceeded");
  });

  describe("shell injection attempts", () => {
    // The runner never uses a shell, so these are inert either way. They
    // are refused anyway so the attempt is recorded rather than ignored.
    const injections = [
      "src/index.ts; rm -rf /",
      "src/index.ts && curl evil.test",
      "src/index.ts | tee /etc/passwd",
      "$(whoami)",
      "`whoami`",
      "src/index.ts\nrm -rf /",
      "*.ts",
      "~/.ssh/id_rsa",
      "src/index.ts > /etc/hosts",
    ];

    for (const injection of injections) {
      it(`denies ${JSON.stringify(injection)}`, () => {
        const decision = evaluateCommand(policy, context, "cat", [injection]);
        expect(decision.allowed).toBe(false);
        if (!decision.allowed) expect(decision.denial.code).toBe("shell_metacharacter");
      });
    }

    it("denies shell metacharacters in the executable name itself", () => {
      const decision = evaluateCommand(policy, context, "node;curl", ["--version"]);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) expect(decision.denial.code).toBe("shell_metacharacter");
    });
  });

  it("denies a path argument that escapes the root", () => {
    const decision = evaluateCommand(policy, context, "cat", ["/etc/passwd"]);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("path_outside_root");
  });

  it("denies a '..' traversal in a path argument", () => {
    const decision = evaluateCommand(policy, context, "cat", ["src/../../outside.txt"]);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("path_traversal");
  });

  it("denies every command when the allowlist is empty (deny by default)", () => {
    const empty = defineRuntimePolicy({
      id: "empty",
      workingDirectoryRoots: [sandbox],
      maxRiskClass: "R0",
      limits: {
        timeoutMs: 1_000,
        maxStdoutBytes: 128,
        maxStderrBytes: 128,
        maxEvidenceBytes: 1024,
      },
    });
    const decision = evaluateCommand(empty, context, "node", ["--version"]);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("command_not_allowed");
  });

  describe("multiple rules for one executable", () => {
    // Each permitted argument vector gets its own rule, so granting
    // `git status` never implicitly grants `git push`.
    const multi = () =>
      defineRuntimePolicy({
        id: "multi-rule",
        workingDirectoryRoots: [sandbox],
        maxRiskClass: "R1",
        limits: {
          timeoutMs: 1_000,
          maxStdoutBytes: 128,
          maxStderrBytes: 128,
          maxEvidenceBytes: 1024,
        },
        allowedCommands: [
          {
            executable: "git",
            args: [
              { kind: "literal", value: "status" },
              { kind: "literal", value: "--porcelain" },
            ],
            maxArgs: 2,
          },
          {
            executable: "git",
            args: [
              { kind: "literal", value: "diff" },
              { kind: "literal", value: "HEAD" },
            ],
            maxArgs: 2,
          },
        ],
      });

    it("allows the first declared vector", () => {
      expect(evaluateCommand(multi(), context, "git", ["status", "--porcelain"]).allowed).toBe(
        true,
      );
    });

    it("allows a later declared vector", () => {
      expect(evaluateCommand(multi(), context, "git", ["diff", "HEAD"]).allowed).toBe(true);
    });

    it("denies a vector that matches no rule, even mixing two allowed ones", () => {
      const decision = evaluateCommand(multi(), context, "git", ["status", "HEAD"]);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) expect(decision.denial.code).toBe("argument_not_allowed");
    });

    it("still denies a dangerous subcommand that no rule declares", () => {
      const decision = evaluateCommand(multi(), context, "git", ["push"]);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) expect(decision.denial.code).toBe("argument_not_allowed");
    });

    it("reports the denial from the rule that matched furthest", () => {
      // `diff` matches rule 2's first argument, so the useful complaint
      // is about argument 1 — not rule 1's objection to argument 0.
      const decision = evaluateCommand(multi(), context, "git", ["diff", "--staged"]);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) expect(decision.denial.subject).toBe("argv[1]");
    });

    it("denies a partial invocation that omits a required argument", () => {
      const decision = evaluateCommand(multi(), context, "git", ["diff"]);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) expect(decision.denial.code).toBe("argument_not_allowed");
    });
  });
});
