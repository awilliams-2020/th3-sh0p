import Image from "next/image";
import { projects } from "@/data/projects";
import { ProjectCard } from "@/components/ProjectCard";
import { currentOwner } from "@/lib/session";
import CopyRefreshToken from "@/components/CopyRefreshToken";

// Reads the session cookie to reflect login state, so this page renders per-request.
// (GSC stats are still cached independently via unstable_cache in lib/gsc.)
export const dynamic = "force-dynamic";

const GSC_STATUS: Record<string, string> = {
  connected: "✓ Search Console connected — stats refresh within the hour.",
  forbidden: "That Google account isn't authorized for this site.",
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
  const signedIn = Boolean(await currentOwner());

  return (
    <main className="space-y-16">
      {status && (
        <div className="rounded-lg border border-ink-600/40 px-4 py-2 font-mono text-xs text-ink-100/80">
          {status}
        </div>
      )}
      <header className="flex items-start gap-5">
        {/* The avatar is the single OAuth entry point. Signed out → subtle red ring, click
            starts the Google (GSC + owner) connect. Signed in → green ring, click opens the
            owner-only manage console. Visitors who aren't signed in never see the console. */}
        <a
          href={signedIn ? "/manage" : "/api/auth/google"}
          title={signedIn ? "Open manage console" : "Connect Google Search Console"}
          aria-label={signedIn ? "Open manage console" : "Connect Google Search Console"}
          className="shrink-0"
        >
          <Image
            src="/avatar.jpg"
            alt="Adam Williams"
            width={56}
            height={56}
            className={`size-14 rounded-full object-cover ring-2 ring-offset-2 ring-offset-ink-900 transition hover:opacity-80 ${
              signedIn ? "ring-emerald-500/70" : "ring-red-500/40"
            }`}
            priority
          />
        </a>
        <div className="space-y-2">
          <h1 className="font-mono text-sm tracking-tight">Adam Williams</h1>
          <p className="max-w-xl text-sm leading-relaxed text-ink-100/80">
            Building small, useful software. Below: live projects with their
            30-day Search Console traffic, refreshed automatically.
          </p>
          {signedIn && (
            <div className="space-y-3">
              <a
                href="/manage"
                className="inline-block font-mono text-xs text-emerald-400/90 transition hover:text-emerald-300"
              >
                manage console →
              </a>
              <CopyRefreshToken />
            </div>
          )}
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
