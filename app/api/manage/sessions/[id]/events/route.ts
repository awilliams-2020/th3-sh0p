import { NextRequest } from "next/server";
import { currentOwner } from "@/lib/session";
import { WORKER_BASE, workerHeaders } from "@/lib/agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Pipe the worker's SSE event stream straight through to the browser (EventSource).
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (!(await currentOwner())) return new Response("unauthorized", { status: 401 });
  const { id } = await params;
  let upstream: Response;
  try {
    upstream = await fetch(`${WORKER_BASE}/sessions/${encodeURIComponent(id)}/events`, {
      headers: workerHeaders({ accept: "text/event-stream" }),
      signal: req.signal, // client disconnect aborts the upstream stream
    });
  } catch {
    // Worker briefly unreachable (restart, socket hiccup) — an unguarded throw
    // here becomes a 500. Return a clean 502 so the client's reconnect loop treats
    // it as retryable rather than the caller seeing an opaque server error.
    return new Response("worker unavailable", { status: 502 });
  }
  if (!upstream.ok || !upstream.body) return new Response("worker unavailable", { status: 502 });
  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
    },
  });
}
