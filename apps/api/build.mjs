// Bundles the runtime entrypoint so `node dist/main.js` works without
// relying on Node's native ESM resolver following extensionless relative
// imports across workspace packages (a pre-existing repo-wide convention
// that Next.js/Vitest tolerate via bundler-style resolution, but Node's
// own loader does not). Scoped entirely to this app's own build step —
// no other package's source changes because of this.
import { build } from "esbuild";

await build({
  entryPoints: {
    main: "src/main.ts",
    // The FBL-028 operator entrypoint. Bundled alongside the service
    // because it needs the same workspace-package resolution; it is run
    // deliberately (`pnpm --filter @foundry/api fbl-028`), never on boot.
    "fbl028-run-controlled-stage": "src/fbl028/runControlledStage.ts",
  },
  outdir: "dist",
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  packages: "bundle",
  sourcemap: true,
  logLevel: "info",
});
