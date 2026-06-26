import "server-only";
import { chromium } from "playwright";
import { promises as fs } from "fs";
import path from "path";
import { revalidatePath } from "next/cache";
import { projects } from "@/data/projects";

const OUT = path.join(process.cwd(), "public", "snapshots");

let running = false;

export type SnapshotResult = {
  slug: string;
  ok: boolean;
  ms: number;
  error?: string;
};

export async function runSnapshots(slugs?: string[]): Promise<SnapshotResult[]> {
  if (running) throw new Error("snapshot already running");
  running = true;
  try {
    await fs.mkdir(OUT, { recursive: true });
    const targets = slugs?.length
      ? projects.filter((p) => slugs.includes(p.slug))
      : projects;
    // Hairpin avoidance: route every project domain to Traefik's container
    // directly. SNI keeps Traefik routing correct; we never leave the docker net.
    const traefikHost = process.env.TRAEFIK_HOST || "traefik";
    const hostRules = projects
      .map((p) => `MAP ${p.domain} ${traefikHost}`)
      .join(", ");
    const browser = await chromium.launch({
      args: [`--host-resolver-rules=${hostRules}`],
    });
    const ctx = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      deviceScaleFactor: 2,
    });
    // Block webfont requests so a slow CDN can't stall the screenshot step
    // (page.screenshot waits for document.fonts.ready by default).
    await ctx.route(/\.(woff2?|ttf|otf|eot)(\?.*)?$/i, (route) => route.abort());
    const results: SnapshotResult[] = [];
    for (const p of targets) {
      const t0 = Date.now();
      const page = await ctx.newPage();
      try {
        await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 20_000 });
        await page.waitForTimeout(2500);
        // CDP screenshot bypasses Playwright's document.fonts.ready wait,
        // which can hang on sites whose webfonts never load inside the network.
        const cdp = await ctx.newCDPSession(page);
        const { data } = await cdp.send("Page.captureScreenshot", {
          format: "png",
        });
        await cdp.detach();
        const png = Buffer.from(data, "base64");
        await fs.writeFile(path.join(OUT, `${p.slug}.png`), png);
        revalidatePath(`/p/${p.slug}`);
        results.push({ slug: p.slug, ok: true, ms: Date.now() - t0 });
      } catch (err) {
        results.push({
          slug: p.slug,
          ok: false,
          ms: Date.now() - t0,
          error: (err as Error).message,
        });
      } finally {
        await page.close();
      }
    }
    await browser.close();
    if (results.some((r) => r.ok)) revalidatePath("/");
    return results;
  } finally {
    running = false;
  }
}
