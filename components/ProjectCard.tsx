import Image from "next/image";
import Link from "next/link";
import { promises as fs } from "fs";
import path from "path";
import type { Project } from "@/data/projects";
import { getGscReport } from "@/lib/gsc";

async function snapshotExists(slug: string) {
  try {
    await fs.access(path.join(process.cwd(), "public", "snapshots", `${slug}.png`));
    return true;
  } catch {
    return false;
  }
}

function fmt(n: number) {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return n.toString();
}

export async function ProjectCard({ project }: { project: Project }) {
  const [gsc, hasSnap] = await Promise.all([
    getGscReport(project.gscProperty),
    snapshotExists(project.slug),
  ]);
  const w30 = gsc.windows.find((w) => w.days === 30);

  return (
    <Link
      href={`/p/${project.slug}`}
      className="group block rounded-xl border border-ink-600/40 bg-ink-900/40 transition hover:border-ink-400/60 hover:bg-ink-900/70"
    >
      <div className="relative aspect-[16/10] overflow-hidden rounded-t-xl bg-ink-600/20">
        {hasSnap ? (
          <Image
            src={`/api/snapshots/${project.slug}`}
            alt={`${project.name} screenshot`}
            fill
            sizes="(min-width: 768px) 50vw, 100vw"
            className="object-cover object-top transition group-hover:scale-[1.02]"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-xs text-ink-400 font-mono">
            no snapshot yet
          </div>
        )}
      </div>
      <div className="space-y-4 p-5">
        <div className="flex items-baseline justify-between gap-3">
          <h3 className="font-mono text-sm tracking-tight">{project.name}</h3>
          <span className="font-mono text-[10px] text-ink-400">{project.year}</span>
        </div>
        <p className="text-sm leading-snug text-ink-100/80">{project.blurb}</p>
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
        <dl className="grid grid-cols-3 gap-3 border-t border-ink-600/30 pt-4 font-mono text-[11px]">
          <div>
            <dt className="text-ink-400">30d clicks</dt>
            <dd className="mt-0.5 text-sm">{w30 ? fmt(w30.clicks) : "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-400">30d imps</dt>
            <dd className="mt-0.5 text-sm">{w30 ? fmt(w30.impressions) : "—"}</dd>
          </div>
          <div>
            <dt className="text-ink-400">30d pos</dt>
            <dd className="mt-0.5 text-sm">
              {w30 && w30.position > 0 ? w30.position.toFixed(1) : "—"}
            </dd>
          </div>
        </dl>
      </div>
    </Link>
  );
}
