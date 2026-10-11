export type Project = {
  slug: string;
  name: string;
  url: string;
  domain: string;
  gscProperty: string;
  // Bing Webmaster siteUrl — the full verified URL (Bing has no sc-domain: form).
  bingSite: string;
  // Matomo site id (Reporting API idSite). Omit for projects not tracked in Matomo.
  matomoSiteId?: number;
  blurb: string;
  stack: string[];
  year: number;
};

export const projects: Project[] = [
  {
    slug: "theqrcode",
    name: "theqrcode.io",
    url: "https://theqrcode.io",
    domain: "theqrcode.io",
    gscProperty: "sc-domain:theqrcode.io",
    bingSite: "https://theqrcode.io",
    matomoSiteId: 4,
    blurb: "QR code API with scan analytics, REST endpoints, and an MCP server for Claude and Cursor.",
    stack: ["Next.js", "TypeScript", "Postgres", "Stripe", "MCP"],
    year: 2024,
  },
  {
    slug: "redbudway",
    name: "redbudway.com",
    url: "https://redbudway.com",
    domain: "redbudway.com",
    gscProperty: "sc-domain:redbudway.com",
    bingSite: "https://redbudway.com",
    matomoSiteId: 1,
    blurb: "Quote-and-invoice billing app for contractors — send priced quotes, take card payments, and get daily Stripe Connect payouts.",
    stack: ["React", "Go", "Stripe Connect", "Postgres"],
    year: 2026,
  },
  {
    slug: "npiradar",
    name: "npiradar.com",
    url: "https://npiradar.com",
    domain: "npiradar.com",
    gscProperty: "sc-domain:npiradar.com",
    bingSite: "https://npiradar.com",
    blurb: "Free NPI lookup directory covering 9.2M US healthcare providers, with specialty and city pages, a check-digit validator, and an open JSON API.",
    stack: ["Next.js", "TypeScript", "Postgres", "pSEO"],
    year: 2026,
  },
  {
    slug: "camberstack",
    name: "camberstack.io",
    url: "https://camberstack.io",
    domain: "camberstack.io",
    gscProperty: "sc-domain:camberstack.io",
    bingSite: "https://camberstack.io",
    matomoSiteId: 7,
    blurb: "Google Ads MCP server: Claude, ChatGPT or Cursor read the account and propose changes. Nothing applies until you approve it, and every change can be undone.",
    stack: ["TypeScript", "Express", "MCP", "Google Ads API", "SQLite"],
    year: 2026,
  },
  {
    slug: "centurylate",
    name: "centurylate.com",
    url: "https://centurylate.com",
    domain: "centurylate.com",
    gscProperty: "sc-domain:centurylate.com",
    bingSite: "https://centurylate.com",
    blurb: "The news of exactly 100 years ago, the morning it happened, as the original newspaper clippings. Claude picks the stories; it never rewrites them.",
    stack: ["Python", "Claude API", "nginx", "Resend"],
    year: 2026,
  },
];

export const getProject = (slug: string) =>
  projects.find((p) => p.slug === slug);
