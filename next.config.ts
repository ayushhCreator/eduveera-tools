import type { NextConfig } from "next";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const isDev = process.env.NODE_ENV !== "production";

// Baseline CSP (SECURITY.md § 11). 'unsafe-eval'/'unsafe-inline' on
// script-src are only added in dev, where Next's HMR/React Refresh
// requires them — production gets the strict policy.
const csp = [
  "default-src 'self'",
  `script-src 'self' ${isDev ? "'unsafe-eval' 'unsafe-inline'" : ""}`,
  "style-src 'self' 'unsafe-inline'", // Tailwind/shadcn ship runtime-injected styles
  "img-src 'self' data: blob:",
  `connect-src 'self' ${supabaseUrl}`,
  "font-src 'self' data:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
]
  .filter(Boolean)
  .join("; ");

const nextConfig: NextConfig = {
  // Silences a false-positive workspace-root warning caused by an
  // unrelated lockfile in the parent directory tree.
  outputFileTracingRoot: __dirname,
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "Content-Security-Policy", value: csp },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
    ];
  },
};

export default nextConfig;
