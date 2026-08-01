import { lstatSync, readlinkSync, realpathSync } from "node:fs";
import path from "node:path";
import { allow, deny, type PolicyDecision } from "../denial";

/**
 * Filesystem containment (ADR-006 "controlled repository paths").
 *
 * The rule this module enforces: every path a run touches must
 * *canonicalize* — with all symlinks resolved by the operating system —
 * to a location inside a declared root. Lexical checks alone are not
 * containment: `/root/link → /etc` passes any `startsWith` test while
 * pointing straight out of the sandbox, which is why resolution here is
 * physical rather than textual.
 *
 * Non-existent paths are legitimate (a run creating a new file must be
 * able to name it), so resolution proceeds to the deepest *existing*
 * ancestor, canonicalizes that with the OS, and re-appends the tail.
 * A component that does not exist cannot be a symlink, so the tail
 * needs no further resolution.
 */

/** Guards against symlink cycles; the kernel's own limit is in this range. */
const MAX_SYMLINK_HOPS = 40;

/**
 * Resolves a path to its physical location, tolerating a non-existent
 * tail. Returns `null` when resolution is impossible (a symlink cycle,
 * or a permission error that prevents us from *proving* containment —
 * unprovable containment is treated as no containment).
 */
export function canonicalizeExistingPrefix(absolutePath: string): string | null {
  let current = path.resolve(absolutePath);
  const tail: string[] = [];

  for (let hops = 0; hops <= MAX_SYMLINK_HOPS; hops += 1) {
    const resolved = tryRealpath(current);
    if (resolved !== null) {
      return tail.length === 0 ? resolved : path.join(resolved, ...tail);
    }

    // `current` does not fully resolve. If it is itself a dangling
    // symlink, follow it manually — a broken link still declares an
    // intended target, and that target is what containment must judge.
    const link = tryReadDanglingLink(current);
    if (link !== null) {
      current = path.isAbsolute(link) ? link : path.resolve(path.dirname(current), link);
      continue;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      // Walked all the way to the filesystem root without resolving.
      return null;
    }
    tail.unshift(path.basename(current));
    current = parent;
  }

  // Exceeded the symlink hop budget — treat as a cycle, deny.
  return null;
}

function tryRealpath(target: string): string | null {
  try {
    return realpathSync.native(target);
  } catch {
    return null;
  }
}

function tryRealpathDirectory(target: string): string | null {
  try {
    const resolved = realpathSync.native(target);
    return lstatSync(resolved).isDirectory() ? resolved : null;
  } catch {
    return null;
  }
}

function tryReadDanglingLink(target: string): string | null {
  try {
    if (!lstatSync(target).isSymbolicLink()) return null;
    return readlinkSync(target);
  } catch {
    return null;
  }
}

/** True when `candidate` is `root` itself or lies beneath it. */
export function isWithinRoot(root: string, candidate: string): boolean {
  if (candidate === root) return true;
  const relative = path.relative(root, candidate);
  return (
    relative !== "" &&
    !relative.startsWith("..") &&
    !path.isAbsolute(relative) &&
    !relative.split(path.sep).includes("..")
  );
}

/**
 * Canonicalizes each declared root once. A root that cannot be resolved
 * is fatal rather than skipped — silently dropping an unresolvable root
 * would quietly shrink the sandbox and could make a *later* comparison
 * pass against a different root than the operator declared.
 */
export function canonicalizeRoots(roots: readonly string[]): PolicyDecision<string[]> {
  const canonical: string[] = [];
  for (const root of roots) {
    if (!path.isAbsolute(root)) {
      return deny(
        "working_directory_not_declared",
        `Working-directory root must be an absolute path: ${root}`,
        root,
      );
    }
    // A root must physically exist as a directory. `canonicalizeExistingPrefix`
    // deliberately tolerates a non-existent tail (runs create files), but
    // tolerating it *here* would let a typo'd root silently canonicalize to
    // a plausible-looking path that bounds nothing.
    const resolved = tryRealpathDirectory(root);
    if (resolved === null) {
      return deny(
        "path_unresolvable",
        `Working-directory root does not resolve to an existing directory: ${root}`,
        root,
      );
    }
    canonical.push(resolved);
  }
  return allow(canonical);
}

export interface ContainmentContext {
  /** Already-canonicalized roots (see `canonicalizeRoots`). */
  canonicalRoots: readonly string[];
  /** The run's working directory — itself canonical and contained. */
  canonicalWorkingDirectory: string;
  /**
   * The roots exactly as the operator wrote them, before canonicalization.
   * Used only to classify *why* a path was refused: a path that looks
   * like it is inside a declared root but physically isn't was taken out
   * by a symlink, which is a materially different finding for an
   * operator than a path that plainly names somewhere else. Never used
   * to grant access.
   */
  declaredRoots?: readonly string[];
}

/**
 * The single containment decision every path in the system flows
 * through. Rejects, in order: lexical `..` traversal, unresolvable
 * paths, and anything whose physical location escapes every root.
 *
 * `..` is refused outright rather than normalized away. Normalizing
 * `a/../b` lexically is exactly the mistake that lets `link/../x`
 * resolve to somewhere the operator never authorized, because lexical
 * normalization and kernel resolution disagree the moment a symlink is
 * involved. A contained run never needs `..`, so refusing it costs
 * nothing and removes the whole class of disagreement.
 */
export function resolveContainedPath(
  context: ContainmentContext,
  candidate: string,
): PolicyDecision<string> {
  if (candidate.length === 0) {
    return deny("path_outside_root", "Empty path is not a valid contained path.", candidate);
  }

  if (candidate.includes("\0")) {
    return deny("path_traversal", "Path contains a NUL byte.", candidate);
  }

  const segments = candidate.split(/[\\/]/);
  if (segments.includes("..")) {
    return deny(
      "path_traversal",
      `Path contains a '..' traversal segment, which is never permitted: ${candidate}`,
      candidate,
    );
  }

  const absolute = path.isAbsolute(candidate)
    ? candidate
    : path.resolve(context.canonicalWorkingDirectory, candidate);

  const resolved = canonicalizeExistingPrefix(absolute);
  if (resolved === null) {
    return deny(
      "path_unresolvable",
      `Path could not be canonicalized, so containment cannot be proven: ${candidate}`,
      candidate,
    );
  }

  const containingRoot = context.canonicalRoots.find((root) => isWithinRoot(root, resolved));
  if (!containingRoot) {
    // Distinguish "the path itself points out" from "a symlink on the
    // way points out". Both are refused identically; only the recorded
    // reason differs, because an operator reading evidence needs to know
    // whether someone asked to leave the sandbox or planted a link
    // inside it.
    const lexical = path.resolve(absolute);
    const looksContained = [...context.canonicalRoots, ...(context.declaredRoots ?? [])].some(
      (root) => isWithinRoot(root, lexical),
    );

    return looksContained
      ? deny(
          "symlink_escape",
          `Path resolves through a symlink to a location outside every declared root: ${candidate}`,
          candidate,
        )
      : deny(
          "path_outside_root",
          `Path is outside every declared working-directory root: ${candidate}`,
          candidate,
        );
  }

  return allow(resolved);
}
