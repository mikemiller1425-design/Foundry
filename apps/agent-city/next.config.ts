import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the monorepo root explicitly: an unrelated lockfile in the host
  // environment's home directory otherwise confuses Turbopack's inferred
  // root detection.
  turbopack: {
    root: path.join(import.meta.dirname, "..", ".."),
  },
};

export default nextConfig;
