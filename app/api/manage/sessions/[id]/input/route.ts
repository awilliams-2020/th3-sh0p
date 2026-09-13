import { NextRequest, NextResponse } from "next/server";
import { currentOwner } from "@/lib/session";
import { workerPost } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentOwner())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const r = await workerPost(`/sessions/${encodeURIComponent(id)}/input`, { text: body?.text ?? "" });
  return new NextResponse(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });
}
