import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Silences a false-positive workspace-root warning caused by an
  // unrelated lockfile in the parent directory tree.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
