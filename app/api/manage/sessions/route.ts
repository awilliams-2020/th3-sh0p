import { NextRequest, NextResponse } from "next/server";
import { currentOwner } from "@/lib/session";
import { workerGet, workerPost } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// List live sessions so the console can reattach to a running one after a reload
// (the fix for "orphaned session hangs with kill and no progress").
export async function GET() {
  if (!(await currentOwner())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await workerGet("/sessions");
  return new NextResponse(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });
}

// Create a new Claude session on the worker.
export async function POST(req: NextRequest) {
  if (!(await currentOwner())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = await req.json().catch(() => ({}));
  const r = await workerPost("/sessions", { cwd: body?.cwd ?? "/workspace" });
  return new NextResponse(await r.text(), {
    status: r.status,
    headers: { "content-type": "application/json" },
  });
}
