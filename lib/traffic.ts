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
  other: { label: "Not found / other", color: "#5f5e5a", note: "remaining 4xx, mostly 404" },
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
type Rollup = { outcomeOrder: Outcome[]; crawlerKinds: Record<string, string>; routers: Record<string, RouterData> };
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
