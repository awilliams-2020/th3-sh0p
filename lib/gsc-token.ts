import "server-only";
import { promises as fs } from "fs";
import path from "path";

// Refresh token lives on the persistent volume (mounted at /app/.auth), outside public/ so it's never
// web-served. Falls back to the GSC_REFRESH_TOKEN env var so existing setups keep working.
const TOKEN_PATH = process.env.GSC_TOKEN_PATH ?? "/app/.auth/gsc.json";

type Stored = { refresh_token: string; email?: string; updated_at: string };

async function read(): Promise<Stored | null> {
  try {
    return JSON.parse(await fs.readFile(TOKEN_PATH, "utf8")) as Stored;
  } catch {
    return null; // no file yet
  }
}

export async function readRefreshToken(): Promise<string | null> {
  return (await read())?.refresh_token ?? process.env.GSC_REFRESH_TOKEN ?? null;
}

export async function saveRefreshToken(refresh_token: string, email?: string): Promise<void> {
  await fs.mkdir(path.dirname(TOKEN_PATH), { recursive: true });
  const data: Stored = { refresh_token, email, updated_at: new Date().toISOString() };
  await fs.writeFile(TOKEN_PATH, JSON.stringify(data, null, 2), { mode: 0o600 });
}

/** Non-secret metadata for showing connection status (never returns the token itself). */
export async function tokenMeta(): Promise<{ email?: string; updated_at?: string } | null> {
  const d = await read();
  return d ? { email: d.email, updated_at: d.updated_at } : null;
}
