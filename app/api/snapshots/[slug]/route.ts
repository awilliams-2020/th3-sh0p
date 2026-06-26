import { promises as fs } from "fs";
import path from "path";
import { getProject } from "@/data/projects";

// Serve snapshots from the mounted volume live on every request. Next's
// standalone static handler memoizes the public/ listing at startup, so a
// snapshot written for a slug that didn't exist when the container booted
// 404s until restart; reading the file ourselves sidesteps that entirely.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DIR = path.join(process.cwd(), "public", "snapshots");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  // Only serve known project slugs — guards against path traversal.
  if (!getProject(slug)) {
    return new Response("Not found", { status: 404 });
  }
  try {
    const buf = await fs.readFile(path.join(DIR, `${slug}.png`));
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=60, s-maxage=300, stale-while-revalidate=86400",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
