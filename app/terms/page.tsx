import type { Metadata } from "next";
import { LegalPage } from "../legal";

export const metadata: Metadata = { title: "Terms — zwznco", description: "Terms of use for zwznco.com." };

export default function Terms() {
  return (
    <LegalPage title="Terms of use" updated="October 16, 2026">
      <p>
        zwznco.com is the personal site of Adam Williams. You&apos;re welcome to read it. The project pages link to
        separate products, each with its own terms.
      </p>

      <h2>Owner tools</h2>
      <p>
        The sign-in and the tools behind it (search and advertising reporting, keyword research, conversion
        reporting) are for the site owner only and are not offered to anyone else.
      </p>

      <h2>No warranty</h2>
      <p>
        The site and anything on it are provided as is, without warranty of any kind. Figures shown, such as traffic
        snapshots, are informational and may be incomplete or out of date.
      </p>

      <h2>Changes and contact</h2>
      <p>
        These terms may change; the date above shows the latest version. Questions:{" "}
        <a href="mailto:adam@zwznco.com">adam@zwznco.com</a>. See also the <a href="/privacy">privacy policy</a>.
      </p>
    </LegalPage>
  );
}
