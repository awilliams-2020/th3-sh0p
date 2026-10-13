import { promises as fs } from "fs";
import path from "path";

// Rollups written on the host by ~/scripts/traffic/aggregate.py (every 10 min) and mounted
// read-only at /app/traffic. Aggregates only: no IPs, paths or query strings.
const DIR = process.env.TRAFFIC_DIR ?? path.join(process.cwd(), "traffic");

export const OUTCOMES = ["served", "challenged", "blocked", "other", "error"] as const;
export type Outcome = (typeof OUTCOMES)[number];
export type OutcomeCounts = Record<Outcome, number>;

export const OUTCOME_META: Record<Outcome, { label: string; color: string; note: string }> = {
  served: { label: "Served", color: "#3987e5", note: "status below 400" },
  challenged: { label: "Challenged", color: "#e0a10b", note: "JS proof-of-work page (npiradar)" },
  blocked: { label: "Blocked", color: "#199e70", note: "403 / 429: bot filters, allowlists, rate limits" },
  other: { label: "Not found / other", color: "#5f5e5a", note: "remaining 4xx (mostly 404) and client aborts" },
  error: { label: "Server error", color: "#d03b3b", note: "5xx from an app or the edge" },
};

type RouterData = {
  requests: number;
  outcomes: OutcomeCounts;
  p50: number | null;
  p95: number | null;
  crawlers: Record<string, number[]>; // counts in outcomeOrder
  robots?: Record<string, number>; // served /robots.txt fetches per crawler (included in served)
  hourly?: number[][]; // 24 x outcomeOrder (latest.json only)
};
// The scraper signature npiradar's jsgate hard-challenges, read from traefik by aggregate.py. The UA
// itself is never written out; IPs are only counted and timed.
type TrackedRouter = {
  requests: number;
  outcomes: OutcomeCounts;
  pages: number; // served page loads (no RSC prefetches or assets)
  ips: number;
  prefixes: number; // distinct /24s (IPv6 /48)
  challengedIps: number;
  solve: { n: number; p50: number | null; p90: number | null }; // s from an IP's challenge to its first served request
  hourly?: number[][];
  hourlyPages?: number[];
  hourlySolveP50?: (number | null)[];
};
// What ~/scripts/scraper-watch enforces (latest.json only): UAs by action, and its recent events.
export type WatchEvent = {
  ts: string;
  event: "add" | "retire" | "action";
  rule?: "seed" | "arrival" | "secondary";
  action: "block" | "slow";
  why?: "idle" | "brake"; // retire only
  family?: "chrome" | "firefox";
};
export type Watch = { updated: string | null; blocked: number; slowed: number; events: WatchEvent[] };
export type Tracked = {
  label: string;
  bits: number | null;
  signatures: number;
  routers: Record<string, TrackedRouter>;
  watch?: Watch | null;
};
type Rollup = {
  outcomeOrder: Outcome[];
  crawlerKinds: Record<string, string>;
  routers: Record<string, RouterData>;
  tracked?: Tracked;
};
export type Latest = Rollup & { generatedAt: string; windowStart: string; windowEnd: string; hours: string[] };
export type Daily = Rollup & { date: string };

export type SiteRow = OutcomeCounts & { site: string; requests: number; p50: number | null; p95: number | null };
export type CrawlerRow = OutcomeCounts & { name: string; kind: string; requests: number; robots: number };
export type Scoped = {
  total: number;
  outcomes: OutcomeCounts;
  hourly: OutcomeCounts[];
  sites: SiteRow[];
  crawlers: CrawlerRow[];
};

const zero = (): OutcomeCounts => ({ served: 0, challenged: 0, blocked: 0, other: 0, error: 0 });

function addArr(into: OutcomeCounts, order: Outcome[], arr: number[]) {
  order.forEach((k, i) => (into[k] += arr[i] ?? 0));
}

