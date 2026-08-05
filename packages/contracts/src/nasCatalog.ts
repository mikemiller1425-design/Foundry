import { z } from "zod";
import { TimestampSchema } from "./common";

/**
 * Read-only NAS catalog contracts (Construction Package 1a).
 *
 * ## The safety decision this encodes
 *
 * **The Synology NAS is authoritative storage. Foundry indexes it and
 * never changes it.** No rename, no move, no delete, no in-place archive
 * extraction, no writes of any kind. That is not a default this package
 * chose politely — it is the operator's stated safety decision, and every
 * type here is shaped so the unsafe operation is *unrepresentable* rather
 * than merely discouraged. There is no `NasWriteCommand`, no destination
 * path field, and no extraction target anywhere in this module.
 *
 * ## Metadata-only, by construction
 *
 * A catalogued asset records its size, modification time, extension,
 * classification, and identity. **It does not record file contents**, and
 * the adapter that produces one never opens a file for reading beyond the
 * bytes a chosen hash strategy requires. A ZIP is classified as an archive
 * and left sealed; the catalog knows an archive exists and nothing about
 * what is inside it.
 *
 * ## Scanning is disabled until an operator gate
 *
 * These contracts describe what a scan *would* record. Package 1a wires no
 * scan of the operator's real NAS, and the adapter refuses to run against
 * a real root until `Package 2` opens that gate explicitly.
 */

// ---------------------------------------------------------------------------
// Material classification
// ---------------------------------------------------------------------------

/**
 * The material types the operator has identified on the NAS.
 *
 * `unsupported` is a first-class member rather than an absence: a catalog
 * that silently omitted files it did not understand would report coverage
 * it had not achieved. An unsupported file is *seen, classified, and
 * counted* — it is simply not interpreted.
 */
export const NasMaterialTypeSchema = z.enum([
  "image",
  "video",
  "markdown",
  "csv",
  "python",
  "zip",
  "unsupported",
]);
export type NasMaterialType = z.infer<typeof NasMaterialTypeSchema>;

/**
 * Extension → material type. Lower-case, leading dot included.
 *
 * Deliberately an explicit table rather than a pattern: a regular
 * expression that grew a `.*` would silently start classifying things
 * nobody reviewed. Adding a type is a reviewable diff.
 */
export const NAS_EXTENSION_MATERIAL: Readonly<Record<string, NasMaterialType>> = Object.freeze({
  ".jpg": "image",
  ".jpeg": "image",
  ".png": "image",
  ".gif": "image",
  ".webp": "image",
  ".heic": "image",
  ".tif": "image",
  ".tiff": "image",
  ".bmp": "image",
  ".mp4": "video",
  ".mov": "video",
  ".m4v": "video",
  ".avi": "video",
  ".mkv": "video",
  ".webm": "video",
  ".md": "markdown",
  ".markdown": "markdown",
  ".csv": "csv",
  ".py": "python",
  ".zip": "zip",
});

/** Classifies by extension alone. Never opens the file. */
export function classifyNasMaterial(fileName: string): NasMaterialType {
  const dot = fileName.lastIndexOf(".");
  if (dot <= 0) return "unsupported";
  return NAS_EXTENSION_MATERIAL[fileName.slice(dot).toLowerCase()] ?? "unsupported";
}

// ---------------------------------------------------------------------------
// Identity and hashing
// ---------------------------------------------------------------------------

/**
 * How an asset's content fingerprint was obtained, with the tradeoff each
 * choice makes. Recorded **on every asset**, so a later reader knows what
 * a fingerprint is worth rather than assuming the strongest option.
 *
 * | Strategy | Cost | What it detects | What it misses |
 * | --- | --- | --- | --- |
 * | `none` | zero I/O | nothing | everything — identity is path-based only |
 * | `size_mtime` | one `stat` | most edits | a same-size edit that preserves mtime; deliberate tampering |
 * | `sha256_head` | reads first N bytes | header/format changes, most truncations | edits past the sampled prefix |
 * | `sha256_full` | reads whole file | any content change | nothing, but costs a full read of every byte |
 *
 * **The default for a first NAS pass is `size_mtime`.** A multi-terabyte
 * volume of video cannot be fully hashed on every scan, and pretending
 * otherwise would produce a scan nobody ever finishes. `sha256_full` is
 * reserved for material that later analysis actually needs deduplicated,
 * chosen per-scan rather than globally.
 */
