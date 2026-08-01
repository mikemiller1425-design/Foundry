import { constants, accessSync, statSync } from "node:fs";
import path from "node:path";
import { allow, deny, type PolicyDecision } from "../denial";
import type { RuntimePolicy } from "../policy";

/**
 * Turns an allowlisted executable name into the absolute path that will
 * actually be spawned.
 *
 * Resolution never consults `PATH`. An allowlist entry for `git` must
 * mean one specific binary, and if the lookup went through an
 * environment variable then anyone able to influence that variable could
 * decide what `git` means — passing the allowlist textually while
 * running something else entirely. Searching an explicitly declared list
 * of directories keeps "which binary" a policy decision.
 */
export function resolveExecutable(
  policy: RuntimePolicy,
  executable: string,
): PolicyDecision<string> {
  if (path.isAbsolute(executable)) {
    return isExecutableFile(executable)
      ? allow(executable)
      : deny(
          "command_not_allowed",
          `Allowlisted executable path is not an executable file: ${executable}`,
          executable,
        );
  }

  if (executable.includes("/") || executable.includes("\\")) {
    return deny(
      "command_not_allowed",
      `Executable must be a bare name or an absolute path, not a relative path: ${executable}`,
      executable,
    );
  }

  for (const directory of policy.executableSearchPath) {
    const candidate = path.join(directory, executable);
    if (isExecutableFile(candidate)) return allow(candidate);
  }

  return deny(
    "command_not_allowed",
    `Allowlisted executable ${executable} was not found in the policy's declared search path.`,
    executable,
  );
}

function isExecutableFile(candidate: string): boolean {
  try {
    if (!statSync(candidate).isFile()) return false;
    accessSync(candidate, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}
