"use client";

import { useState } from "react";

// Owner-only affordance: fetch the stored GSC refresh token from the gated
// /api/gsc/token endpoint, copy it to the clipboard, and reveal it so it can be
// pasted into other tooling (e.g. project-research/.env). The token only leaves
// the server on an explicit click, and only for an authenticated owner.
export default function CopyRefreshToken() {
  const [token, setToken] = useState<string | null>(null);
  const [meta, setMeta] = useState<{ email?: string; updated_at?: string }>({});
  const [status, setStatus] = useState<"idle" | "loading" | "copied" | "error">("idle");
  const [msg, setMsg] = useState<string>("");

  async function reveal() {
    setStatus("loading");
    setMsg("");
    try {
      const r = await fetch("/api/gsc/token", { cache: "no-store" });
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setStatus("error");
        setMsg(r.status === 401 ? "Sign in first (click the avatar)." : e.error || `Error ${r.status}`);
        return;
      }
      const data = await r.json();
      setToken(data.refresh_token);
      setMeta({ email: data.email, updated_at: data.updated_at });
      try {
        await navigator.clipboard.writeText(data.refresh_token);
        setStatus("copied");
      } catch {
        setStatus("idle"); // clipboard blocked; token still revealed for manual copy
        setMsg("Copy blocked by browser — select the token below.");
      }
    } catch {
      setStatus("error");
      setMsg("Request failed.");
    }
  }

  async function copyAgain() {
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      setStatus("copied");
      setMsg("");
    } catch {
      setMsg("Copy blocked — select the token below.");
    }
  }

  return (
    <div className="space-y-2">
      <button
        onClick={token ? copyAgain : reveal}
        disabled={status === "loading"}
        className="inline-block font-mono text-xs text-ink-400 underline decoration-dotted underline-offset-4 transition hover:text-ink-100 disabled:opacity-50"
      >
        {status === "loading"
          ? "loading…"
          : status === "copied"
            ? "GSC refresh token copied ✓ (click to copy again)"
            : token
              ? "copy GSC refresh token again"
              : "reveal & copy GSC refresh token"}
      </button>

      {msg && <p className="font-mono text-[11px] text-red-400/80">{msg}</p>}

      {token && (
        <div className="space-y-1">
          <textarea
            readOnly
            rows={3}
            value={token}
            onFocus={(e) => e.currentTarget.select()}
            className="w-full max-w-xl rounded border border-ink-600/40 bg-ink-900/60 p-2 font-mono text-[11px] text-ink-100/90 break-all"
          />
          <p className="font-mono text-[11px] text-ink-400">
            paste into <span className="text-ink-100/80">project-research/.env</span> as{" "}
            <span className="text-ink-100/80">GSC_REFRESH_TOKEN=</span>
            {meta.email ? ` · consented: ${meta.email}` : ""}
            {meta.updated_at ? ` · updated: ${meta.updated_at.slice(0, 10)}` : ""}
          </p>
        </div>
      )}
    </div>
  );
}
