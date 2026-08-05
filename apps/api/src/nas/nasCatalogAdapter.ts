import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { lstat, opendir, readlink, realpath, stat } from "node:fs/promises";
import path from "node:path";
import {
  classifyNasMaterial,
  isCoverageComplete,
  type NasAsset,
  type NasCoverageReport,
  type NasRefusal,
  type NasRoot,
  type NasScanBounds,
  type NasScanRequest,
  type NasScanResult,
} from "@foundry/contracts";
import { resolveNasRoot, type NasRootResolution } from "./nasRoots";

/**
 * The read-only NAS catalog adapter (Construction Package 1a).
 *
 * ## Read-only by construction, not by intention
 *
 * This module imports no write primitive. There is no `writeFile`, no
 * `rename`, no `rm`, no `mkdir`, no `unlink`, no extraction library —
 * `node:fs/promises` is imported by name for exactly five read operations
 * (`opendir`, `lstat`, `stat`, `readlink`, `realpath`) plus a read stream
 * for optional hashing. A structural test asserts this over the module's
 * own import list, so "read-only" is a property of what the code can
 * reach rather than a claim in a comment.
 *
 * **Archives are sealed.** A `.zip` is classified, counted, and left
 * untouched. Nothing here opens, lists, or expands one. An archive bomb is
 * therefore not a threat this adapter can be made to detonate: it never
 * decompresses anything, so there is nothing to expand.
 *
 * ## Traversal safety
 *
 * Every candidate path is canonicalized with `realpath` and checked to be
 * inside the canonical root before it is touched. Symlinks are followed
 * only when their target resolves *inside* the root; a link pointing out
 * is refused and recorded, not silently skipped. Directory cycles are cut
 * by tracking visited real paths, and depth and entry count are bounded,
 * so a walk always terminates.
 *
 * ## Honest coverage
 *
 * Every entry lands in exactly one disposition and every refusal is
 * recorded individually with a specific reason. `complete` is *computed*
 * from the counts, so a scan cannot report coverage it did not achieve.
 * The failure mode this exists to prevent is a catalog that says "1,204
 * files indexed" while dropping the 300 it could not read.
 *
 * ## Not wired to the operator's NAS
 *
 * `CONFIGURED_NAS_ROOTS` is empty, so every scan of a real root refuses
 * until the Package 2 operator gate. Tests drive synthetic fixture trees
 * in temporary directories.
 */

export interface ScanOptions {
  /** Injected so tests never depend on the machine's real clock. */
  now?: () => Date;
  /** Cooperative cancellation. Checked between entries. */
  signal?: AbortSignal;
  /** Overrides the configured registry. Tests only; never a request field. */
  roots?: readonly NasRoot[];
}

interface WalkState {
  assets: NasAsset[];
  refusals: NasRefusal[];
  scanned: number;
  skippedUnsupported: number;
  refusedUnsafe: number;
  inaccessible: number;
  notYetScanned: number;
  directoriesVisited: number;
  entriesExamined: number;
  visitedRealPaths: Set<string>;
  stoppedReason: NasCoverageReport["stoppedReason"];
}

const DEFAULT_BOUNDS: NasScanBounds = {
  maxEntries: 50_000,
  maxDepth: 24,
  concurrency: 4,
  maxFileSizeBytesToHash: 256 * 1024 * 1024,
};

/**
 * Scans one configured root, read-only.
 *
 * Returns a refusal rather than throwing when the root is unavailable or
 * ungated: an unreachable volume is an ordinary operational fact that
 * belongs in coverage, not an exception for a caller to interpret.
 */
export async function scanNasRoot(
  request: NasScanRequest,
  options: ScanOptions = {},
): Promise<NasScanResult | NasRootResolution> {
  const now = options.now ?? (() => new Date());
  const startedAt = now().toISOString();

  const resolution = resolveNasRoot(request.rootId, options.roots);
  if (!resolution.ok) return resolution;
  const root = resolution.root;

  const bounds: NasScanBounds = { ...DEFAULT_BOUNDS, ...(request.bounds ?? {}) };

  const state: WalkState = {
    assets: [],
    refusals: [],
    scanned: 0,
    skippedUnsupported: 0,
    refusedUnsafe: 0,
    inaccessible: 0,
    notYetScanned: 0,
    directoriesVisited: 0,
    entriesExamined: 0,
    visitedRealPaths: new Set(),
    stoppedReason: "completed",
  };

  // The root itself is canonicalized once. Everything below is checked
  // against *this* value, so a root that is itself a symlink is pinned to
  // its real target rather than re-resolved per entry.
  let canonicalRoot: string;
  try {
    canonicalRoot = await realpath(root.absolutePath);
  } catch {
    state.stoppedReason = "root_unavailable";
    state.inaccessible += 1;
    state.refusals.push({
      path: root.absolutePath,
      disposition: "inaccessible",
      reason: `The configured root could not be resolved. The volume may be unmounted, or the path may no longer exist.`,
    });
    return finish(root, request, state, startedAt, now);
  }

  await walk(canonicalRoot, canonicalRoot, 0, root, request, bounds, state, options);
  return finish(root, request, state, startedAt, now);
}