export const NasHashStrategySchema = z.enum(["none", "size_mtime", "sha256_head", "sha256_full"]);
export type NasHashStrategy = z.infer<typeof NasHashStrategySchema>;

/**
 * A catalogued asset. Metadata only.
 *
 * `sourcePath` is the evidence trail — a scan is worthless if it cannot
 * say which file it saw — but it is marked as sensitive-by-default so a
 * public surface renders `relativePath` instead. A directory tree is
 * itself information about the operator.
 */
export const NasAssetSchema = z
  .object({
    /** Stable across scans for an unchanged file at an unchanged path. */
    assetId: z.string().min(1),
    rootId: z.string().min(1),
    /** Path relative to the configured root. Safe for display. */
    relativePath: z.string().min(1),
    /**
     * Absolute canonical path. **Evidence, not display.** Retained so a
     * finding can be traced to a file; withheld from public UI because a
     * folder structure discloses more than the file it names.
     */
    sourcePath: z.string().min(1),
    fileName: z.string().min(1),
    extension: z.string(),
    materialType: NasMaterialTypeSchema,
    sizeBytes: z.number().int().nonnegative(),
    modifiedAt: TimestampSchema,
    hashStrategy: NasHashStrategySchema,
    /** `null` when the strategy is `none`, or when hashing was refused. */
    contentFingerprint: z.string().min(1).nullable(),
    /** True when the entry is an archive left deliberately sealed. */
    sealedArchive: z.boolean(),
  })
  .strict();
export type NasAsset = z.infer<typeof NasAssetSchema>;

// ---------------------------------------------------------------------------
// Coverage — the honest part
// ---------------------------------------------------------------------------

/**
 * What happened to one filesystem entry.
 *
 * Every entry the walk encounters lands in exactly one of these, and the
 * counts are reported. The failure this prevents is a catalog that says
 * "1,204 files indexed" while silently dropping the 300 it could not read
 * — which reads as complete coverage and is not.
 */
export const NasDispositionSchema = z.enum([
  /** Catalogued. */
  "scanned",
  /** Seen and classified, but its material type is not interpreted. */
  "skipped_unsupported",
  /** Refused on safety grounds: escapes the root, unsafe symlink, cycle. */
  "refused_unsafe",
  /** Permission denied, I/O error, or a malformed entry. */
  "inaccessible",
  /** A bound was reached — depth, entry count, time, or cancellation. */
  "not_yet_scanned",
]);
export type NasDisposition = z.infer<typeof NasDispositionSchema>;

export const NasRefusalSchema = z
  .object({
    /** Relative where possible; the root itself when nothing else is safe. */
    path: z.string().min(1),
    disposition: NasDispositionSchema,
    /** Operator-readable, and specific. Never "an error occurred". */
    reason: z.string().min(1),
  })
  .strict();
export type NasRefusal = z.infer<typeof NasRefusalSchema>;

/**
 * Coverage for one scan.
 *
 * **`complete` is false whenever anything was left unscanned**, and it is
 * computed rather than asserted, so a scan cannot claim completeness it
 * did not achieve. `notYetScanned > 0` alone makes it false.
 */
