import { createHash } from "node:crypto";
import { readFileSync, statSync } from "node:fs";
import path from "node:path";

/**
 * Identity of the executable a controlled run would invoke (AC-111, H-5).
 *
 * ## Why this exists
 *
 * The policy allowlist pins an **absolute path**, and `executableSearchPath`
 * is empty so a bare name can never be resolved through `PATH`. That closes
 * the classic hole. But the path itself came from configuration, and the
 * evidence recorded only the path *string* — so it could answer "what was
 * named" and not "what actually ran".
 *
 * A path is not an identity. The file at that path can be replaced between
 * one run and the next, by an upgrade, a reinstall, or anything else with
 * write access, and nothing in the previous design would notice.
 *
 * ## Computed without executing anything
 *
 * Every field here is obtained by **reading files**. Nothing is spawned —
 * not even `--version`, which the operator explicitly prohibited for this
 * rung and which would in any case be the runtime reporting on itself.
 * Version identity is instead read from the nearest `package.json`, which
 * is a fact about what is installed rather than a claim the program makes.
 *
 * ## Fail closed
 *
 * `assertExpectedBinary` refuses when the pin is absent, when the file
 * cannot be read, and when the hash disagrees. There is no
 * "unpinned means allow" branch: an unverifiable binary is a refusal, not
 * a warning, because the whole point is to make substitution detectable
 * before money is spent rather than after.
 */

export interface BinaryIdentity {
  absolutePath: string;
  sha256: string;
  sizeBytes: number;
  /** From the nearest `package.json`. Absent when none could be read. */
  packageName?: string;
  packageVersion?: string;
  /** How the version was obtained, so a reader knows it was not executed. */
  identitySource: "package.json" | "unavailable";
}

/**
 * Reads the executable and derives its identity.
 *
 * The hash is streamed in one read. The binary is ~270 MB, which is a
 * measurable but bounded cost paid once per dispatch — cheaper by orders
 * of magnitude than the model call it guards, and it happens before any
 * spend rather than after.
 */
export function readBinaryIdentity(absolutePath: string): BinaryIdentity {
  const stat = statSync(absolutePath);
  if (!stat.isFile()) {
    throw new Error(`Executable path is not a regular file: ${absolutePath}`);
  }

  const contents = readFileSync(absolutePath);
  const sha256 = createHash("sha256").update(contents).digest("hex");

  const pkg = readNearestPackageJson(absolutePath);

  return {
    absolutePath,
    sha256,
    sizeBytes: stat.size,
    ...(pkg ? { packageName: pkg.name, packageVersion: pkg.version } : {}),
    identitySource: pkg ? "package.json" : "unavailable",
  };
}

/**
 * Walks upward from the executable looking for a `package.json`.
 *
 * Bounded to a few levels: an unbounded walk would eventually find some
 * unrelated manifest far up the tree and report it as the runtime's
 * identity, which is worse than reporting nothing.
 */
function readNearestPackageJson(
  executablePath: string,
): { name?: string; version?: string } | null {
  let directory = path.dirname(executablePath);
  for (let depth = 0; depth < 4; depth += 1) {
    try {
      const raw = readFileSync(path.join(directory, "package.json"), "utf8");
      const parsed = JSON.parse(raw) as { name?: unknown; version?: unknown };
      return {
        ...(typeof parsed.name === "string" ? { name: parsed.name } : {}),
        ...(typeof parsed.version === "string" ? { version: parsed.version } : {}),
      };
    } catch {
      // Not here, or unreadable — keep walking.
    }
    const parent = path.dirname(directory);
    if (parent === directory) break;
    directory = parent;
  }
  return null;
}

export type BinaryIdentityCheck =
  | { ok: true; identity: BinaryIdentity }
  | { ok: false; code: "no_pin" | "unreadable" | "mismatch"; reason: string; correctiveAction: string; identity?: BinaryIdentity };

/**
 * Pre-dispatch refusal on an unexpected binary.
 *
 * Called **before** the workspace is created and long before anything is
 * spawned, so a mismatch costs nothing and leaves nothing behind.
 */
export function assertExpectedBinary(
  absolutePath: string,
  expectedSha256: string | undefined,
): BinaryIdentityCheck {
  if (!expectedSha256) {
    return {
      ok: false,
      code: "no_pin",
      reason: `No expected SHA-256 is configured for the controlled executable (${absolutePath}). An unverifiable binary is refused rather than run: without a pin, "the allowlisted path" and "the program that runs" are different claims.`,
      correctiveAction:
        "Pin the executable's SHA-256 in the dispatcher configuration, having verified out of band that it is the binary you intend.",
    };
  }

  let identity: BinaryIdentity;
  try {
    identity = readBinaryIdentity(absolutePath);
  } catch (error) {
    return {
      ok: false,
      code: "unreadable",
      reason: `The controlled executable could not be read at ${absolutePath}: ${
        error instanceof Error ? error.message : String(error)
      }`,
      correctiveAction: "Check the configured path, then retry.",
    };
  }

  if (identity.sha256 !== expectedSha256) {
    return {
      ok: false,
      code: "mismatch",
      identity,
      reason: `The controlled executable does not match its pin. Expected sha256:${expectedSha256}; the file at ${absolutePath} is sha256:${identity.sha256} (${identity.sizeBytes} bytes${
        identity.packageVersion ? `, ${identity.packageName ?? "package"}@${identity.packageVersion}` : ""
      }). The binary changed since it was pinned — an upgrade, a reinstall, or a substitution.`,
      correctiveAction:
        "Re-verify the executable out of band. If the change was an intended upgrade, update the pin deliberately; do not update it to whatever is currently on disk in order to proceed.",
    };
  }

  return { ok: true, identity };
}
