import type { NextConfig } from "next";

// The Content-Security-Policy is set per-request in src/middleware.ts —
// it needs a fresh nonce each request so Next's inline scripts hydrate
// (SECURITY.md § 11). Only the static headers live here.
const nextConfig: NextConfig = {
  // Silences a false-positive workspace-root warning caused by an
  // unrelated lockfile in the parent directory tree.
  outputFileTracingRoot: __dirname,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