export const NasCoverageReportSchema = z
  .object({
    rootId: z.string().min(1),
    startedAt: TimestampSchema,
    completedAt: TimestampSchema,
    scanned: z.number().int().nonnegative(),
    skippedUnsupported: z.number().int().nonnegative(),
    refusedUnsafe: z.number().int().nonnegative(),
    inaccessible: z.number().int().nonnegative(),
    notYetScanned: z.number().int().nonnegative(),
    directoriesVisited: z.number().int().nonnegative(),
    /** True only when nothing was refused, inaccessible, or left over. */
    complete: z.boolean(),
    /** Why the walk stopped, when it stopped early. */
    stoppedReason: z
      .enum(["completed", "max_entries", "max_depth", "cancelled", "root_unavailable"])
      .optional(),
    /** Every refusal, individually. Counts alone are not accountability. */
    refusals: z.array(NasRefusalSchema),
    /** A cursor a later scan can resume from. */
    resumeCursor: z.string().min(1).nullable(),
  })
  .strict();
export type NasCoverageReport = z.infer<typeof NasCoverageReportSchema>;

/**
 * Computes `complete`, so it can never be asserted falsely.
 *
 * The stop reason is part of the answer, not decoration. A scan cancelled
 * before it examined anything has zero refusals and zero leftovers, and an
 * earlier version of this function called that **complete** — which is the
 * exact dishonesty the type exists to prevent. A walk that did not run to
 * the end has not covered the root, whatever its counters say.
 */
export function isCoverageComplete(
  counts: Pick<NasCoverageReport, "refusedUnsafe" | "inaccessible" | "notYetScanned"> & {
    stoppedReason?: NasCoverageReport["stoppedReason"];
  },
): boolean {
  const ranToCompletion =
    counts.stoppedReason === undefined || counts.stoppedReason === "completed";
  return (
    ranToCompletion &&
    counts.refusedUnsafe === 0 &&
    counts.inaccessible === 0 &&
    counts.notYetScanned === 0
  );
}

// ---------------------------------------------------------------------------
// Scan request — no caller-supplied path, ever
// ---------------------------------------------------------------------------

/**
 * A configured NAS root.
 *
 * Roots are **named in configuration and selected by id**. A caller
 * chooses *which* configured root to scan; it can never supply a path. A
 * path parameter would make "scan the NAS" and "traverse anywhere on this
 * machine" the same operation, distinguished only by the caller's manners.
 */
export const NasRootSchema = z
  .object({
    rootId: z.string().min(1),
    /** Human label for the operator. */
    label: z.string().min(1),
    /** Absolute path, from committed configuration. */
    absolutePath: z.string().min(1),
  })
  .strict();
export type NasRoot = z.infer<typeof NasRootSchema>;

export const NasScanBoundsSchema = z
  .object({
    /** Hard cap on entries examined. A walk always terminates. */
    maxEntries: z.number().int().positive().max(5_000_000).default(50_000),
    maxDepth: z.number().int().positive().max(64).default(24),
    /** Concurrent `stat` operations. Bounded so a NAS is not saturated. */
    concurrency: z.number().int().positive().max(32).default(4),
    maxFileSizeBytesToHash: z
      .number()
      .int()
      .positive()
      .max(64 * 1024 * 1024 * 1024)
      .default(256 * 1024 * 1024),
  })
  .strict();
export type NasScanBounds = z.infer<typeof NasScanBoundsSchema>;

export const NasScanRequestSchema = z
  .object({
    /** Selects a configured root. **Not a path.** */
    rootId: z.string().min(1),
    hashStrategy: NasHashStrategySchema.default("size_mtime"),
    /** Omitted means the declared defaults; each field has one. */
    bounds: NasScanBoundsSchema.optional(),
    /** Resume a previous partial scan. */
    resumeCursor: z.string().min(1).nullable().default(null),
  })
  .strict();
export type NasScanRequest = z.infer<typeof NasScanRequestSchema>;

export const NasScanResultSchema = z
  .object({
    assets: z.array(NasAssetSchema),
    coverage: NasCoverageReportSchema,
    /**
     * Always `true`. Present so a consumer reads the guarantee from the
     * value rather than from documentation it may not have read.
     */
    readOnly: z.literal(true),
    /** Always `false` — no archive is ever expanded. */
    archivesExtracted: z.literal(false),
  })
  .strict();
export type NasScanResult = z.infer<typeof NasScanResultSchema>;
