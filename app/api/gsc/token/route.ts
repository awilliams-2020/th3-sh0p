import { NextResponse } from "next/server";
import { currentOwner } from "@/lib/session";
import { readRefreshToken, tokenMeta } from "@/lib/gsc-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Owner-only: reveal the stored GSC refresh token so it can be copied into other
// tooling (e.g. project-research/.env). Gated by the manage session cookie — the
// same owner check as the rest of /api/manage. Never cached; token is not logged.
export async function GET() {
  if (!(await currentOwner())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const refresh_token = await readRefreshToken();
  if (!refresh_token) {
    return NextResponse.json({ error: "no token stored" }, { status: 404 });
  }
  const meta = await tokenMeta();
  return NextResponse.json(
    { refresh_token, email: meta?.email, updated_at: meta?.updated_at },
    { headers: { "Cache-Control": "no-store" } },
  );
}