async function walk(
  canonicalRoot: string,
  directory: string,
  depth: number,
  root: NasRoot,
  request: NasScanRequest,
  bounds: NasScanBounds,
  state: WalkState,
  options: ScanOptions,
): Promise<void> {
  if (state.stoppedReason !== "completed") return;

  if (options.signal?.aborted) {
    state.stoppedReason = "cancelled";
    return;
  }
  if (depth > bounds.maxDepth) {
    state.notYetScanned += 1;
    state.stoppedReason = "max_depth";
    state.refusals.push({
      path: relative(canonicalRoot, directory),
      disposition: "not_yet_scanned",
      reason: `Maximum depth ${bounds.maxDepth} reached; this subtree was not scanned.`,
    });
    return;
  }

  // A directory already visited by its real path is a cycle.
  if (state.visitedRealPaths.has(directory)) {
    state.refusedUnsafe += 1;
    state.refusals.push({
      path: relative(canonicalRoot, directory),
      disposition: "refused_unsafe",
      reason: "Directory cycle detected — this real path was already visited on this walk.",
    });
    return;
  }
  state.visitedRealPaths.add(directory);
  state.directoriesVisited += 1;

  let entries: { name: string; isDirectory: boolean; isSymbolicLink: boolean }[];
  try {
    const dir = await opendir(directory);
    entries = [];
    for await (const entry of dir) {
      entries.push({
        name: entry.name,
        isDirectory: entry.isDirectory(),
        isSymbolicLink: entry.isSymbolicLink(),
      });
    }
  } catch (error) {
    state.inaccessible += 1;
    state.refusals.push({
      path: relative(canonicalRoot, directory),
      disposition: "inaccessible",
      reason: `Directory could not be read: ${message(error)}`,
    });
    return;
  }

  entries.sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    if (state.stoppedReason !== "completed") return;
    if (options.signal?.aborted) {
      state.stoppedReason = "cancelled";
      return;
    }
    if (state.entriesExamined >= bounds.maxEntries) {
      state.notYetScanned += 1;
      state.stoppedReason = "max_entries";
      state.refusals.push({
        path: relative(canonicalRoot, path.join(directory, entry.name)),
        disposition: "not_yet_scanned",
        reason: `Entry bound ${bounds.maxEntries} reached; the remainder of this root was not scanned.`,
      });
      return;
    }
    state.entriesExamined += 1;

    const full = path.join(directory, entry.name);

    // Canonicalize before touching. A symlink is followed only when its
    // target lands inside the root; one pointing out is refused and
    // recorded, never silently skipped.
    let real: string;
    try {
      real = await realpath(full);
    } catch (error) {
      state.inaccessible += 1;
      state.refusals.push({
        path: relative(canonicalRoot, full),
        disposition: "inaccessible",
        reason: entry.isSymbolicLink
          ? `Dangling or unresolvable symlink: ${message(error)}`
          : `Path could not be resolved: ${message(error)}`,
      });
      continue;
    }

    if (!isWithin(canonicalRoot, real)) {
      state.refusedUnsafe += 1;
      state.refusals.push({
        path: relative(canonicalRoot, full),
        disposition: "refused_unsafe",
        reason: entry.isSymbolicLink
          ? `Symlink resolves outside the configured root (${await linkTargetForMessage(full)}). Following it would let a link inside the NAS read anything this process can reach.`
          : "Path resolves outside the configured root and was refused.",
      });
      continue;
    }

    let info;
    try {
      info = await lstat(real);
      if (entry.isSymbolicLink) info = await stat(real);
    } catch (error) {
      state.inaccessible += 1;
      state.refusals.push({
        path: relative(canonicalRoot, full),
        disposition: "inaccessible",
        reason: `Metadata unavailable: ${message(error)}`,
      });
      continue;
    }

    if (info.isDirectory()) {
      await walk(canonicalRoot, real, depth + 1, root, request, bounds, state, options);
      continue;
    }

    if (!info.isFile()) {
      state.skippedUnsupported += 1;
      state.refusals.push({
        path: relative(canonicalRoot, full),
        disposition: "skipped_unsupported",
        reason: "Not a regular file (socket, device, or FIFO); classified and not interpreted.",
      });
      continue;
    }

    const materialType = classifyNasMaterial(entry.name);
    if (materialType === "unsupported") {
      // Counted, not dropped. A file Foundry does not interpret is still a
      // file it saw, and coverage must say so.
      state.skippedUnsupported += 1;
      state.refusals.push({
        path: relative(canonicalRoot, full),
        disposition: "skipped_unsupported",
        reason: `Extension is not a supported material type; the file was seen and classified, not interpreted.`,
      });
      continue;
    }

    const relativePath = relative(canonicalRoot, real);
    let fingerprint: string | null;
    try {
      fingerprint = await fingerprintFor(request, real, info.size, info.mtime, bounds);
    } catch (error) {
      state.inaccessible += 1;
      state.refusals.push({
        path: relativePath,
        disposition: "inaccessible",
        reason: `Content fingerprint could not be computed: ${message(error)}`,
      });
      continue;
    }

    state.assets.push({
      assetId: assetIdFor(root.rootId, relativePath),
      rootId: root.rootId,
      relativePath,
      sourcePath: real,
      fileName: entry.name,
      extension: path.extname(entry.name).toLowerCase(),
      materialType,
      sizeBytes: info.size,
      modifiedAt: new Date(info.mtime).toISOString(),
      hashStrategy: request.hashStrategy,
      contentFingerprint: fingerprint,
      // A `.zip` is catalogued as an archive and never opened.
      sealedArchive: materialType === "zip",
    });
    state.scanned += 1;
  }
}