// Sum a rollup over just the given routers (the homepage projects' slugs), so internal
// routers never appear on the page or in its totals.
export function scope(r: Rollup & { hours?: string[] }, routers: string[]): Scoped {
  const outcomes = zero();
  const hourly = (r.hours ?? []).map(zero);
  const crawlers = new Map<string, OutcomeCounts>();
  const robots = new Map<string, number>();
  const sites: SiteRow[] = [];
  for (const name of routers) {
    const d = r.routers[name];
    if (!d) continue;
    for (const k of OUTCOMES) outcomes[k] += d.outcomes[k] ?? 0;
    d.hourly?.forEach((h, i) => hourly[i] && addArr(hourly[i], r.outcomeOrder, h));
    for (const [c, arr] of Object.entries(d.crawlers)) {
      if (!crawlers.has(c)) crawlers.set(c, zero());
      addArr(crawlers.get(c)!, r.outcomeOrder, arr);
    }
    for (const [c, n] of Object.entries(d.robots ?? {})) robots.set(c, (robots.get(c) ?? 0) + n);
    sites.push({ site: name, requests: d.requests, ...d.outcomes, p50: d.p50, p95: d.p95 });
  }
  const sum = (o: OutcomeCounts) => OUTCOMES.reduce((s, k) => s + o[k], 0);
  return {
    total: sum(outcomes),
    outcomes,
    hourly,
    sites: sites.sort((a, b) => b.requests - a.requests),
    crawlers: [...crawlers]
      .map(([name, o]) => ({
        name,
        kind: r.crawlerKinds[name] ?? "other",
        requests: sum(o),
        ...o,
        robots: robots.get(name) ?? 0,
      }))
      .sort((a, b) => b.requests - a.requests),
  };
}

export async function getLatest(): Promise<Latest | null> {
  try {
    return JSON.parse(await fs.readFile(path.join(DIR, "latest.json"), "utf8"));
  } catch {
    return null;
  }
}

export async function getDaily(): Promise<Daily[]> {
  try {
    const names = (await fs.readdir(path.join(DIR, "daily")))
      .filter((n) => /^\d{4}-\d{2}-\d{2}\.json$/.test(n))
      .sort();
    return Promise.all(
      names.map(async (n) => JSON.parse(await fs.readFile(path.join(DIR, "daily", n), "utf8"))),
    );
  } catch {
    return [];
  }
}

export function compact(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 10_000) return `${Math.round(n / 1000)}K`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

// The tracked signature summed over the given routers. Distinct-IP counts are summed per router,
// which overcounts only if one IP hits several shown sites (in practice it is npiradar alone).
export function scopeTracked(t: Tracked | undefined, routers: string[]) {
  const outcomes = zero();
  let pages = 0, ips = 0, prefixes = 0;
  let hourly: OutcomeCounts[] = [], hourlyPages: number[] = [], hourlySolveP50: (number | null)[] = [];
  let solve: TrackedRouter["solve"] = { n: 0, p50: null, p90: null };
  for (const name of routers) {
    const d = t?.routers[name];
    if (!d) continue;
    for (const k of OUTCOMES) outcomes[k] += d.outcomes[k] ?? 0;
    pages += d.pages;
    ips += d.ips;
    prefixes += d.prefixes;
    if (d.solve.n > solve.n) {
      solve = d.solve; // percentiles don't sum: report the busiest router's, hourly ones too
      hourlySolveP50 = d.hourlySolveP50 ?? [];
    }
    if (d.hourly) {
      if (!hourly.length) hourly = d.hourly.map(zero);
      d.hourly.forEach((h, i) => OUTCOMES.forEach((k, j) => (hourly[i][k] += h[j] ?? 0)));
      (d.hourlyPages ?? []).forEach((n, i) => (hourlyPages[i] = (hourlyPages[i] ?? 0) + n));
    }
  }
  const total = OUTCOMES.reduce((s, k) => s + outcomes[k], 0);
  return { total, outcomes, pages, ips, prefixes, solve, hourly, hourlyPages, hourlySolveP50, bits: t?.bits ?? null };
}
