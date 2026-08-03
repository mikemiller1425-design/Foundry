import { describe, expect, it } from "vitest";
import {
  HANDOFF_PATH_VAR,
  isLoopbackHost,
  readHandoffCredential,
  type HandoffDeps,
} from "./credentialHandoff";

function deps(overrides: Partial<HandoffDeps> = {}): HandoffDeps {
  return {
    env: {},
    exists: () => false,
    readFile: () => "",
    ...overrides,
  };
}

describe("readHandoffCredential — the accepted path", () => {
  it("returns the credential the launch path wrote", () => {
    const result = readHandoffCredential(
      deps({
        env: { [HANDOFF_PATH_VAR]: "/run/foundry/cred" },
        exists: (p) => p === "/run/foundry/cred",
        readFile: () => "operator-token-value",
      }),
    );
    expect(result).toEqual({ available: true, credential: "operator-token-value" });
  });

  it("trims the trailing newline a file write leaves behind", () => {
    const result = readHandoffCredential(
      deps({
        env: { [HANDOFF_PATH_VAR]: "/p" },
        exists: () => true,
        readFile: () => "  token\n",
      }),
    );
    expect(result.credential).toBe("token");
  });
});

describe("readHandoffCredential — every refusal states a reason", () => {
  it("declines when no handoff was configured", () => {
    const result = readHandoffCredential(deps());
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/not started with a credential handoff/i);
  });

  it("declines when the declared file is missing", () => {
    const result = readHandoffCredential(
      deps({ env: { [HANDOFF_PATH_VAR]: "/gone" }, exists: () => false }),
    );
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/not present/i);
  });

  it("declines when the file cannot be read", () => {
    const result = readHandoffCredential(
      deps({
        env: { [HANDOFF_PATH_VAR]: "/p" },
        exists: () => true,
        readFile: () => {
          throw new Error("EACCES");
        },
      }),
    );
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/could not be read/i);
  });

  it("declines when the file is empty rather than handing over a blank token", () => {
    const result = readHandoffCredential(
      deps({ env: { [HANDOFF_PATH_VAR]: "/p" }, exists: () => true, readFile: () => "   \n" }),
    );
    expect(result.available).toBe(false);
    expect(result.reason).toMatch(/empty/i);
  });

  it("never returns a credential field when unavailable", () => {
    for (const d of [
      deps(),
      deps({ env: { [HANDOFF_PATH_VAR]: "/gone" } }),
      deps({ env: { [HANDOFF_PATH_VAR]: "/p" }, exists: () => true, readFile: () => "" }),
    ]) {
      expect(readHandoffCredential(d).credential).toBeUndefined();
    }
  });

  it("treats a whitespace-only path variable as unconfigured", () => {
    expect(readHandoffCredential(deps({ env: { [HANDOFF_PATH_VAR]: "   " } })).available).toBe(
      false,
    );
  });
});

describe("isLoopbackHost", () => {
  it("accepts the local names a browser actually sends", () => {
    for (const host of [
      "localhost",
      "localhost:3000",
      "127.0.0.1",
      "127.0.0.1:3000",
      "[::1]",
      "[::1]:3000",
      "LOCALHOST:3000",
    ]) {
      expect(isLoopbackHost(host), host).toBe(true);
    }
  });

  it("refuses a LAN or public host — the credential is for this machine", () => {
    for (const host of [
      "192.168.0.17:3000",
      "foundry.internal",
      "example.com",
      "10.0.0.5",
      "localhost.evil.com",
      "notlocalhost",
    ]) {
      expect(isLoopbackHost(host), host).toBe(false);
    }
  });

  it("refuses a missing Host header", () => {
    expect(isLoopbackHost(null)).toBe(false);
    expect(isLoopbackHost("")).toBe(false);
  });
});