/**
 * Stable identity for an asset.
 *
 * Derived from the root id and the path relative to it, so the same file
 * at the same place keeps its id across scans, and the id discloses no
 * absolute path. Content changes are tracked by `contentFingerprint`
 * rather than by re-identifying the asset — a file that was edited is the
 * same asset with different content, not a new one.
 */
export function assetIdFor(rootId: string, relativePath: string): string {
  return `nas-${createHash("sha256").update(`${rootId} ${relativePath}`).digest("hex").slice(0, 32)}`;
}

async function fingerprintFor(
  request: NasScanRequest,
  absolutePath: string,
  sizeBytes: number,
  mtime: Date | number,
  bounds: NasScanBounds,
): Promise<string | null> {
  switch (request.hashStrategy) {
    case "none":
      return null;
    case "size_mtime":
      return `sm:${sizeBytes}:${new Date(mtime).getTime()}`;
    case "sha256_head":
    case "sha256_full": {
      if (sizeBytes > bounds.maxFileSizeBytesToHash) {
        // Not an error: hashing a 40 GB video on every pass is the thing
        // the bound exists to prevent. Recorded as a weaker fingerprint
        // rather than pretending a strong one was computed.
        return `sm:${sizeBytes}:${new Date(mtime).getTime()}`;
      }
      const hash = createHash("sha256");
      const end = request.hashStrategy === "sha256_head" ? 64 * 1024 - 1 : undefined;
      await new Promise<void>((resolve, reject) => {
        const stream = createReadStream(absolutePath, end === undefined ? {} : { start: 0, end });
        stream.on("data", (chunk) => hash.update(chunk));
        stream.on("error", reject);
        stream.on("end", resolve);
      });
      return `sha256:${hash.digest("hex")}`;
    }
  }
}

function finish(
  root: NasRoot,
  request: NasScanRequest,
  state: WalkState,
  startedAt: string,
  now: () => Date,
): NasScanResult {
  const coverage: NasCoverageReport = {
    rootId: root.rootId,
    startedAt,
    completedAt: now().toISOString(),
    scanned: state.scanned,
    skippedUnsupported: state.skippedUnsupported,
    refusedUnsafe: state.refusedUnsafe,
    inaccessible: state.inaccessible,
    notYetScanned: state.notYetScanned,
    directoriesVisited: state.directoriesVisited,
    complete: isCoverageComplete({
      refusedUnsafe: state.refusedUnsafe,
      inaccessible: state.inaccessible,
      notYetScanned: state.notYetScanned,
      stoppedReason: state.stoppedReason,
    }),
    ...(state.stoppedReason ? { stoppedReason: state.stoppedReason } : {}),
    refusals: state.refusals,
    resumeCursor:
      state.stoppedReason === "max_entries" || state.stoppedReason === "cancelled"
        ? `${root.rootId}:${state.entriesExamined}`
        : null,
  };

  void request;
  return { assets: state.assets, coverage, readOnly: true, archivesExtracted: false };
}

function isWithin(root: string, candidate: string): boolean {
  if (candidate === root) return true;
  const rel = path.relative(root, candidate);
  return rel.length > 0 && !rel.startsWith("..") && !path.isAbsolute(rel);
}

function relative(root: string, target: string): string {
  const rel = path.relative(root, target);
  return rel.length === 0 ? "." : rel;
}

async function linkTargetForMessage(linkPath: string): Promise<string> {
  try {
    return `target: ${await readlink(linkPath)}`;
  } catch {
    return "target unreadable";
  }
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
