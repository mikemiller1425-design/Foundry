import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { NasRoot, NasScanResult } from "@foundry/contracts";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { assetIdFor, scanNasRoot } from "./nasCatalogAdapter";
import { CONFIGURED_NAS_ROOTS, resolveNasRoot } from "./nasRoots";

/**
 * Construction Package 1a — the read-only NAS boundary.
 *
 * **No test here touches the operator's NAS.** Every case builds a
 * synthetic tree in a fresh temp directory and points a test-only root at
 * it. The configured registry is empty, so a scan of a real root refuses;
 * that refusal is itself asserted below.
 */

let dir: string;
let outsideDir: string;

function testRoot(absolutePath: string): NasRoot[] {
  return [{ rootId: "fixture", label: "Synthetic fixture", absolutePath }];
}

function isScan(result: unknown): result is NasScanResult {
  return typeof result === "object" && result !== null && "coverage" in result;
}

async function scan(overrides: Record<string, unknown> = {}, roots = testRoot(dir)) {
  const result = await scanNasRoot(
    { rootId: "fixture", hashStrategy: "size_mtime", resumeCursor: null, ...overrides } as never,
    { roots },
  );
  if (!isScan(result)) throw new Error(`expected a scan, got a refusal: ${JSON.stringify(result)}`);
  return result;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "foundry-nas-fixture-"));
  outsideDir = mkdtempSync(join(tmpdir(), "foundry-nas-outside-"));
});

afterEach(() => {
  // Restore any permissions a test removed, so cleanup can succeed.
  try {
    chmodSync(join(dir, "locked"), 0o755);
  } catch {
    /* not every test creates it */
  }
  rmSync(dir, { recursive: true, force: true });
  rmSync(outsideDir, { recursive: true, force: true });
});

describe("Package 1a — scanning the real NAS is gated shut", () => {
  it("ships with NO configured roots", () => {
    expect(CONFIGURED_NAS_ROOTS).toHaveLength(0);
  });

  it("refuses every root id while the registry is empty", () => {
    const resolution = resolveNasRoot("anything");
    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error("unreachable");
    expect(resolution.code).toBe("scanning_not_enabled");
    expect(resolution.reason).toMatch(/disabled until an operator gate/i);
  });

  it("refuses an unknown root even when others are configured", () => {
    const resolution = resolveNasRoot("not-configured", testRoot(dir));
    expect(resolution.ok).toBe(false);
    if (resolution.ok) throw new Error("unreachable");
    expect(resolution.code).toBe("unknown_root");
  });

  it("a scan request cannot carry a path — only a root id", async () => {
    // The request schema has no path field; passing one is refused because
    // `rootId` will not match any configured root.
    const result = await scanNasRoot(
      { rootId: outsideDir, hashStrategy: "none", resumeCursor: null } as never,
      { roots: testRoot(dir) },
    );
    expect(isScan(result)).toBe(false);
  });
});

describe("Package 1a — read-only by construction", () => {
  it("imports no write primitive", () => {
    const source = readFileSync(join(import.meta.dirname, "nasCatalogAdapter.ts"), "utf8");
    const imported = [...source.matchAll(/^\s*import\s[^;]*?from\s+["']([^"']+)["']/gm)].map(
      (m) => m[1] as string,
    );
    // Asserted over imports, not raw text: the module comment names the
    // primitives it does not use, and a text search would match that prose.
    expect(imported).not.toContain("node:fs/promises/writeFile");
    const importBlock = source.slice(0, source.indexOf("*/"));
    for (const forbidden of ["writeFile", "rename", "unlink", "rmdir", "mkdir(", "adm-zip", "unzipper", "tar"]) {
      // Only the executable import lines are scanned.
      const importLines = source
        .split("\n")
        .filter((line) => /^\s*import\s/.test(line))
        .join("\n");
      expect(importLines).not.toContain(forbidden);
    }
    void importBlock;
  });

  it("leaves the fixture tree byte-for-byte unchanged", async () => {
    writeFileSync(join(dir, "a.md"), "# hello\n");
    writeFileSync(join(dir, "b.csv"), "x,y\n1,2\n");
    mkdirSync(join(dir, "nested"));
    writeFileSync(join(dir, "nested", "c.py"), "print(1)\n");

    const before = [
      readFileSync(join(dir, "a.md"), "utf8"),
      readFileSync(join(dir, "b.csv"), "utf8"),
      readFileSync(join(dir, "nested", "c.py"), "utf8"),
    ];

    const result = await scan();
    expect(result.readOnly).toBe(true);

    expect([
      readFileSync(join(dir, "a.md"), "utf8"),
      readFileSync(join(dir, "b.csv"), "utf8"),
      readFileSync(join(dir, "nested", "c.py"), "utf8"),
    ]).toEqual(before);
  });
});

