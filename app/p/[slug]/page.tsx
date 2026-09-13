import Image from "next/image";
import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";
import { notFound } from "next/navigation";
import { getProject } from "@/data/projects";
import { getSearchReport } from "@/lib/search";
import { getMatomoReport } from "@/lib/matomo";
import { Sparkline } from "@/components/Sparkline";

// Rendered dynamically: the GSC token (/app/.auth) and snapshot PNGs
// (/app/public/snapshots) live on runtime volumes that don't exist at build
// time, so a static render would bake in "not configured" / no screenshot.
// The GSC fetch itself stays cached via unstable_cache (1h), so this adds no
// API calls. generateStaticParams is intentionally omitted — it's ignored
// under force-dynamic anyway.
export const dynamic = "force-dynamic";

async function snapshotExists(slug: string) {
  try {
    await fs.access(
      path.join(process.cwd(), "public", "snapshots", `${slug}.png`),
    );
    return true;
  } catch {
    return false;
  }
}

function fmt(n: number) {
  return new Intl.NumberFormat("en-US").format(n);
}

function fmtPos(n: number) {
  return n > 0 ? n.toFixed(1) : "—";
}

function fmtPct(n: number) {
  return `${Math.round(n * 100)}%`;
}

function fmtDuration(seconds: number) {
  if (seconds <= 0) return "0s";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const project = getProject(slug);
  if (!project) notFound();

  const [search, matomo, hasSnap] = await Promise.all([
    getSearchReport(project),
    getMatomoReport(project.matomoSiteId),
    snapshotExists(project.slug),
  ]);

  // 30d search clicks, for the direct visits-vs-search parallel in the Traffic card.
  const search30dClicks = search.windows.find((w) => w.days === 30)?.clicks ?? 0;

  const liveEngines = [
    search.engines.google.configured && !search.engines.google.error && "Google",
    search.engines.bing.configured && !search.engines.bing.error && "Bing",
  ].filter(Boolean) as string[];

  return (
    <main className="space-y-12">
      <nav className="font-mono text-xs text-ink-400">
        <Link href="/" className="hover:text-ink-100">
          ← back
        </Link>
      </nav>

      <header className="space-y-3">
        <h1 className="font-mono text-lg tracking-tight">{project.name}</h1>
        <p className="max-w-xl text-sm leading-relaxed text-ink-100/80">
          {project.blurb}
        </p>
        <div className="flex flex-wrap gap-1.5">
          {project.stack.map((s) => (
            <span
              key={s}
              className="rounded-md border border-ink-600/40 px-1.5 py-0.5 font-mono text-[10px] text-ink-400"
            >
              {s}
            </span>
          ))}
        </div>
        <a
          href={project.url}
          target="_blank"
          rel="noreferrer"
          className="inline-block font-mono text-xs text-ink-400 underline-offset-4 hover:text-ink-100 hover:underline"
        >
          visit ↗
        </a>
      </header>

      {hasSnap && (
        <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-ink-600/40">
          <Image
            src={`/api/snapshots/${project.slug}`}
            alt={`${project.name} screenshot`}
            fill
            sizes="(min-width: 768px) 800px, 100vw"
            className="object-cover object-top"
          />
        </div>
      )}

      <section className="space-y-4">
        <h2 className="font-mono text-xs uppercase tracking-widest text-ink-400">
          Search performance
          {liveEngines.length > 0 && (
            <span className="ml-2 normal-case tracking-normal text-ink-400/70">
              {liveEngines.join(" + ")}
            </span>
          )}
        </h2>
        {search.hasData ? (
          <>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {search.windows.map((w) => (
                <div
                  key={w.days}
                  className="rounded-lg border border-ink-600/40 p-4"
                >
                  <div className="font-mono text-[10px] text-ink-400">
                    {w.days}d
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-xs">
                    <div>
                      <div className="text-ink-400">clicks</div>
                      <div className="text-sm">{fmt(w.clicks)}</div>
                    </div>
                    <div>
                      <div className="text-ink-400">imps</div>
                      <div className="text-sm">{fmt(w.impressions)}</div>
                    </div>
                    <div>
                      <div className="text-ink-400">pos</div>
                      <div className="text-sm">{fmtPos(w.position)}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-ink-600/40 p-4">
              <div className="font-mono text-[10px] text-ink-400">
                clicks · 30d
              </div>
              <div className="mt-2 text-ink-100">
                <Sparkline data={search.daily} metric="clicks" />
              </div>
            </div>
          </>
        ) : search.engines.google.error || search.engines.bing.error ? (
          <p className="font-mono text-xs text-ink-400">
            Search query failed
            {search.engines.google.error ? " · Google" : ""}
            {search.engines.bing.error ? " · Bing" : ""}.
          </p>
        ) : (
          <p className="font-mono text-xs text-ink-400">
            No search credentials configured (set GSC and/or BING_API_KEY).
          </p>
        )}
      </section>

      {search.topQueries.length > 0 && (
        <section className="space-y-4">
          <h2 className="font-mono text-xs uppercase tracking-widest text-ink-400">
            Top queries · 30d
          </h2>
          <table className="w-full font-mono text-xs">
            <thead className="text-ink-400">
              <tr className="border-b border-ink-600/30">
                <th className="py-2 text-left font-normal">query</th>
                <th className="py-2 text-right font-normal">clicks</th>
                <th className="py-2 text-right font-normal">imps</th>
                <th className="py-2 text-right font-normal">pos</th>
              </tr>
            </thead>
            <tbody>
              {search.topQueries.map((q) => (
                <tr key={q.query} className="border-b border-ink-600/20">
                  <td className="py-2">{q.query}</td>
                  <td className="py-2 text-right">{fmt(q.clicks)}</td>
                  <td className="py-2 text-right">{fmt(q.impressions)}</td>
                  <td className="py-2 text-right">{fmtPos(q.position)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {project.matomoSiteId != null && (
        <section className="space-y-4">
          <h2 className="font-mono text-xs uppercase tracking-widest text-ink-400">
            Traffic
            <span className="ml-2 normal-case tracking-normal text-ink-400/70">
              Matomo
            </span>
          </h2>
          {matomo.configured && !matomo.error ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {matomo.windows.map((w) => (
                  <div
                    key={w.days}
                    className="rounded-lg border border-ink-600/40 p-4"
                  >
                    <div className="font-mono text-[10px] text-ink-400">
                      {w.days}d
                    </div>
                    <div className="mt-2 font-mono">
                      <div className="text-ink-400 text-xs">visits</div>
                      <div className="text-lg">{fmt(w.visits)}</div>
                    </div>
                    <div className="mt-3 grid grid-cols-3 gap-2 font-mono text-xs">
                      <div>
                        <div className="text-ink-400">bounce</div>
                        <div className="text-sm">{fmtPct(w.bounceRate)}</div>
                      </div>
                      <div>
                        <div className="text-ink-400">avg time</div>
                        <div className="text-sm">{fmtDuration(w.avgTimeOnSite)}</div>
                      </div>
                      <div>
                        <div className="text-ink-400">acts/visit</div>
                        <div className="text-sm">{w.actionsPerVisit.toFixed(1)}</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="rounded-lg border border-ink-600/40 p-4">
                <div className="flex items-baseline justify-between">
                  <div className="font-mono text-[10px] text-ink-400">
                    visits · 30d
                  </div>
                  <div className="font-mono text-[10px] text-ink-400">
                    search-driven clicks · 30d: {fmt(search30dClicks)}
                  </div>
                </div>
                <div className="mt-2 text-ink-100">
                  <Sparkline data={matomo.daily} metric="visits" />
                </div>
              </div>

              {matomo.channels.length > 0 && (
                <div className="rounded-lg border border-ink-600/40 p-4">
                  <div className="font-mono text-[10px] text-ink-400">
                    channels · 30d
                  </div>
                  <table className="mt-3 w-full font-mono text-xs">
                    <tbody>
                      {matomo.channels.map((c) => (
                        <tr key={c.label} className="border-b border-ink-600/20">
                          <td className="py-2">{c.label}</td>
                          <td className="w-1/2 py-2 pl-3">
                            <div className="h-1.5 w-full rounded-full bg-ink-600/20">
                              <div
                                className="h-1.5 rounded-full bg-ink-100/50"
                                style={{ width: `${Math.round(c.share * 100)}%` }}
                              />
                            </div>
                          </td>
                          <td className="py-2 pl-3 text-right">{fmt(c.visits)}</td>
                          <td className="py-2 pl-3 text-right text-ink-400">
                            {fmtPct(c.share)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : matomo.error ? (
            <p className="font-mono text-xs text-ink-400">
              Matomo query failed ({matomo.error}).
            </p>
          ) : (
            <p className="font-mono text-xs text-ink-400">
              No Matomo credentials configured (set MATOMO_INTERNAL_URL and
              MATOMO_AUTH_TOKEN).
            </p>
          )}
        </section>
      )}

    </main>
  );
}
