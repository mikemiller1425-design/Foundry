import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  canonicalizeRoots,
  isWithinRoot,
  resolveContainedPath,
  type ContainmentContext,
} from "./paths";

/**
 * Containment is the property everything else in this package rests on,
 * so these tests attack it directly rather than through the adapter.
 */
describe("path containment", () => {
  let sandbox: string;
  let root: string;
  let outside: string;
  let context: ContainmentContext;

  beforeAll(() => {
    // On macOS `/tmp` is itself a symlink to `/private/tmp`, so this
    // fixture exercises canonicalization of the *root* incidentally but
    // genuinely — a lexical implementation fails here immediately.
    sandbox = mkdtempSync(path.join(tmpdir(), "foundry-containment-"));
    root = path.join(sandbox, "root");
    outside = path.join(sandbox, "outside");
    mkdirSync(path.join(root, "src"), { recursive: true });
    mkdirSync(outside, { recursive: true });
    writeFileSync(path.join(root, "src", "inside.txt"), "inside");
    writeFileSync(path.join(outside, "secret.txt"), "secret");

    symlinkSync(outside, path.join(root, "escape-dir"));
    symlinkSync(path.join(outside, "secret.txt"), path.join(root, "escape-file"));
    symlinkSync(path.join(outside, "missing.txt"), path.join(root, "dangling-escape"));
    symlinkSync(path.join(root, "src"), path.join(root, "internal-link"));

    const canonical = canonicalizeRoots([root]);
    if (!canonical.allowed) throw new Error("fixture roots must canonicalize");
    const canonicalRoot = canonical.value[0];
    if (canonicalRoot === undefined) throw new Error("fixture root missing");
    context = {
      canonicalRoots: canonical.value,
      canonicalWorkingDirectory: canonicalRoot,
      declaredRoots: [root],
    };
  });

  afterAll(() => {
    rmSync(sandbox, { recursive: true, force: true });
  });

  it("allows a relative path inside the root", () => {
    const decision = resolveContainedPath(context, "src/inside.txt");
    expect(decision.allowed).toBe(true);
    if (decision.allowed) {
      expect(decision.value.endsWith(path.join("root", "src", "inside.txt"))).toBe(true);
    }
  });

  it("allows a not-yet-existing file inside the root (a run must be able to create files)", () => {
    const decision = resolveContainedPath(context, "src/created-later.ts");
    expect(decision.allowed).toBe(true);
  });

  it("allows an absolute path that is inside the root", () => {
    const decision = resolveContainedPath(context, path.join(root, "src", "inside.txt"));
    expect(decision.allowed).toBe(true);
  });

  it("denies an absolute path outside the root", () => {
    const decision = resolveContainedPath(context, path.join(outside, "secret.txt"));
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("path_outside_root");
  });

  it("denies an absolute path to a sensitive system location", () => {
    const decision = resolveContainedPath(context, "/etc/passwd");
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("path_outside_root");
  });

  it("denies a relative path that escapes via '..'", () => {
    const decision = resolveContainedPath(context, "../outside/secret.txt");
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("path_traversal");
  });

  it("denies '..' even when it would resolve back inside the root", () => {
    // Refused on sight rather than normalized: lexical normalization and
    // kernel resolution disagree once a symlink is involved, so the
    // segment is never permitted regardless of where it appears to land.
    const decision = resolveContainedPath(context, "src/../src/inside.txt");
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("path_traversal");
  });

  it("denies a deeply nested '..' escape", () => {
    const decision = resolveContainedPath(context, "src/a/b/../../../../etc/passwd");
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("path_traversal");
  });

  it("denies traversal to a symlinked directory that escapes the root", () => {
    const decision = resolveContainedPath(context, "escape-dir/secret.txt");
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("symlink_escape");
  });

  it("denies a symlinked file that escapes the root", () => {
    const decision = resolveContainedPath(context, "escape-file");
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("symlink_escape");
  });

  it("denies a dangling symlink whose target is outside the root", () => {
    // A broken link still declares an intended destination. Treating it
    // as "doesn't exist, therefore harmless" would let a run create the
    // target and land outside the sandbox on the next attempt.
    const decision = resolveContainedPath(context, "dangling-escape");
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("symlink_escape");
  });

  it("denies writing through an escaping symlinked directory to a new file", () => {
    const decision = resolveContainedPath(context, "escape-dir/newly-created.txt");
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("symlink_escape");
  });

  it("allows a symlink that stays inside the root", () => {
    const decision = resolveContainedPath(context, "internal-link/inside.txt");
    expect(decision.allowed).toBe(true);
  });

  it("denies a path containing a NUL byte", () => {
    const decision = resolveContainedPath(context, "src/inside.txt\0.png");
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("path_traversal");
  });

  it("denies an empty path", () => {
    expect(resolveContainedPath(context, "").allowed).toBe(false);
  });

  it("rejects a relative root declaration", () => {
    const decision = canonicalizeRoots(["relative/root"]);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("working_directory_not_declared");
  });

  it("rejects an unresolvable root rather than silently dropping it", () => {
    const decision = canonicalizeRoots([path.join(sandbox, "does-not-exist")]);
    expect(decision.allowed).toBe(false);
    if (!decision.allowed) expect(decision.denial.code).toBe("path_unresolvable");
  });

  it("isWithinRoot treats the root itself as contained but a sibling prefix as not", () => {
    expect(isWithinRoot("/a/root", "/a/root")).toBe(true);
    expect(isWithinRoot("/a/root", "/a/root/child")).toBe(true);
    // The classic prefix bug: "/a/root-elsewhere" starts with "/a/root".
    expect(isWithinRoot("/a/root", "/a/root-elsewhere")).toBe(false);
  });
});
