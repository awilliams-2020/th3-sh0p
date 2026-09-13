import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { oauthClient, GSC_SCOPES } from "@/lib/google-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Clicking the avatar hits this: kick off Google consent. access_type=offline + prompt=consent
// guarantees a refresh_token comes back every time. A signed-ish state cookie guards against CSRF.
export async function GET(req: NextRequest) {
  const oauth = oauthClient();
  if (!oauth) {
    return NextResponse.json(
      { error: "Set GSC_CLIENT_ID and GSC_CLIENT_SECRET in the environment." },
      { status: 500 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const url = oauth.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: GSC_SCOPES,
    state,
  });

  const res = NextResponse.redirect(url);
  res.cookies.set("gsc_oauth_state", state, {
    httpOnly: true,
    secure: true,
    sameSite: "lax", // sent on the top-level GET redirect back from Google
    path: "/",
    maxAge: 600,
  });

  // Remember where to land after login (internal paths only) so /manage round-trips cleanly.
  const next = req.nextUrl.searchParams.get("next");
  if (next && next.startsWith("/") && !next.startsWith("//")) {
    res.cookies.set("manage_next", next, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  }
  return res;
}
