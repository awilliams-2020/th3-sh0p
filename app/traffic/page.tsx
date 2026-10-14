import type { Metadata } from "next";
import Link from "next/link";
import { StackedBars, type Column } from "@/components/traffic/StackedBars";
import { projects } from "@/data/projects";
import {
  OUTCOMES,
  OUTCOME_META,
  compact,
  getDaily,
  getLatest,
  scope,
  scopeTracked,
  type CrawlerRow,
  type OutcomeCounts,
  type SiteRow,
  type WatchEvent,
} from "@/lib/traffic";

// Reads the rollup files on every request; they change every 10 minutes and are tiny.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Edge traffic — zwznco",
  description: "Every request through the edge proxy, the last 24 hours and daily history.",
};

const SERIES = OUTCOMES.map((key) => ({ key, ...OUTCOME_META[key] }));
const fmt = new Intl.NumberFormat("en-US");

function pct(n: number, total: number) {
  if (!total) return "—";
  const p = (n / total) * 100;
  return p > 0 && p < 0.1 ? "<0.1%" : `${p.toFixed(1)}%`;
}

function ago(iso: string) {
  const min = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  return min < 1 ? "just now" : min < 90 ? `${min} min ago` : `${Math.round(min / 60)} h ago`;
}

const FAMILY: Record<string, string> = { chrome: "Chrome", firefox: "Firefox" };
const RULE: Record<string, string> = { seed: "set by hand", arrival: "new UA from its networks", secondary: "low-volume UA" };

function eventText(e: WatchEvent) {
  const ua = `${FAMILY[e.family ?? ""] ?? "Browser"} UA`;
  const act = e.action === "block" ? "blocked" : "slowed";
  if (e.event === "add") return `${ua} added, ${act} · ${RULE[e.rule ?? ""] ?? e.rule}`;
  if (e.event === "action") return `${ua} now ${act}`;
  return `${ua} retired · ${e.why === "brake" ? "real visitors reached it from search" : "idle 72 h"}`;
}

const zeroCounts: OutcomeCounts = { served: 0, challenged: 0, blocked: 0, other: 0, error: 0 };

function values(o: OutcomeCounts) {
  return Object.fromEntries(OUTCOMES.map((k) => [k, o[k]]));
}

function Legend() {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-2 font-mono text-[11px] text-ink-100/80">
      {SERIES.map((s) => (
        <li key={s.key} className="flex items-center gap-1.5" title={s.note}>
          <span className="inline-block size-2.5 rounded-sm" style={{ background: s.color }} />
          {s.label}
        </li>
      ))}
    </ul>
  );
}

function Section({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <div>
        <h2 className="font-mono text-sm tracking-tight">{title}</h2>
        {sub && <p className="mt-1 text-xs leading-relaxed text-ink-400">{sub}</p>}
      </div>
      {children}
    </section>
  );
}

const th = "py-2 pr-4 text-left font-normal text-ink-400";
const thr = "py-2 pl-4 text-right font-normal text-ink-400";
const td = "whitespace-nowrap py-1.5 pr-4";
const tdr = "py-1.5 pl-4 text-right tabular-nums";

function OutcomeBar({ row }: { row: OutcomeCounts & { requests: number } }) {
  return (
    <span className="flex h-1.5 w-24 gap-px overflow-hidden rounded-sm" aria-hidden>
      {OUTCOMES.map((k) =>
        row[k] ? (
          <span key={k} style={{ flexGrow: row[k], flexBasis: 0, background: OUTCOME_META[k].color }} />
        ) : null,
      )}
    </span>
  );
}

