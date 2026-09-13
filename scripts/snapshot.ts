import { chromium } from "playwright";
import { promises as fs } from "fs";
import path from "path";
import { projects } from "../data/projects";

const OUT = path.join(process.cwd(), "public", "snapshots");

async function run() {
  await fs.mkdir(OUT, { recursive: true });
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 2,
  });
  for (const p of projects) {
    const page = await ctx.newPage();
    const out = path.join(OUT, `${p.slug}.png`);
    try {
      console.log(`→ ${p.url}`);
      await page.goto(p.url, { waitUntil: "domcontentloaded", timeout: 20_000 });
      await page.waitForTimeout(2500);
      const png = await page.screenshot({ fullPage: false, type: "png" });
      await fs.writeFile(out, png);
      console.log(`  saved ${out}`);
    } catch (err) {
      console.error(`  failed ${p.slug}:`, (err as Error).message);
    } finally {
      await page.close();
    }
  }
  await browser.close();
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
