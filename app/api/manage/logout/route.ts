import { NextResponse } from "next/server";
import { APP_URL } from "@/lib/google-oauth";
import { SESSION_COOKIE } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Clear the console session and return to the public site.
export async function GET() {
  const res = NextResponse.redirect(`${APP_URL}/`);
  res.cookies.delete(SESSION_COOKIE);
  return res;
}
