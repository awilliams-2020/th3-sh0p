import { NextRequest, NextResponse } from "next/server";
import { oauthClient, ownerAllowed, APP_URL } from "@/lib/google-oauth";
import { saveRefreshToken } from "@/lib/gsc-token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const back = (status: string) => NextResponse.redirect(`${APP_URL}/?gsc=${status}`);

// Google redirects the browser here after consent. Verify CSRF state, exchange the code, confirm the
// account is an allowed owner, then persist the refresh token. Statuses surface in the home-page URL.
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  if (url.searchParams.get("error")) return back("denied");

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieState = req.cookies.get("gsc_oauth_state")?.value;
  if (!code || !state || !cookieState || state !== cookieState) return back("badstate");

  const oauth = oauthClient();
  if (!oauth) return back("unconfigured");

  try {
    const { tokens } = await oauth.getToken(code);

    let email: string | undefined;
    if (tokens.id_token) {
      const ticket = await oauth.verifyIdToken({
        idToken: tokens.id_token,
        audience: process.env.GSC_CLIENT_ID,
      });
      email = ticket.getPayload()?.email ?? undefined;
    }
    if (!ownerAllowed(email)) return back("forbidden");
    if (!tokens.refresh_token) return back("norefresh");

    await saveRefreshToken(tokens.refresh_token, email);
  } catch (err) {
    console.error("[gsc-oauth] callback failed:", (err as Error).message);
    return back("error");
  }

  const res = back("connected");
  res.cookies.delete("gsc_oauth_state");
  return res;
}
