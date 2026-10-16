import type { Metadata } from "next";
import { LegalPage } from "../legal";

export const metadata: Metadata = { title: "Privacy — zwznco", description: "What zwznco.com collects and how its Google sign-in is used." };

export default function Privacy() {
  return (
    <LegalPage title="Privacy policy" updated="October 16, 2026">
      <p>
        zwznco.com is the personal site and operator console of Adam Williams. This page covers zwznco.com and the
        operator tools that run behind it.
      </p>

      <h2>Visitors</h2>
      <p>
        The site uses no analytics, advertising or tracking scripts, and sets no cookies for visitors. Like any web
        server, it keeps short-lived request logs (IP address, time, page requested, browser user agent) for security
        and troubleshooting. They are rotated within about two weeks and are not shared or used for anything else.
      </p>

      <h2>Google sign-in (the site owner only)</h2>
      <p>
        Signing in with Google is for the site owner. Only the owner&apos;s own Google account is accepted; anyone else
        who tries is turned away and nothing about them is stored. Signing in sets a session cookie, plus a short-lived
        cookie (10 minutes) that protects the sign-in itself.
      </p>
      <p>The owner&apos;s Google sign-in gives zwznco.com&apos;s tools access to:</p>
      <ul>
        <li>Google Search Console, to show search traffic for the owner&apos;s own websites.</li>
        <li>Google Ads, to research keywords and manage the owner&apos;s own advertising account.</li>
        <li>Google&apos;s Data Manager API, to report conversions from the owner&apos;s own websites to that advertising account.</li>
      </ul>
      <p>
        That data is used only for those purposes, only for the owner, and is never sold, shared or used for
        advertising. Google access tokens are stored encrypted, and access can be revoked at any time at{" "}
        <a href="https://myaccount.google.com/permissions">myaccount.google.com/permissions</a>.
      </p>
      <p>
        zwznco.com&apos;s use and transfer of information received from Google APIs adheres to the{" "}
        <a href="https://developers.google.com/terms/api-services-user-data-policy">Google API Services User Data Policy</a>,
        including the Limited Use requirements.
      </p>

      <h2>Contact</h2>
      <p>
        Questions: <a href="mailto:adam@zwznco.com">adam@zwznco.com</a>.
      </p>
    </LegalPage>
  );
}
