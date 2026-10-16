// Owner-only: the operations service's Google login (~/operations: ad conversion uploads, Keyword
// Planner for research). Read server-side from its internal /status over the traefik network, so
// nothing about it is reachable from the browser; the only link out is its sign-in page.
const STATUS_URL = process.env.OPS_STATUS_URL ?? "http://operations:3000/status";
const CONNECT_URL = "https://zwznco.com/operations/connect";

type OpsStatus = {
  signed_in: boolean;
  email: string | null;
  last_ok_at: number | null;
  last_error: string | null;
  can_upload_conversions: boolean;
  can_price_keywords: boolean;
  conversions: Record<string, number>;
  connect_url: string;
};

async function load(): Promise<OpsStatus | null> {
  try {
    const r = await fetch(STATUS_URL, { cache: "no-store", signal: AbortSignal.timeout(2000) });
    return r.ok ? ((await r.json()) as OpsStatus) : null;
  } catch {
    return null;
  }
}

const ago = (unix: number | null) => {
  if (!unix) return "never";
  const m = Math.round((Date.now() / 1000 - unix) / 60);
  return m < 60 ? `${m}m ago` : m < 2880 ? `${Math.round(m / 60)}h ago` : `${Math.round(m / 1440)}d ago`;
};

export default async function OperationsCard() {
  const s = await load();
  const ok = !!s?.signed_in && s.can_upload_conversions && s.can_price_keywords;
  const missing = s?.signed_in
    ? [!s.can_upload_conversions && "Data Manager", !s.can_price_keywords && "Google Ads"].filter(Boolean).join(" + ")
    : "";
  const failed = (s?.conversions.rejected ?? 0) + (s?.conversions.gave_up ?? 0);

  return (
    <div className="space-y-1 font-mono text-xs">
      <div className={ok ? "text-ink-400" : "text-amber-400/90"}>
        operations:{" "}
        {!s
          ? "unreachable"
          : !s.signed_in
            ? "signed out — conversions are queuing"
            : missing
              ? `signed in, missing ${missing} permission`
              : `signed in · last ok ${ago(s.last_ok_at)}`}
        {s && failed > 0 && ` · ${failed} conversion${failed === 1 ? "" : "s"} failed`}
      </div>
      <a
        href={s?.connect_url ?? CONNECT_URL}
        className={`inline-block underline decoration-dotted underline-offset-4 transition ${
          ok ? "text-ink-400 hover:text-ink-100" : "text-amber-300 hover:text-amber-200"
        }`}
      >
        {ok ? "re-sign in to Google →" : "sign in to Google →"}
      </a>
    </div>
  );
}
