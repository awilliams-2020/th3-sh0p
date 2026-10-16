// Shared frame for /privacy and /terms: plain, readable, matching the site's mono header style.
export function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <main className="max-w-2xl space-y-6">
      <a href="/" className="font-mono text-xs text-ink-400 hover:text-ink-100">← zwznco</a>
      <header className="space-y-1">
        <h1 className="font-mono text-sm tracking-tight">{title}</h1>
        <p className="font-mono text-[11px] text-ink-400">Last updated {updated}</p>
      </header>
      <div className="space-y-4 text-sm leading-relaxed text-ink-100/80 [&_h2]:pt-2 [&_h2]:font-mono [&_h2]:text-xs [&_h2]:text-ink-100 [&_a]:underline [&_a]:decoration-dotted [&_a]:underline-offset-4 [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5">
        {children}
      </div>
    </main>
  );
}