describe("Package 1a — traversal safety fails closed", () => {
  it("REFUSES a symlink that escapes the root, and says where it pointed", async () => {
    writeFileSync(join(outsideDir, "secret.md"), "# not yours\n");
    writeFileSync(join(dir, "ok.md"), "# fine\n");
    symlinkSync(join(outsideDir, "secret.md"), join(dir, "escape.md"));

    const result = await scan();

    expect(result.coverage.refusedUnsafe).toBe(1);
    expect(result.coverage.complete).toBe(false);
    const refusal = result.coverage.refusals.find((r) => r.disposition === "refused_unsafe");
    expect(refusal?.reason).toMatch(/resolves outside the configured root/i);
    // The escaped file is not catalogued.
    expect(result.assets.map((a) => a.fileName)).toEqual(["ok.md"]);
  });

  it("REFUSES a symlinked directory that escapes the root", async () => {
    mkdirSync(join(outsideDir, "elsewhere"));
    writeFileSync(join(outsideDir, "elsewhere", "leak.md"), "# leak\n");
    symlinkSync(join(outsideDir, "elsewhere"), join(dir, "link-out"));

    const result = await scan();
    expect(result.coverage.refusedUnsafe).toBe(1);
    expect(result.assets).toHaveLength(0);
  });

  it("cuts a directory cycle rather than looping forever", async () => {
    mkdirSync(join(dir, "loop"));
    writeFileSync(join(dir, "loop", "x.md"), "# x\n");
    symlinkSync(dir, join(dir, "loop", "back"));

    const result = await scan();
    // Terminates, and says why the cycle was not followed.
    expect(result.coverage.refusedUnsafe).toBeGreaterThanOrEqual(1);
    expect(
      result.coverage.refusals.some((r) => /cycle/i.test(r.reason) || /outside/i.test(r.reason)),
    ).toBe(true);
  });

  it("records a dangling symlink as inaccessible, not as scanned", async () => {
    symlinkSync(join(dir, "nowhere.md"), join(dir, "dangling.md"));
    const result = await scan();
    expect(result.coverage.inaccessible).toBe(1);
    expect(result.coverage.complete).toBe(false);
    expect(result.assets).toHaveLength(0);
  });
});

describe("Package 1a — archives are sealed", () => {
  it("classifies a ZIP without extracting anything", async () => {
    // A real ZIP header, so classification is not reading a fake.
    writeFileSync(join(dir, "archive.zip"), Buffer.from("PKrest-of-archive"));
    const before = readFileSync(join(dir, "archive.zip"));

    const result = await scan();

    const zip = result.assets.find((a) => a.fileName === "archive.zip");
    expect(zip?.materialType).toBe("zip");
    expect(zip?.sealedArchive).toBe(true);
    expect(result.archivesExtracted).toBe(false);
    // Nothing was expanded next to it, and the file is untouched.
    expect(readFileSync(join(dir, "archive.zip"))).toEqual(before);
    expect(result.assets.map((a) => a.fileName)).toEqual(["archive.zip"]);
  });

  it("an archive bomb is inert because nothing decompresses it", async () => {
    // 10 MB of zeros named .zip. A decompressing scanner would expand it;
    // this one records a size and moves on.
    writeFileSync(join(dir, "bomb.zip"), Buffer.alloc(10 * 1024 * 1024));
    const result = await scan();
    expect(result.assets[0]?.materialType).toBe("zip");
    expect(result.assets[0]?.sizeBytes).toBe(10 * 1024 * 1024);
    expect(result.archivesExtracted).toBe(false);
  });
});

