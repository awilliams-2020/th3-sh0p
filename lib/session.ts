import "server-only";
import { createHmac, timingSafeEqual } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ownerAllowed } from "@/lib/google-oauth";

// Signed session cookie for the /manage console. The Google OAuth owner flow
// (lib/google-oauth.ownerAllowed) proves identity; on success the callback mints
// one of these so /manage doesn't re-run OAuth on every request. HMAC-signed, not
// encrypted — it carries only the owner email + expiry, no secrets.
const COOKIE = "manage_session";
const MAX_AGE_S = 60 * 60 * 24 * 30; // 30 days

function secret(): string {
  const s = process.env.MANAGE_SESSION_SECRET;
  if (!s) throw new Error("MANAGE_SESSION_SECRET is not set");
  return s;
}

function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

/** Build the signed cookie value for an authenticated owner. */
export function mintSession(email: string): { name: string; value: string; maxAge: number } {
  const exp = Math.floor(Date.now() / 1000) + MAX_AGE_S;
  const payload = `${Buffer.from(email).toString("base64url")}.${exp}`;
  return { name: COOKIE, value: `${payload}.${sign(payload)}`, maxAge: MAX_AGE_S };
}

/** Verify a cookie value → owner email, or null if invalid/expired/not-an-owner. */
export function readSession(value: string | undefined): string | null {
  if (!value) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [emailB64, expStr, mac] = parts;
  const expected = sign(`${emailB64}.${expStr}`);
  const a = Buffer.from(mac);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  const exp = Number(expStr);
  if (!Number.isFinite(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  let email: string;
  try {
    email = Buffer.from(emailB64, "base64url").toString("utf8");
  } catch {
    return null;
  }
  // Re-check ownership on every read: revoking access = removing the email from
  // GSC_OWNER_EMAIL, no need to also invalidate live cookies.
  return ownerAllowed(email) ? email : null;
}

/** Current authenticated owner email, or null. */
export async function currentOwner(): Promise<string | null> {
  const jar = await cookies();
  return readSession(jar.get(COOKIE)?.value);
}

/** Guard for /manage server components: returns the owner email, or sends the
 *  visitor back to the home page — the single OAuth entry point (the avatar).
 *  We deliberately don't start OAuth here: login lives on "/", so /manage never
 *  duplicates the connect flow and unauthenticated visitors just see the public site. */
export async function requireOwner(): Promise<string> {
  const email = await currentOwner();
  if (!email) redirect("/");
  return email;
}

export const SESSION_COOKIE = COOKIE;
