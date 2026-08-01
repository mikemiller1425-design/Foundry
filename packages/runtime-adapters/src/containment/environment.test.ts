import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { defineRuntimePolicy } from "../policy";
import { buildChildEnvironment } from "./environment";

describe("environment containment", () => {
  let sandbox: string;

  const makePolicy = (allowedEnvironmentVariables: string[]) =>
    defineRuntimePolicy({
      id: "env-policy",
      workingDirectoryRoots: [sandbox],
      maxRiskClass: "R2",
      allowedEnvironmentVariables,
      limits: {
        timeoutMs: 1_000,
        maxStdoutBytes: 128,
        maxStderrBytes: 128,
        maxEvidenceBytes: 1024,
      },
    });

  const hostileEnvironment: Record<string, string | undefined> = {
    HOME: "/Users/operator",
    PATH: "/usr/bin:/bin",
    ANTHROPIC_API_KEY: "sk-ant-should-never-leak-000000000000",
    AWS_SECRET_ACCESS_KEY: "aws-should-never-leak",
    GITHUB_TOKEN: "ghp_shouldneverleak0000000000000000000000",
    SSH_AUTH_SOCK: "/private/tmp/ssh-agent.sock",
    LANG: "en_US.UTF-8",
  };

  beforeAll(() => {
    sandbox = mkdtempSync(path.join(tmpdir(), "foundry-env-"));
  });

  afterAll(() => rmSync(sandbox, { recursive: true, force: true }));

  it("passes through only allowlisted variables", () => {
    const decision = buildChildEnvironment(makePolicy(["LANG"]), hostileEnvironment);
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.value.env).toEqual({ LANG: "en_US.UTF-8" });
    }
  });

  it("leaks nothing when the allowlist is empty", () => {
    const decision = buildChildEnvironment(makePolicy([]), hostileEnvironment);
    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(Object.keys(decision.value.env)).toHaveLength(0);
  });

  it("never leaks credentials that were present in the source environment", () => {
    const decision = buildChildEnvironment(makePolicy(["LANG", "HOME"]), hostileEnvironment);
    expect(decision.allowed).toBe(true);
    if (!decision.allowed) return;

    const serialized = JSON.stringify(decision.value.env);
    for (const secret of [
      "sk-ant-should-never-leak-000000000000",
      "aws-should-never-leak",
      "ghp_shouldneverleak0000000000000000000000",
      "/private/tmp/ssh-agent.sock",
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(decision.value.env).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(decision.value.env).not.toHaveProperty("AWS_SECRET_ACCESS_KEY");
    expect(decision.value.env).not.toHaveProperty("GITHUB_TOKEN");
    expect(decision.value.env).not.toHaveProperty("SSH_AUTH_SOCK");
  });

  it("refuses to allowlist variables that redirect which binary runs", () => {
    for (const name of [
      "PATH",
      "LD_PRELOAD",
      "DYLD_INSERT_LIBRARIES",
      "NODE_OPTIONS",
      "GIT_SSH_COMMAND",
    ]) {
      const decision = buildChildEnvironment(makePolicy([name]), hostileEnvironment);
      expect(decision.allowed).toBe(false);
      if (!decision.allowed) expect(decision.denial.code).toBe("environment_not_allowed");
    }
  });

  it("reports allowlisted names that were absent rather than inventing empty values", () => {
    const decision = buildChildEnvironment(
      makePolicy(["LANG", "NOT_SET_ANYWHERE"]),
      hostileEnvironment,
    );
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.value.missing).toEqual(["NOT_SET_ANYWHERE"]);
      expect(decision.value.env).not.toHaveProperty("NOT_SET_ANYWHERE");
    }
  });

  it("denies adapter-supplied variables that the policy never allowlisted", () => {
    // The adapter gets no privilege the policy did not grant it.
    const decision = buildChildEnvironment(makePolicy(["LANG"]), hostileEnvironment, {
      FOUNDRY_RUN_ID: "run-1",
    });
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("environment_not_allowed");
  });

  it("accepts adapter-supplied variables that the policy did allowlist", () => {
    const decision = buildChildEnvironment(
      makePolicy(["LANG", "FOUNDRY_RUN_ID"]),
      hostileEnvironment,
      {
        FOUNDRY_RUN_ID: "run-1",
      },
    );
    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(decision.value.env.FOUNDRY_RUN_ID).toBe("run-1");
  });

  it("builds an environment with no inherited prototype pollution surface", () => {
    const decision = buildChildEnvironment(makePolicy([]), hostileEnvironment);
    expect(decision.allowed).toBe(true);
    if (decision.allowed) expect(Object.getPrototypeOf(decision.value.env)).toBe(null);
  });
});
