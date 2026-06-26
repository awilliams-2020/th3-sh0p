import "server-only";
import { google } from "googleapis";

// Public site URL — the OAuth redirect must be a real, browser-reachable HTTPS URL (not localhost),
// which is the whole point of doing this in-app instead of via a CLI loopback flow.
export const APP_URL = process.env.APP_URL ?? "https://th3-sh0p.com";
export const REDIRECT_URI = `${APP_URL}/api/auth/google/callback`;

// webmasters.readonly to query Search Console; openid+email so we can verify who consented.
export const GSC_SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "openid",
  "email",
];

/** OAuth2 client wired to the public callback. null if client credentials aren't configured. */
export function oauthClient() {
  const clientId = process.env.GSC_CLIENT_ID;
  const clientSecret = process.env.GSC_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return new google.auth.OAuth2(clientId, clientSecret, REDIRECT_URI);
}

/** Only the owner(s) in GSC_OWNER_EMAIL (comma-separated) may store a token. The avatar is publicly
 *  clickable, so this stops a random visitor from overwriting the real token with their own. */
export function ownerAllowed(email: string | null | undefined): boolean {
  const allow = (process.env.GSC_OWNER_EMAIL ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  if (allow.length === 0) return false; // not configured → deny by default
  return !!email && allow.includes(email.toLowerCase());
}
