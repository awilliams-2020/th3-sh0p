import "server-only";

// Server-side client for the agent-worker (internal `ops` network). Browser
// never talks to the worker directly — th3-sh0p proxies, owner-gated.
export const WORKER_BASE = process.env.AGENT_WORKER_URL ?? "http://agent-worker:4000";
const TOKEN = process.env.WORKER_TOKEN ?? "";

export function workerHeaders(extra: Record<string, string> = {}): Record<string, string> {
  return { ...(TOKEN ? { authorization: `Bearer ${TOKEN}` } : {}), ...extra };
}

export async function workerPost(path: string, body: unknown): Promise<Response> {
  return fetch(`${WORKER_BASE}${path}`, {
    method: "POST",
    headers: workerHeaders({ "content-type": "application/json" }),
    body: JSON.stringify(body ?? {}),
  });
}

export async function workerGet(path: string): Promise<Response> {
  return fetch(`${WORKER_BASE}${path}`, { headers: workerHeaders(), cache: "no-store" });
}

export async function workerDelete(path: string): Promise<Response> {
  return fetch(`${WORKER_BASE}${path}`, { method: "DELETE", headers: workerHeaders() });
}
