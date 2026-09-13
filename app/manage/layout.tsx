import { requireOwner } from "@/lib/session";
import ViewportFrame from "@/components/manage/ViewportFrame";

export const dynamic = "force-dynamic";

// The console is ONE screen: an interactive Claude session. Owner-gated shell only.
export default async function ManageLayout({ children }: { children: React.ReactNode }) {
  await requireOwner();
  return (
    <ViewportFrame>
      <header className="flex items-center justify-between border-b border-ink-600/30 pb-3">
        <span className="font-mono text-sm tracking-widest text-ink-100">th3-sh0p</span>
        <a
          href="/api/manage/logout"
          className="font-mono text-xs text-ink-400 hover:text-ink-100"
        >
          sign out
        </a>
      </header>
      <div className="flex min-h-0 flex-1 flex-col">{children}</div>
    </ViewportFrame>
  );
}