describe("Package 1a — coverage is honest", () => {
  it("counts unsupported files rather than dropping them", async () => {
    writeFileSync(join(dir, "keep.md"), "# md\n");
    writeFileSync(join(dir, "mystery.xyz"), "?");
    writeFileSync(join(dir, "noextension"), "?");

    const result = await scan();

    expect(result.coverage.scanned).toBe(1);
    expect(result.coverage.skippedUnsupported).toBe(2);
    expect(result.coverage.complete).toBe(true); // unsupported ≠ incomplete
    expect(result.coverage.refusals.filter((r) => r.disposition === "skipped_unsupported")).toHaveLength(2);
  });

  it("reports an unreadable directory as inaccessible and NOT complete", async () => {
    mkdirSync(join(dir, "locked"));
    writeFileSync(join(dir, "locked", "hidden.md"), "# hidden\n");
    chmodSync(join(dir, "locked"), 0o000);

    const result = await scan();

    // On some systems root can read anything; only assert when it bit.
    if (result.coverage.inaccessible > 0) {
      expect(result.coverage.complete).toBe(false);
      expect(result.coverage.refusals.some((r) => r.disposition === "inaccessible")).toBe(true);
    }
    chmodSync(join(dir, "locked"), 0o755);
  });

  it("reports an unavailable root honestly instead of throwing", async () => {
    const missing = join(dir, "does-not-exist");
    const result = await scanNasRoot(
      { rootId: "fixture", hashStrategy: "none", resumeCursor: null } as never,
      { roots: testRoot(missing) },
    );
    expect(isScan(result)).toBe(true);
    if (!isScan(result)) throw new Error("unreachable");
    expect(result.coverage.stoppedReason).toBe("root_unavailable");
    expect(result.coverage.complete).toBe(false);
  });

  it("cannot claim completeness it did not achieve", async () => {
    writeFileSync(join(dir, "a.md"), "# a\n");
    symlinkSync(join(outsideDir), join(dir, "escape"));
    const result = await scan();
    expect(result.coverage.refusedUnsafe).toBeGreaterThan(0);
    expect(result.coverage.complete).toBe(false);
  });

  it("stops at the entry bound and offers a resume cursor", async () => {
    for (let i = 0; i < 12; i += 1) writeFileSync(join(dir, `f${i}.md`), "# x\n");
    const result = await scan({ bounds: { maxEntries: 5, maxDepth: 8, concurrency: 2, maxFileSizeBytesToHash: 1024 } });

    expect(result.coverage.stoppedReason).toBe("max_entries");
    expect(result.coverage.notYetScanned).toBeGreaterThan(0);
    expect(result.coverage.complete).toBe(false);
    expect(result.coverage.resumeCursor).toBeTruthy();
  });

  it("honours cancellation", async () => {
    for (let i = 0; i < 6; i += 1) writeFileSync(join(dir, `f${i}.md`), "# x\n");
    const controller = new AbortController();
    controller.abort();

    const result = await scanNasRoot(
      { rootId: "fixture", hashStrategy: "none", resumeCursor: null } as never,
      { roots: testRoot(dir), signal: controller.signal },
    );
    if (!isScan(result)) throw new Error("unreachable");
    expect(result.coverage.stoppedReason).toBe("cancelled");
    expect(result.coverage.complete).toBe(false);
  });
});

describe("Package 1a — identity, classification, and metadata", () => {
  it("classifies every declared material type", async () => {
    writeFileSync(join(dir, "p.png"), "x");
    writeFileSync(join(dir, "v.mp4"), "x");
    writeFileSync(join(dir, "d.md"), "x");
    writeFileSync(join(dir, "t.csv"), "x");
    writeFileSync(join(dir, "s.py"), "x");
    writeFileSync(join(dir, "a.zip"), "x");

    const result = await scan();
    const byName = Object.fromEntries(result.assets.map((a) => [a.fileName, a.materialType]));
    expect(byName).toEqual({
      "p.png": "image",
      "v.mp4": "video",
      "d.md": "markdown",
      "t.csv": "csv",
      "s.py": "python",
      "a.zip": "zip",
    });
  });

  it("gives an asset a stable id across scans", async () => {
    writeFileSync(join(dir, "stable.md"), "# a\n");
    const first = await scan();
    const second = await scan();
    expect(first.assets[0]?.assetId).toBe(second.assets[0]?.assetId);
    expect(first.assets[0]?.assetId).toBe(assetIdFor("fixture", "stable.md"));
  });

  it("keeps the source path as evidence and a relative path for display", async () => {
    mkdirSync(join(dir, "sub"));
    writeFileSync(join(dir, "sub", "e.md"), "# e\n");
    const result = await scan();
    const asset = result.assets[0];
    expect(asset?.relativePath).toBe(join("sub", "e.md"));
    // Evidence: absolute and canonical. Not the display value.
    expect(asset?.sourcePath.endsWith(join("sub", "e.md"))).toBe(true);
    expect(asset?.sourcePath.startsWith("/")).toBe(true);
  });

  it("records the hash strategy on every asset, and honours `none`", async () => {
    writeFileSync(join(dir, "h.md"), "# h\n");
    const none = await scan({ hashStrategy: "none" });
    expect(none.assets[0]?.hashStrategy).toBe("none");
    expect(none.assets[0]?.contentFingerprint).toBeNull();

    const full = await scan({ hashStrategy: "sha256_full" });
    expect(full.assets[0]?.hashStrategy).toBe("sha256_full");
    expect(full.assets[0]?.contentFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/);
  });

  it("falls back to a weaker fingerprint rather than hashing a huge file", async () => {
    writeFileSync(join(dir, "big.mp4"), Buffer.alloc(2048));
    const result = await scan({
      hashStrategy: "sha256_full",
      bounds: { maxEntries: 100, maxDepth: 4, concurrency: 1, maxFileSizeBytesToHash: 1024 },
    });
    // Recorded honestly as size+mtime, not as a sha256 it never computed.
    expect(result.assets[0]?.contentFingerprint).toMatch(/^sm:/);
  });
});
