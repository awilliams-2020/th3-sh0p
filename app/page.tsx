import Image from "next/image";
import { projects } from "@/data/projects";
import { ProjectCard } from "@/components/ProjectCard";

export const revalidate = 300;

const GSC_STATUS: Record<string, string> = {
  connected: "✓ Search Console connected — stats refresh within the hour.",
  forbidden: "That Google account isn't an allowed owner. Set GSC_OWNER_EMAIL and retry.",
  norefresh: "Google returned no refresh token. Revoke access at myaccount.google.com/permissions, then retry.",
  denied: "Connection cancelled.",
  badstate: "Connection failed (state mismatch). Try again.",
  unconfigured: "OAuth client not configured (GSC_CLIENT_ID/SECRET).",
  error: "Connection failed. Try again.",
};

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ gsc?: string }>;
}) {
  const { gsc } = await searchParams;
  const status = gsc ? GSC_STATUS[gsc] : undefined;

  return (
    <main className="space-y-16">
      {status && (
        <div className="rounded-lg border border-ink-600/40 px-4 py-2 font-mono text-xs text-ink-100/80">
          {status}
        </div>
      )}
      <header className="flex items-start gap-5">
        {/* Clicking the avatar starts the Google Search Console OAuth connect (owner-gated). */}
        <a
          href="/api/auth/google"
          title="Connect Google Search Console"
          aria-label="Connect Google Search Console"
          className="shrink-0"
        >
          <Image
            src="/avatar.jpg"
            alt="Adam Williams"
            width={56}
            height={56}
            className="size-14 rounded-full object-cover transition hover:opacity-80 hover:ring-2 hover:ring-ink-400/40"
            priority
          />
        </a>
        <div className="space-y-2">
          <h1 className="font-mono text-sm tracking-tight">Adam Williams</h1>
          <p className="max-w-xl text-sm leading-relaxed text-ink-100/80">
            Building small, useful software. Below: live projects with their
            30-day Search Console traffic, refreshed automatically.
          </p>
        </div>
      </header>

      <section className="grid gap-5 sm:grid-cols-2">
        {projects.map((p) => (
          <ProjectCard key={p.slug} project={p} />
        ))}
      </section>

      <footer className="border-t border-ink-600/30 pt-6 font-mono text-[11px] text-ink-400">
        <span>th3-sh0p</span>
        <span className="px-2">·</span>
        <a
          href="https://linkedin.com/in/awilliams1989"
          target="_blank"
          rel="noopener noreferrer"
          className="hover:text-ink-100"
        >
          linkedin.com/in/awilliams1989
        </a>
      </footer>
    </main>
  );
}
