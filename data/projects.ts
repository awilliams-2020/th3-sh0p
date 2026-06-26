export type Project = {
  slug: string;
  name: string;
  url: string;
  domain: string;
  gscProperty: string;
  // Bing Webmaster siteUrl — the full verified URL (Bing has no sc-domain: form).
  bingSite: string;
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
    slug: "budget-ceo",
    name: "budget.ceo",
    url: "https://budget.ceo",
    domain: "budget.ceo",
    gscProperty: "sc-domain:budget.ceo",
    bingSite: "https://budget.ceo",
    blurb: "Free burn rate and runway calculator with stage presets, scenario sliders, and shareable URLs.",
    stack: ["Astro", "TypeScript"],
    year: 2026,
  },
  {
    slug: "mayleeflowers",
    name: "mayleeflowers.com",
    url: "https://mayleeflowers.com",
    domain: "mayleeflowers.com",
    gscProperty: "sc-domain:mayleeflowers.com",
    bingSite: "https://mayleeflowers.com",
    blurb: "Nationwide flower and gift delivery shop powered by the Florist One API, with Authorize.Net checkout and Resend order confirmations.",
    stack: ["Node.js", "Express", "Florist One API", "Authorize.Net"],
    year: 2026,
  },
  {
    slug: "confession-board",
    name: "confessionboard.com",
    url: "https://confessionboard.com",
    domain: "confessionboard.com",
    gscProperty: "sc-domain:confessionboard.com",
    bingSite: "https://confessionboard.com",
    blurb: "Location-based PWA where anonymous confessions stay pinned to GPS coordinates for nearby visitors to find.",
    stack: ["Next.js", "Postgres", "Leaflet", "Tailwind"],
    year: 2025,
  },
  {
    slug: "media-generation",
    name: "media.th3-sh0p.com",
    url: "https://media.th3-sh0p.com",
    domain: "media.th3-sh0p.com",
    gscProperty: "sc-domain:media.th3-sh0p.com",
    bingSite: "https://media.th3-sh0p.com",
    blurb: "Automated faceless-video generation network — schedules trend-driven AI Shorts across YouTube channels and drives the per-niche explore/exploit kill gate.",
    stack: ["FastAPI", "HTMX", "TimescaleDB", "APScheduler"],
    year: 2026,
  },
];

export const getProject = (slug: string) =>
  projects.find((p) => p.slug === slug);
