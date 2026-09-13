import "server-only";
import { unstable_cache } from "next/cache";

// Bing Webmaster Tools API. Unlike GSC this is a plain API-key flow: one key
// (from Bing Webmaster Tools → Settings → API access) covers every verified
// site, passed as the ?apikey= query param. No OAuth / token store needed.
const BASE = "https://ssl.bing.com/webmaster/api.svc/json";

export type BingWindow = {
  days: 7 | 30 | 90;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number; // 0 = unknown (rank/traffic endpoint has no position)
};

export type BingQuery = {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
};

export type BingReport = {
  configured: boolean;
  error?: "forbidden" | "unknown";
  windows: BingWindow[];
  topQueries: BingQuery[];
  daily: { date: string; clicks: number; impressions: number }[];
};

type TrafficRow = { Date: string; Clicks: number; Impressions: number };
type QueryRow = {
  Query: string;
  Clicks: number;
  Impressions: number;
  AvgImpressionPosition: number;
  Date: string;
};

function dateOffset(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

// Bing returns ASP.NET dates: "/Date(1399100400000-0700)/" → "2014-05-03".
function parseMsDate(raw: string): string {
  const m = /\/Date\((\d+)/.exec(raw);
  if (!m) return "";
  return new Date(Number(m[1])).toISOString().slice(0, 10);
}

async function call<T>(method: string, apiKey: string, site: string): Promise<T[]> {
  const url = `${BASE}/${method}?apikey=${encodeURIComponent(apiKey)}&siteUrl=${encodeURIComponent(site)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    const err = new Error(`bing ${method} ${res.status}`) as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  const json = (await res.json()) as { d?: T[] | null };
  return json.d ?? [];
}

function windowFromDaily(
  daily: { date: string; clicks: number; impressions: number }[],
  days: 7 | 30 | 90,
): BingWindow {
  const start = dateOffset(days);
  const end = dateOffset(1);
  let clicks = 0;
  let impressions = 0;
  for (const row of daily) {
    if (row.date >= start && row.date <= end) {
      clicks += row.clicks;
      impressions += row.impressions;
    }
  }
  return {
    days,
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: 0,
  };
}

function classifyError(err: unknown): "forbidden" | "unknown" {
  const status = (err as { status?: number })?.status;
  return status === 401 || status === 403 ? "forbidden" : "unknown";
}

export const getBingReport = (site: string) =>
  unstable_cache(
    async (): Promise<BingReport> => {
      const apiKey = process.env.BING_API_KEY;
      if (!apiKey || !site) {
        return { configured: false, windows: [], topQueries: [], daily: [] };
      }
      try {
        const [traffic, queries] = await Promise.all([
          call<TrafficRow>("GetRankAndTrafficStats", apiKey, site),
          call<QueryRow>("GetQueryStats", apiKey, site),
        ]);

        // Daily traffic → normalize + keep the last 30 days for the sparkline.
        const start30 = dateOffset(30);
        const end = dateOffset(1);
        const daily = traffic
          .map((r) => ({
            date: parseMsDate(r.Date),
            clicks: r.Clicks ?? 0,
            impressions: r.Impressions ?? 0,
          }))
          .filter((r) => r.date && r.date >= start30 && r.date <= end)
          .sort((a, b) => a.date.localeCompare(b.date));

        // Query stats come in weekly buckets — aggregate the last ~30 days per
        // query, impression-weighting the average position.
        const qStart = dateOffset(30);
        const agg = new Map<
          string,
          { query: string; clicks: number; impressions: number; posWeighted: number; posImpr: number }
        >();
        for (const r of queries) {
          if (parseMsDate(r.Date) < qStart) continue;
          const key = (r.Query ?? "").toLowerCase();
          if (!key) continue;
          const cur =
            agg.get(key) ?? { query: r.Query, clicks: 0, impressions: 0, posWeighted: 0, posImpr: 0 };
          cur.clicks += r.Clicks ?? 0;
          cur.impressions += r.Impressions ?? 0;
          if ((r.AvgImpressionPosition ?? 0) > 0 && (r.Impressions ?? 0) > 0) {
            cur.posWeighted += r.AvgImpressionPosition * r.Impressions;
            cur.posImpr += r.Impressions;
          }
          agg.set(key, cur);
        }
        const topQueries: BingQuery[] = [...agg.values()]
          .map((q) => ({
            query: q.query,
            clicks: q.clicks,
            impressions: q.impressions,
            position: q.posImpr > 0 ? q.posWeighted / q.posImpr : 0,
          }))
          .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
          .slice(0, 10);

        return {
          configured: true,
          windows: [windowFromDaily(daily, 7), windowFromDaily(daily, 30), windowFromDaily(daily, 90)],
          topQueries,
          daily,
        };
      } catch (err) {
        const error = classifyError(err);
        console.warn(`[bing] ${site} failed: ${error}`);
        return { configured: true, error, windows: [], topQueries: [], daily: [] };
      }
    },
    ["bing", site],
    { revalidate: 3600, tags: [`bing:${site}`] },
  )();
