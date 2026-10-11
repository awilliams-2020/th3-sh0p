import Link from "next/link";
import { projects } from "@/data/projects";
import { OUTCOMES, OUTCOME_META, compact, getLatest, scope } from "@/lib/traffic";

// Homepage teaser for /traffic: 24h total and the outcome split as one bar.
export async function TrafficSummary() {
  const raw = await getLatest();
  if (!raw) return null;
  const latest = scope(raw, projects.map((p) => p.slug));
  const top = latest.crawlers.filter((c) => c.name !== "browsers & other").slice(0, 3);

  return (
    <Link
      href="/traffic"
      className="group block space-y-4 rounded-xl border border-ink-600/40 bg-ink-900/40 p-5 transition hover:border-ink-400/60 hover:bg-ink-900/70"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="font-mono text-sm tracking-tight">Edge traffic</h2>
        <span className="font-mono text-[11px] text-ink-400 transition group-hover:text-ink-100">
          dashboard →
        </span>
      </div>
      <p className="text-sm leading-snug text-ink-100/80">
        {compact(latest.total)} requests to these projects in the last 24 hours. Busiest
        crawlers: {top.map((c) => `${c.name} (${compact(c.requests)})`).join(", ")}.
      </p>
      <div className="space-y-2">
        <span className="flex h-2 gap-[2px] overflow-hidden rounded-sm" aria-hidden>
          {OUTCOMES.map((k) =>
            latest.outcomes[k] ? (
              <span
                key={k}
                style={{ flexGrow: latest.outcomes[k], flexBasis: 0, minWidth: 2, background: OUTCOME_META[k].color }}
              />
            ) : null,
          )}
        </span>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10px] text-ink-400">
          {OUTCOMES.map((k) => (
            <li key={k} className="flex items-center gap-1.5">
              <span className="inline-block size-2 rounded-sm" style={{ background: OUTCOME_META[k].color }} />
              {OUTCOME_META[k].label} {compact(latest.outcomes[k])}
            </li>
          ))}
        </ul>
      </div>
    </Link>
  );
}
