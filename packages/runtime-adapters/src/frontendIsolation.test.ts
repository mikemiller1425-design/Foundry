import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * ADR-006 forbids the frontend from invoking runtimes directly. That is
 * a structural rule, so it gets a structural test: the rule is easy to
 * respect today and easy to violate later with one convenient import,
 * and a reviewer will not reliably catch it.
 */
describe("frontend cannot reach the runtime boundary", () => {
  const repoRoot = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
  const frontendRoot = path.join(repoRoot, "apps", "agent-city");

  const sourceFiles = (directory: string): string[] => {
    const entries: string[] = [];
    for (const name of readdirSync(directory)) {
      if (name === "node_modules" || name === ".next" || name === "dist") continue;
      const full = path.join(directory, name);
      if (statSync(full).isDirectory()) {
        entries.push(...sourceFiles(full));
      } else if (/\.(ts|tsx|mjs|js|jsx)$/.test(name)) {
        entries.push(full);
      }
    }
    return entries;
  };

  it("no frontend source imports @foundry/runtime-adapters", () => {
    const offenders = sourceFiles(frontendRoot).filter((file) =>
      readFileSync(file, "utf8").includes("@foundry/runtime-adapters"),
    );
    expect(offenders).toEqual([]);
  });

  it("the frontend does not declare the package as a dependency", () => {
    const manifest = JSON.parse(readFileSync(path.join(frontendRoot, "package.json"), "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    expect(manifest.dependencies ?? {}).not.toHaveProperty("@foundry/runtime-adapters");
    expect(manifest.devDependencies ?? {}).not.toHaveProperty("@foundry/runtime-adapters");
  });
});
