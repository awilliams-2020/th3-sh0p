import "server-only";
import type { Project } from "@/data/projects";
import { getGscReport } from "./gsc";
import { getBingReport } from "./bing";

// Combined Google + Bing search performance for a project. Clicks/impressions
// are summed across engines; average position is impression-weighted so the
// blended number stays honest. Daily series and top queries are merged by
// date / normalized query respectively.

export type SearchWindow = {
  days: 7 | 30 | 90;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type SearchQuery = { query: string; clicks: number; impressions: number; position: number };

export type EngineStatus = { configured: boolean; error?: "forbidden" | "unknown" };

export type SearchReport = {
  engines: { google: EngineStatus; bing: EngineStatus };
  /** at least one engine returned usable data */
  hasData: boolean;
  windows: SearchWindow[];
  topQueries: SearchQuery[];
  daily: { date: string; clicks: number; impressions: number }[];
};

type Window = { days: 7 | 30 | 90; clicks: number; impressions: number; position: number };

function mergeWindow(days: 7 | 30 | 90, parts: Window[]): SearchWindow {
  let clicks = 0;
  let impressions = 0;
  let posWeighted = 0;
  let posImpr = 0;
  for (const w of parts) {
    if (w.days !== days) continue;
    clicks += w.clicks;
    impressions += w.impressions;
    if (w.position > 0 && w.impressions > 0) {
      posWeighted += w.position * w.impressions;
      posImpr += w.impressions;
    }
  }
  return {
    days,
    clicks,
    impressions,
    ctr: impressions > 0 ? clicks / impressions : 0,
    position: posImpr > 0 ? posWeighted / posImpr : 0,
  };
}

export async function getSearchReport(project: Project): Promise<SearchReport> {
  const [gsc, bing] = await Promise.all([
    getGscReport(project.gscProperty),
    getBingReport(project.bingSite),
  ]);

  const allWindows = [...gsc.windows, ...bing.windows];
  const windows: SearchWindow[] = ([7, 30, 90] as const).map((d) => mergeWindow(d, allWindows));

  // Daily: union of dates, sum per day, chronological for the sparkline.
  const dailyMap = new Map<string, { date: string; clicks: number; impressions: number }>();
  for (const row of [...gsc.daily, ...bing.daily]) {
    const cur = dailyMap.get(row.date) ?? { date: row.date, clicks: 0, impressions: 0 };
    cur.clicks += row.clicks;
    cur.impressions += row.impressions;
    dailyMap.set(row.date, cur);
  }
  const daily = [...dailyMap.values()].sort((a, b) => a.date.localeCompare(b.date));

  // Top queries: merge by normalized query, impression-weight the position.
  const qMap = new Map<
    string,
    { query: string; clicks: number; impressions: number; posWeighted: number; posImpr: number }
  >();
  for (const q of [...gsc.topQueries, ...bing.topQueries]) {
    const key = q.query.toLowerCase();
    const cur =
      qMap.get(key) ?? { query: q.query, clicks: 0, impressions: 0, posWeighted: 0, posImpr: 0 };
    cur.clicks += q.clicks;
    cur.impressions += q.impressions;
    if (q.position > 0 && q.impressions > 0) {
      cur.posWeighted += q.position * q.impressions;
      cur.posImpr += q.impressions;
    }
    qMap.set(key, cur);
  }
  const topQueries: SearchQuery[] = [...qMap.values()]
    .map((q) => ({
      query: q.query,
      clicks: q.clicks,
      impressions: q.impressions,
      position: q.posImpr > 0 ? q.posWeighted / q.posImpr : 0,
    }))
    .sort((a, b) => b.clicks - a.clicks || b.impressions - a.impressions)
    .slice(0, 10);

  const google: EngineStatus = { configured: gsc.configured, error: gsc.error };
  const bingStatus: EngineStatus = { configured: bing.configured, error: bing.error };
  const hasData =
    (google.configured && !google.error) || (bingStatus.configured && !bingStatus.error);

  return { engines: { google, bing: bingStatus }, hasData, windows, topQueries, daily };
}
