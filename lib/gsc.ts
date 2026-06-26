import "server-only";
import { unstable_cache } from "next/cache";
import { google } from "googleapis";
import { readRefreshToken } from "./gsc-token";

export type GscWindow = {
  days: 7 | 30 | 90;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

export type GscQuery = { query: string; clicks: number; impressions: number; position: number };

export type GscReport = {
  configured: boolean;
  error?: "forbidden" | "unknown";
  windows: GscWindow[];
  topQueries: GscQuery[];
  daily: { date: string; clicks: number; impressions: number }[];
};

type WM = ReturnType<typeof google.webmasters>;

// Refresh token now comes from the store (set via the in-app OAuth flow), falling back to env.
async function client(): Promise<WM | null> {
  const clientId = process.env.GSC_CLIENT_ID;
  const clientSecret = process.env.GSC_CLIENT_SECRET;
  const refreshToken = await readRefreshToken();
  if (!clientId || !clientSecret || !refreshToken) return null;
  const auth = new google.auth.OAuth2(clientId, clientSecret);
  auth.setCredentials({ refresh_token: refreshToken });
  return google.webmasters({ version: "v3", auth });
}

function dateOffset(days: number) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

async function fetchWindow(wm: WM, property: string, days: 7 | 30 | 90): Promise<GscWindow> {
  const res = await wm.searchanalytics.query({
    siteUrl: property,
    requestBody: {
      startDate: dateOffset(days),
      endDate: dateOffset(1),
      dimensions: [],
      rowLimit: 1,
    },
  });
  const row = res.data.rows?.[0];
  return {
    days,
    clicks: row?.clicks ?? 0,
    impressions: row?.impressions ?? 0,
    ctr: row?.ctr ?? 0,
    position: row?.position ?? 0,
  };
}

async function fetchTopQueries(wm: WM, property: string): Promise<GscQuery[]> {
  const res = await wm.searchanalytics.query({
    siteUrl: property,
    requestBody: {
      startDate: dateOffset(30),
      endDate: dateOffset(1),
      dimensions: ["query"],
      rowLimit: 10,
    },
  });
  return (res.data.rows ?? []).map((r) => ({
    query: r.keys?.[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
    position: r.position ?? 0,
  }));
}

async function fetchDaily(wm: WM, property: string) {
  const res = await wm.searchanalytics.query({
    siteUrl: property,
    requestBody: {
      startDate: dateOffset(30),
      endDate: dateOffset(1),
      dimensions: ["date"],
      rowLimit: 30,
    },
  });
  return (res.data.rows ?? []).map((r) => ({
    date: r.keys?.[0] ?? "",
    clicks: r.clicks ?? 0,
    impressions: r.impressions ?? 0,
  }));
}

function classifyError(err: unknown): "forbidden" | "unknown" {
  const status = (err as { status?: number; code?: number })?.status
    ?? (err as { code?: number })?.code;
  return status === 403 ? "forbidden" : "unknown";
}

export const getGscReport = (property: string) =>
  unstable_cache(
    async (): Promise<GscReport> => {
      const wm = await client();
      if (!wm) {
        return { configured: false, windows: [], topQueries: [], daily: [] };
      }
      try {
        const [w7, w30, w90, topQueries, daily] = await Promise.all([
          fetchWindow(wm, property, 7),
          fetchWindow(wm, property, 30),
          fetchWindow(wm, property, 90),
          fetchTopQueries(wm, property),
          fetchDaily(wm, property),
        ]);
        return {
          configured: true,
          windows: [w7, w30, w90],
          topQueries,
          daily,
        };
      } catch (err) {
        const error = classifyError(err);
        console.warn(`[gsc] ${property} failed: ${error}`);
        return {
          configured: true,
          error,
          windows: [],
          topQueries: [],
          daily: [],
        };
      }
    },
    ["gsc", property],
    { revalidate: 3600, tags: [`gsc:${property}`] },
  )();
