import { NextRequest, NextResponse } from "next/server";
import { runSnapshots } from "@/lib/snapshot";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

function authorized(req: NextRequest) {
  const token = process.env.SNAPSHOT_TOKEN;
  if (!token) return false;
  const header = req.headers.get("authorization") ?? "";
  const expected = `Bearer ${token}`;
  if (header.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < header.length; i++) {
    diff |= header.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

async function handle(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const slug = req.nextUrl.searchParams.get("slug");
  const slugs = slug ? slug.split(",").map((s) => s.trim()).filter(Boolean) : undefined;
  try {
    const results = await runSnapshots(slugs);
    return NextResponse.json({ ok: true, results });
  } catch (err) {
    const msg = (err as Error).message;
    const status = msg === "snapshot already running" ? 409 : 500;
    return NextResponse.json({ ok: false, error: msg }, { status });
  }
}

export const POST = handle;
export const GET = handle;
