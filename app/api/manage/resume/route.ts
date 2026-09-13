import { NextResponse } from "next/server";
import { currentOwner } from "@/lib/session";
import { workerGet, workerDelete } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Read the resume handoff written by a self-deploy, so the console can offer to
// pick up where the severed session left off.
export async function GET() {
  if (!(await currentOwner())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await workerGet("/resume");
  return new NextResponse(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });
}

// Clear it once the operator has picked it up (or dismissed it).
export async function DELETE() {
  if (!(await currentOwner())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const r = await workerDelete("/resume");
  return new NextResponse(await r.text(), { status: r.status, headers: { "content-type": "application/json" } });
}