function CrawlerTable({ rows, total }: { rows: CrawlerRow[]; total: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] font-mono text-xs">
        <thead className="border-b border-ink-600/40">
          <tr>
            <th className={th}>user agent</th>
            <th className={th}>kind</th>
            <th className={thr}>requests</th>
            <th className={thr}>share</th>
            <th className={thr}>served</th>
            <th className={thr}>robots.txt</th>
            <th className={thr}>challenged</th>
            <th className={thr}>blocked</th>
            <th className="py-2 pl-4" />
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-600/20">
          {rows.map((r) => (
            <tr key={r.name}>
              <td className={td}>{r.name}</td>
              <td className={`${td} text-ink-400`}>{r.kind === "other" ? "" : r.kind}</td>
              <td className={tdr}>{fmt.format(r.requests)}</td>
              <td className={`${tdr} text-ink-400`}>{pct(r.requests, total)}</td>
              <td className={tdr}>{pct(r.served - r.robots, r.requests)}</td>
              <td className={tdr}>{r.robots ? fmt.format(r.robots) : "—"}</td>
              <td className={tdr}>{r.challenged ? fmt.format(r.challenged) : "—"}</td>
              <td className={tdr}>{r.blocked ? fmt.format(r.blocked) : "—"}</td>
              <td className="py-1.5 pl-4">
                <OutcomeBar row={{ ...r, served: r.served - r.robots }} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SiteTable({ rows }: { rows: (SiteRow & { name: string })[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[560px] font-mono text-xs">
        <thead className="border-b border-ink-600/40">
          <tr>
            <th className={th}>site</th>
            <th className={thr}>requests</th>
            <th className={thr}>served</th>
            <th className={thr}>blocked</th>
            <th className={thr}>5xx</th>
            <th className={thr}>p50</th>
            <th className={thr}>p95</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-ink-600/20">
          {rows.map((r) => (
            <tr key={r.site}>
              <td className={td}>{r.name}</td>
              <td className={tdr}>{fmt.format(r.requests)}</td>
              <td className={tdr}>{pct(r.served, r.requests)}</td>
              <td className={tdr}>{r.blocked + r.challenged ? fmt.format(r.blocked + r.challenged) : "—"}</td>
              <td className={`${tdr} ${r.error ? "text-[#e66767]" : ""}`}>{r.error ? fmt.format(r.error) : "—"}</td>
              <td className={tdr}>{r.p50 === null ? "—" : `${r.p50} ms`}</td>
              <td className={tdr}>{r.p95 === null ? "—" : `${r.p95} ms`}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function TrafficPage() {
  const [latest, daily] = await Promise.all([getLatest(), getDaily()]);

  if (!latest) {
    return (
      <main className="space-y-6">
        <Link href="/" className="font-mono text-xs text-ink-400 hover:text-ink-100">
          ← zwznco
        </Link>
        <p className="text-sm text-ink-400">No traffic data yet.</p>
      </main>
    );
  }

  // Only the homepage projects, matched by Traefik router name (= project slug).
  const slugs = projects.map((p) => p.slug);
  const now = scope(latest, slugs);
  const hourly: Column[] = latest.hours.map((iso, i) => {
    const d = new Date(iso);
    const hh = `${String(d.getUTCHours()).padStart(2, "0")}:00`;
    return { label: hh, title: `${d.toISOString().slice(5, 10)} ${hh} UTC`, values: values(now.hourly[i]) };
  });
  const days: Column[] = daily.map((d) => {
    const dt = new Date(`${d.date}T00:00:00Z`);
    const label = dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    return { label, title: `${label} (UTC day)`, values: values(scope(d, slugs).outcomes) };
  });
  const siteRows = now.sites.map((r) => ({ ...r, name: projects.find((p) => p.slug === r.site)!.domain }));
  const o = now.outcomes;
  const scraper = scopeTracked(latest.tracked, slugs);
  const watch = latest.tracked?.watch;
  const scraperHourly: Column[] = latest.hours.map((iso, i) => {
    const d = new Date(iso);
    const hh = `${String(d.getUTCHours()).padStart(2, "0")}:00`;
    const solve = scraper.hourlySolveP50[i];
    const pages = scraper.hourlyPages[i] ?? 0;
    return {
      label: hh,
      title: `${d.toISOString().slice(5, 10)} ${hh} UTC · ${fmt.format(pages)} pages${solve === null || solve === undefined ? "" : ` · solve p50 ${solve} s`}`,
      values: values(scraper.hourly[i] ?? zeroCounts),
    };
  });
  const scraperDays: Column[] = daily
    .filter((d) => d.tracked)
    .map((d) => {
      const t = scopeTracked(d.tracked, slugs);
      const dt = new Date(`${d.date}T00:00:00Z`);
      const label = dt.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
      return {
        label,
        title: `${label} (UTC day) · ${fmt.format(t.pages)} pages · ${fmt.format(t.ips)} IPs${t.solve.p50 === null ? "" : ` · solve p50 ${t.solve.p50} s`}`,
        values: values(t.outcomes),
      };
    });
  const bots = now.crawlers.filter((c) => c.name !== "browsers & other");
  const botShare = bots.reduce((s, c) => s + c.requests, 0);

  return (
    <main className="space-y-14">
      <header className="space-y-3">
        <Link href="/" className="font-mono text-xs text-ink-400 hover:text-ink-100">
          ← zwznco
        </Link>
        <h1 className="font-mono text-sm tracking-tight">Edge traffic</h1>
        <p className="max-w-2xl text-sm leading-relaxed text-ink-100/80">
          Every request to the projects on the front page, rolled up from the access log of the
          Traefik edge proxy in front of them. Most of it is crawlers. Updated every 10 minutes, last{" "}
          {ago(latest.generatedAt)}.
        </p>
      </header>

      <section className="space-y-6">
        <div>
          <div className="text-5xl font-semibold tracking-tight">{fmt.format(now.total)}</div>
          <div className="mt-1 font-mono text-xs text-ink-400">
            requests in the last 24 hours · {pct(botShare, now.total)} from self-identified bots
          </div>
        </div>
        <dl className="grid grid-cols-2 gap-4 sm:grid-cols-5">
          {SERIES.map((s) => (
            <div key={s.key} className="rounded-lg border border-ink-600/40 p-3">
              <dt className="flex items-center gap-1.5 font-mono text-[11px] text-ink-400">
                <span className="inline-block size-2 rounded-sm" style={{ background: s.color }} />
                {s.label}
              </dt>
              <dd className="mt-1 text-lg font-semibold">{compact(o[s.key])}</dd>
              <dd className="font-mono text-[10px] text-ink-400">{pct(o[s.key], now.total)}</dd>
            </div>
          ))}
        </dl>
      </section>

      <Section title="Last 24 hours" sub="Requests per hour, by outcome. Hours in UTC.">
        <Legend />
        <StackedBars columns={hourly} series={SERIES} labelEvery={6} ariaLabel="Requests per hour by outcome" />
      </Section>

      {days.length > 0 && (
        <Section
          title="Daily"
          sub={`One bar per complete UTC day, kept indefinitely. History starts ${daily[0].date}: older raw logs had already rotated away.`}
        >
          <Legend />
          <StackedBars columns={days} series={SERIES} ariaLabel="Requests per day by outcome" />
        </Section>
      )}

      <Section
        title="Who is crawling"
        sub="Grouped by the user agent each request claims, which is not verified: a scraper posing as Googlebot counts as Googlebot. The challenge page checks IPs instead, so impostors tend to show up as challenged. Served counts pages only: a crawler reading /robots.txt is counted under robots.txt, since that file is where disallowed bots are told to stay out. Last 24 hours."
      >
        <CrawlerTable rows={now.crawlers} total={now.total} />
      </Section>

      {scraper.total > 0 && (
        <Section
          title={`Tracked: ${latest.tracked!.label.toLowerCase()}`}
          sub="Last 24 hours."
        >
          {watch && (
            <p className="font-mono text-xs text-ink-400">
              {watch.blocked + watch.slowed} user agents · {watch.blocked} blocked · {watch.slowed} slowed
              {scraper.bits ? ` (${scraper.bits}-bit)` : ""}
              {watch.updated ? ` · checked ${ago(watch.updated)}` : ""}
            </p>
          )}
          <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
            {[
              ["Pages taken", compact(scraper.pages), "served page loads"],
              ["Blocked", compact(scraper.outcomes.blocked), pct(scraper.outcomes.blocked, scraper.total)],
              ["Challenged", compact(scraper.outcomes.challenged), pct(scraper.outcomes.challenged, scraper.total)],
              ["IPs", compact(scraper.ips), "distinct, last 24 h"],
              ["Networks", compact(scraper.prefixes), "distinct /24s"],
              [
                "Solve time",
                scraper.solve.p50 === null ? "—" : `${scraper.solve.p50} s`,
                // A blocked UA never gets the challenge page, so a blank here can mean "nothing to time".
                scraper.solve.p90 !== null
                  ? `median · p90 ${scraper.solve.p90} s`
                  : scraper.outcomes.challenged > 0
                    ? "none solved"
                    : scraper.outcomes.blocked > 0
                      ? "all blocked, none challenged"
                      : "median",
              ],
            ].map(([label, value, note]) => (
              <div key={label} className="rounded-lg border border-ink-600/40 p-3">
                <dt className="font-mono text-[11px] text-ink-400">{label}</dt>
                <dd className="mt-1 text-lg font-semibold">{value}</dd>
                <dd className="font-mono text-[10px] text-ink-400">{note}</dd>
              </div>
            ))}
          </dl>
          <Legend />
          <StackedBars columns={scraperHourly} series={SERIES} labelEvery={6} ariaLabel="Tracked scraper requests per hour by outcome" />
          {scraperDays.length > 0 && (
            <StackedBars columns={scraperDays} series={SERIES} ariaLabel="Tracked scraper requests per day by outcome" />
          )}
          {watch && watch.events.length > 0 && (
            <ol className="space-y-1 font-mono text-[11px] text-ink-400">
              {watch.events
                .slice(-10)
                .reverse()
                .map((e, i) => (
                  <li key={i}>
                    <span className="text-ink-100">{e.ts.slice(5, 16).replace("T", " ")} UTC</span> · {eventText(e)}
                  </li>
                ))}
            </ol>
          )}
        </Section>
      )}

      <Section
        title="By site"
        sub="The projects on the front page. Blocked includes challenged. Latency is for served requests only. Last 24 hours."
      >
        <SiteTable rows={siteRows} />
      </Section>

      <footer className="space-y-1 border-t border-ink-600/30 pt-6 font-mono text-[11px] text-ink-400">
        {SERIES.map((s) => (
          <p key={s.key}>
            <span className="text-ink-100/80">{s.label}</span>: {s.note}
          </p>
        ))}
        <p className="pt-2">Aggregates only. No IP addresses, paths or query strings are stored or shown.</p>
      </footer>
    </main>
  );
}
