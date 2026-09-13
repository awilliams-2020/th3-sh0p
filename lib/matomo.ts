import "server-only";
import { unstable_cache } from "next/cache";

// Matomo Reporting API. Server-side only: hits the internal nginx
// (http://matomo-ui) so there's no NAT hairpin to the public domain. The
// auth token and every param go in the POST body — Matomo rejects token_auth
// in the query string. Complements GSC/Bing: search tells you acquisition
// (impression → click), Matomo tells you behavior (visit → engagement).

export type MatomoWindow = {
  days: 7 | 30 | 90;
  visits: number;
  bounceRate: number; // 0..1
  avgTimeOnSite: number; // seconds
  actionsPerVisit: number;
};

export type MatomoChannel = {
  label: string;
  visits: number;
  share: number; // 0..1 of total visits
};

export type MatomoReport = {
  configured: boolean;
  error?: "forbidden" | "unknown";
  windows: MatomoWindow[];
  channels: MatomoChannel[];
  daily: { date: string; visits: number }[];
};

// VisitsSummary.get row (period=range) or one bucket of a period=day series.
type SummaryRow = {
  nb_visits?: number;
  nb_actions?: number;
  bounce_count?: number;
  sum_visit_length?: number;
  nb_actions_per_visit?: number;
  avg_time_on_site?: number;
};

type ReferrerRow = { label?: string; nb_visits?: number };

const EMPTY: Omit<MatomoReport, "configured" | "error"> = {
  windows: [],
  channels: [],
  daily: [],
};

function config() {
  const base = process.env.MATOMO_INTERNAL_URL || process.env.NEXT_PUBLIC_MATOMO_URL;
  const token = process.env.MATOMO_AUTH_TOKEN;
  if (!base || !token) return null;
  return { base: base.replace(/\/$/, ""), token };
}

async function call<T>(
  base: string,
  token: string,
  method: string,
  siteId: number,
  extra: Record<string, string>,
): Promise<T> {
  const body = new URLSearchParams({
    module: "API",
    method,
    idSite: String(siteId),
    format: "JSON",
    token_auth: token,
    ...extra,
  });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`${base}/index.php`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
      cache: "no-store",
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = new Error(`matomo ${method} ${res.status}`) as Error & { status: number };
      err.status = res.status;
      throw err;
    }
    const json = (await res.json()) as unknown;
    // Matomo returns HTTP 200 with {result:"error", message} on auth failure.
    if (json && typeof json === "object" && !Array.isArray(json) && (json as { result?: string }).result === "error") {
      const err = new Error(`matomo ${method}: ${(json as { message?: string }).message ?? "error"}`) as Error & {
        status: number;
      };
      err.status = 403;
      throw err;
    }
    return json as T;
  } finally {
    clearTimeout(timeout);
  }
}

function windowFrom(days: 7 | 30 | 90, row: SummaryRow | unknown[]): MatomoWindow {
  // period=range returns an object; a site/period with no data can return [].
  const r: SummaryRow = Array.isArray(row) ? {} : (row as SummaryRow);
  const visits = r.nb_visits ?? 0;
  return {
    days,
    visits,
    bounceRate: visits > 0 ? (r.bounce_count ?? 0) / visits : 0,
    avgTimeOnSite: r.avg_time_on_site ?? 0,
    actionsPerVisit: r.nb_actions_per_visit ?? (visits > 0 ? (r.nb_actions ?? 0) / visits : 0),
  };
}

function classifyError(err: unknown): "forbidden" | "unknown" {
  const status = (err as { status?: number })?.status;
  return status === 401 || status === 403 ? "forbidden" : "unknown";
}

export const getMatomoReport = (siteId?: number) =>
  unstable_cache(
    async (): Promise<MatomoReport> => {
      const cfg = config();
      if (!cfg || !siteId) return { configured: false, ...EMPTY };
      const { base, token } = cfg;
      try {
        const [w7, w30, w90, series, referrers] = await Promise.all([
          call<SummaryRow | unknown[]>(base, token, "VisitsSummary.get", siteId, { period: "range", date: "last7" }),
          call<SummaryRow | unknown[]>(base, token, "VisitsSummary.get", siteId, { period: "range", date: "last30" }),
          call<SummaryRow | unknown[]>(base, token, "VisitsSummary.get", siteId, { period: "range", date: "last90" }),
          call<Record<string, SummaryRow | unknown[]>>(base, token, "VisitsSummary.get", siteId, {
            period: "day",
            date: "last30",
          }),
          call<ReferrerRow[]>(base, token, "Referrers.getReferrerType", siteId, { period: "range", date: "last30" }),
        ]);

        // Daily series: object keyed by date; empty days come back as [].
        const daily = Object.entries(series)
          .map(([date, v]) => ({
            date,
            visits: Array.isArray(v) ? 0 : (v as SummaryRow).nb_visits ?? 0,
          }))
          .sort((a, b) => a.date.localeCompare(b.date));

        const rows = Array.isArray(referrers) ? referrers : [];
        const total = rows.reduce((s, r) => s + (r.nb_visits ?? 0), 0);
        const channels: MatomoChannel[] = rows
          .map((r) => ({
            label: r.label ?? "Unknown",
            visits: r.nb_visits ?? 0,
            share: total > 0 ? (r.nb_visits ?? 0) / total : 0,
          }))
          .sort((a, b) => b.visits - a.visits);

        return {
          configured: true,
          windows: [windowFrom(7, w7), windowFrom(30, w30), windowFrom(90, w90)],
          channels,
          daily,
        };
      } catch (err) {
        const error = classifyError(err);
        console.warn(`[matomo] site ${siteId} failed: ${error}`);
        return { configured: true, error, ...EMPTY };
      }
    },
    ["matomo", String(siteId ?? "none")],
    { revalidate: 3600, tags: [`matomo:${siteId ?? "none"}`] },
  )();
