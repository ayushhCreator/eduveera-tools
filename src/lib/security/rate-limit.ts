import "server-only";

// ponytail: in-memory sliding-window limiter, not Redis/Upstash — no
// queue/external-store requirement exists yet (PERFORMANCE section of the
// build brief: don't add Redis/workers without an actual need). Ceiling:
// this only limits per warm serverless instance and resets on cold start,
// so it's a speed bump against casual abuse, not a hard guarantee under
// serious load. Upgrade path if that ever matters: swap the Map below for
// an Upstash Redis-backed counter — call sites don't change.
const hits = new Map<string, number[]>();

export function rateLimited(key: string, maxHits: number, windowMs: number): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;
  const recent = (hits.get(key) ?? []).filter((t) => t > windowStart);

  if (recent.length >= maxHits) {
    hits.set(key, recent);
    return true;
  }

  recent.push(now);
  hits.set(key, recent);
  return false;
}
