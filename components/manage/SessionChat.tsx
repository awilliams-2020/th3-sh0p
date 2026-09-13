"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import Markdown from "./Markdown";

// ---- rendered chat model ---------------------------------------------------
type Entry =
  | { key: string; kind: "user"; text: string; pending?: boolean }
  | { key: string; kind: "claude"; text: string }
  | { key: string; kind: "tool"; toolId: string; name: string; input: unknown; status: "pending" | "done" | "error"; result?: string }
  | { key: string; kind: "note"; text: string };

// A human gate. `kind` decides how it renders: a plain tool (allow/deny), a
// question (options list + free-text), or a plan (approve / revise).
type QuestionOption = { label: string; description?: string };
type Question = { question: string; header?: string; options?: QuestionOption[]; multiSelect?: boolean };
type Approval = {
  toolUseID: string;
  toolName: string;
  kind: "tool" | "question" | "plan";
  input: any;
};

// Local answer draft for a rich gate, keyed by toolUseID.
type Draft = { sel: Record<number, string[]>; chat: string; revising: boolean };

let seq = 0;
const nextKey = () => `e${++seq}`;

// Pull readable text out of an SDK tool_result content (string | block[]).
function resultText(content: unknown): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((b) => (b && typeof b === "object" && "text" in b ? String((b as { text: unknown }).text) : ""))
      .join("")
      .trim();
  }
  return "";
}

const short = (v: unknown) => {
  const s = typeof v === "string" ? v : JSON.stringify(v ?? {});
  return s.length > 140 ? s.slice(0, 140) + "…" : s;
};

export default function SessionChat() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({}); // rich-gate answer state
  const [draft, setDraft] = useState("");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [connLost, setConnLost] = useState(false); // SSE dropped — show a reconnecting hint
  const [resume, setResume] = useState<{ plan: string; ts: number } | null>(null); // handoff from a self-deploy
  const [queueOpen, setQueueOpen] = useState(true); // expand/collapse the queued-message tray
  const [editing, setEditing] = useState<{ key: string; text: string } | null>(null); // inline-editing a queued msg
  const esRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const seenSeq = useRef<Set<number>>(new Set()); // dedupe SSE replays on reconnect
  const flushing = useRef(false); // guards the queue-flush effect from double-sending

  const push = useCallback((e: Entry) => setEntries((xs) => [...xs, e]), []);

  const patchDraft = (id: string, p: Partial<Draft>) =>
    setDrafts((d) => {
      const base: Draft = d[id] ?? { sel: {}, chat: "", revising: false };
      return { ...d, [id]: { ...base, ...p } };
    });

  // Fold a worker SSE event into chat state.
  const handle = useCallback((ev: any) => {
    if (typeof ev.seq === "number") {
      if (seenSeq.current.has(ev.seq)) return; // already rendered (reconnect replay)
      seenSeq.current.add(ev.seq);
    }
    if (ev.type === "approval_request") {
      setApprovals((a) =>
        a.some((x) => x.toolUseID === ev.toolUseID)
          ? a
          : [...a, { toolUseID: ev.toolUseID, toolName: ev.toolName, kind: ev.kind || "tool", input: ev.input }]
      );
      return;
    }
    if (ev.type === "approval_resolved") {
      // The gate was answered (possibly on another device, or before a reload).
      // Drop it so a replayed buffer can't resurrect a phantom approval.
      setApprovals((a) => a.filter((x) => x.toolUseID !== ev.toolUseID));
      return;
    }
    if (ev.type === "error") return push({ key: nextKey(), kind: "note", text: `error: ${ev.error}` });
    if (ev.type === "closed") {
      // The worker session is dead (SDK ended/errored). Reusing this id would push
      // input into a queue nothing drains — the "kill CTA, no response" hang. Drop
      // the id and tear down the stream so the next message spins up a fresh session.
      setRunning(false);
      setSessionId(null);
      setApprovals([]);
      esRef.current?.close();
      esRef.current = null;
      return;
    }
    if (ev.type !== "message") return;

    const m = ev.msg;
    if (m?.type === "system" && m.subtype === "init") {
      setRunning(true);
      return;
    }
    if (m?.type === "assistant") {
      for (const b of m.message?.content ?? []) {
        if (b.type === "text" && b.text?.trim()) push({ key: nextKey(), kind: "claude", text: b.text });
        else if (b.type === "tool_use")
          push({ key: nextKey(), kind: "tool", toolId: b.id, name: b.name, input: b.input, status: "pending" });
      }
      return;
    }
    if (m?.type === "user") {
      for (const b of m.message?.content ?? []) {
        if (b.type === "tool_result") {
          const text = resultText(b.content);
          const isErr = !!b.is_error;
          setEntries((xs) => {
            const i = xs.findIndex((e) => e.kind === "tool" && e.toolId === b.tool_use_id);
            if (i < 0) return xs;
            const next = xs.slice();
            next[i] = { ...(next[i] as Extract<Entry, { kind: "tool" }>), status: isErr ? "error" : "done", result: text };
            return next;
          });
        }
      }
      return;
    }
    if (m?.type === "result") {
      setRunning(false);
      const cost = typeof m.total_cost_usd === "number" ? ` ($${m.total_cost_usd.toFixed(3)})` : "";
      push({ key: nextKey(), kind: "note", text: `— done${cost}` });
    }
  }, [push]);

  const openStream = useCallback((id: string) => {
    esRef.current?.close();
    const es = new EventSource(`/api/manage/sessions/${id}/events`);
    es.onopen = () => setConnLost(false);
    es.onmessage = (e) => {
      setConnLost(false);
      try {
        handle(JSON.parse(e.data));
      } catch {
        /* ignore keepalives / parse errors */
      }
    };
    es.onerror = () => {
      // EventSource auto-reconnects and the worker's ring buffer replays; surface
      // the gap so the operator knows why the screen paused, rather than staring
      // at a silent "kill, no progress".
      setConnLost(true);
    };
    esRef.current = es;
  }, [handle]);

  // Reattach to an already-running session after a reload. The ring-buffer replay
  // rebuilds the full transcript AND any pending approval, so a gate that was
  // waiting when the tab closed becomes actionable again instead of orphaned.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/manage/sessions", { cache: "no-store" });
        const list: { id: string; status: string }[] = r.ok ? (await r.json()).sessions ?? [] : [];
        const live = list.find((s) => s.status === "running" || s.status === "starting" || s.status === "idle");
        if (cancelled) return;
        if (live) {
          setSessionId(live.id);
          setRunning(live.status === "running" || live.status === "starting");
          openStream(live.id);
          return;
        }
        // No live session — did a self-deploy sever one and leave a handoff to pick up?
        const rr = await fetch("/api/manage/resume", { cache: "no-store" });
        if (rr.ok && !cancelled) {
          const j = await rr.json();
          if (j.resume) setResume(j.resume);
        }
      } catch {
        /* nothing to reattach to */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [openStream]);

  // While the stream is down, watch for the session vanishing entirely — that's a
  // self-deploy (or worker restart) severing us, not a transient blip. Once it's
  // confirmed gone, tear down and surface the resume handoff.
  useEffect(() => {
    if (!connLost || !sessionId) return;
    const iv = setInterval(async () => {
      try {
        const r = await fetch("/api/manage/sessions", { cache: "no-store" });
        if (!r.ok) return; // worker still restarting — keep waiting
        const list: { id: string; status: string }[] = (await r.json()).sessions ?? [];
        if (list.some((s) => s.id === sessionId && s.status !== "closed")) {
          // The session is alive and the worker is reachable, yet our stream is
          // down. The browser's native EventSource reconnect gives up FOR GOOD
          // (readyState → CLOSED) after any non-200 reconnect response — a transient
          // 429 from the rate limiter, a worker blip, etc. — and never retries, so
          // connLost would stick forever. If it's dead, force a fresh stream. A
          // still-CONNECTING ES is mid native-reconnect; leave that one alone.
          if (!esRef.current || esRef.current.readyState === EventSource.CLOSED) openStream(sessionId);
          return;
        }
        clearInterval(iv);
        esRef.current?.close();
        esRef.current = null;
        setSessionId(null);
        setRunning(false);
        setApprovals([]);
        setConnLost(false);
        const rr = await fetch("/api/manage/resume", { cache: "no-store" });
        if (rr.ok) {
          const j = await rr.json();
          if (j.resume) setResume(j.resume);
        }
      } catch {
        /* keep polling until the worker answers */
      }
    }, 4000);
    return () => clearInterval(iv);
  }, [connLost, sessionId, openStream]);

  useEffect(() => () => esRef.current?.close(), []);

  // Auto-scroll to newest.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [entries, approvals]);

  const queued = entries.filter((e): e is Extract<Entry, { kind: "user" }> => e.kind === "user" && !!e.pending);

  // Drain the queue: when the turn ends, send the oldest pending message (skipping
  // one that's mid-edit). Setting running=true re-arms this for the next in line.
  useEffect(() => {
    if (running || flushing.current || !sessionId) return;
    const next = entries.find((e) => e.kind === "user" && e.pending && e.key !== editing?.key);
    if (!next) return;
    flushing.current = true;
    setRunning(true);
    setEntries((xs) => xs.map((e) => (e.key === next.key ? { ...e, pending: false } : e)));
    fetch(`/api/manage/sessions/${sessionId}/input`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: (next as Extract<Entry, { kind: "user" }>).text }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(`input ${r.status}`);
      })
      .catch((e) => {
        setRunning(false);
        setSessionId(null); // couldn't reach the session — start fresh on the next send
        push({ key: nextKey(), kind: "note", text: `error: ${(e as Error).message}` });
      })
      .finally(() => {
        flushing.current = false;
      });
  }, [running, entries, sessionId, editing, push]);

  // Cancel a queued message; commit an inline edit (empty text drops it).
  const cancelQueued = (key: string) => setEntries((xs) => xs.filter((e) => e.key !== key));
  function saveEdit() {
    if (!editing) return;
    const t = editing.text.trim();
    setEntries((xs) => (t ? xs.map((e) => (e.key === editing.key ? { ...e, text: t } : e)) : xs.filter((e) => e.key !== editing.key)));
    setEditing(null);
  }

  // Push a user message and drive it into a session, creating one if needed.
  async function startTurn(text: string) {
    push({ key: nextKey(), kind: "user", text });
    let id = sessionId;
    try {
      if (!id) {
        const r = await fetch("/api/manage/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ cwd: "/home/awilliams" }),
        });
        if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `create ${r.status}`);
        id = (await r.json()).id as string;
        setSessionId(id);
        openStream(id);
      }
      setRunning(true);
      const r2 = await fetch(`/api/manage/sessions/${id}/input`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text }),
      });
      if (!r2.ok) throw new Error((await r2.json().catch(() => ({}))).error || `input ${r2.status}`);
    } catch (e) {
      setRunning(false);
      setSessionId(null); // don't reuse a session we couldn't reach — next send starts fresh
      push({ key: nextKey(), kind: "note", text: `error: ${(e as Error).message}` });
    }
  }

  async function send() {
    const text = draft.trim();
    if (!text) return;
    setDraft("");
    // Busy → queue it (drained by the flush effect when the turn ends).
    if (running) {
      push({ key: nextKey(), kind: "user", text, pending: true });
      return;
    }
    startTurn(text);
  }

  // Pick up the handoff a self-deploy left behind: seed a fresh session with the plan.
  function startFromResume() {
    if (!resume) return;
    const plan = resume.plan;
    setResume(null);
    fetch("/api/manage/resume", { method: "DELETE" }).catch(() => {});
    startTurn(
      `Resuming after a self-deploy. Here is the handoff plan I wrote before restarting the worker:\n\n${plan}\n\nContinue from here, and first verify the deploy succeeded.`
    );
  }

  function dismissResume() {
    setResume(null);
    fetch("/api/manage/resume", { method: "DELETE" }).catch(() => {});
  }

  // Resolve any gate. `message` (deny reason) carries a question's answer or a plan
  // revision back to Claude — that's the same semantics as the terminal, where the
  // answer becomes the model's next input.
  async function respond(a: Approval, decision: "allow" | "deny", message?: string) {
    setApprovals((list) => list.filter((x) => x.toolUseID !== a.toolUseID));
    setDrafts((d) => {
      const n = { ...d };
      delete n[a.toolUseID];
      return n;
    });
    try {
      await fetch(`/api/manage/sessions/${sessionId}/approve`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ toolUseID: a.toolUseID, decision, message }),
      });
    } catch {
      /* worker will surface downstream state */
    }
  }

  // Format the picked options + free-text into a single answer string for Claude.
  function submitAnswer(a: Approval) {
    const d = drafts[a.toolUseID] ?? { sel: {}, chat: "", revising: false };
    const qs: Question[] = a.input?.questions ?? [];
    const parts = qs
      .map((q, i) => {
        const picks = d.sel[i] ?? [];
        if (!picks.length) return null;
        const label = q.header || q.question;
        return `${label}: ${picks.join(", ")}`;
      })
      .filter(Boolean);
    if (d.chat.trim()) parts.push(d.chat.trim());
    const message = parts.join("\n") || "(no answer given)";
    respond(a, "deny", message);
  }

  function toggleOption(a: Approval, qi: number, label: string, multi: boolean) {
    const d = drafts[a.toolUseID] ?? { sel: {}, chat: "", revising: false };
    const cur = d.sel[qi] ?? [];
    const nextSel = multi
      ? cur.includes(label)
        ? cur.filter((x) => x !== label)
        : [...cur, label]
      : [label];
    patchDraft(a.toolUseID, { sel: { ...d.sel, [qi]: nextSel } });
  }

  async function stop() {
    if (!sessionId) return;
    await fetch(`/api/manage/sessions/${sessionId}/interrupt`, { method: "POST" }).catch(() => {});
  }

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto py-4">
        {entries.map((e) => {
          // Queued user messages are not rendered inline — they live in the pinned
          // tray above the composer so they don't scroll away as replies stream in.
          if (e.kind === "user") {
            if (e.pending) return null;
            return (
              <div key={e.key} className="ml-auto flex max-w-[85%] items-start justify-end gap-1.5">
                <div className="rounded-lg bg-ink-600/25 px-3 py-2">
                  <p className="whitespace-pre-wrap break-words font-mono text-xs text-ink-100">{e.text}</p>
                </div>
              </div>
            );
          }
          if (e.kind === "claude")
            return (
              <div key={e.key} className="max-w-[92%]">
                <Markdown>{e.text}</Markdown>
              </div>
            );
          if (e.kind === "note")
            return (
              <p key={e.key} className="text-center font-mono text-[10px] text-ink-400">
                {e.text}
              </p>
            );
          // tool card
          const dot = e.status === "pending" ? "bg-amber-400" : e.status === "error" ? "bg-red-400" : "bg-green-400";
          return (
            <div key={e.key} className="rounded-lg border border-ink-600/40 p-2.5">
              <div className="flex items-center gap-2">
                <span className={`h-2 w-2 shrink-0 rounded-full ${dot}`} />
                <span className="font-mono text-[11px] text-ink-100">{e.name}</span>
              </div>
              <p className="mt-1 break-words font-mono text-[10px] text-ink-400">{short(e.input)}</p>
              {e.result ? (
                <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words rounded bg-ink-900/60 p-2 font-mono text-[10px] text-ink-400">
                  {e.result.slice(0, 4000)}
                </pre>
              ) : null}
            </div>
          );
        })}
      </div>

      {resume ? (
        <div className="mb-2 rounded-lg border border-emerald-500/50 bg-emerald-500/10 p-3">
          <p className="font-mono text-[9px] uppercase tracking-wide text-emerald-300/80">resume after self-deploy</p>
          <div className="mt-1 max-h-40 overflow-auto rounded bg-ink-900/40 p-2 text-[12px]">
            <Markdown>{resume.plan}</Markdown>
          </div>
          <div className="mt-2 flex gap-2">
            <button
              onClick={startFromResume}
              className="flex-1 rounded border border-emerald-500/60 py-1.5 font-mono text-[11px] text-emerald-200"
            >
              pick up where we left off
            </button>
            <button
              onClick={dismissResume}
              className="rounded border border-ink-600/50 px-3 py-1.5 font-mono text-[11px] text-ink-400"
            >
              dismiss
            </button>
          </div>
        </div>
      ) : null}

      {connLost ? (
        <p className="mb-2 text-center font-mono text-[10px] text-amber-300">reconnecting</p>
      ) : null}

      {/* pending gates — approvals, questions, and plan reviews */}
      {approvals.map((a) => {
        const d = drafts[a.toolUseID] ?? { sel: {}, chat: "", revising: false };

        // ---- a question from Claude: options list + "chat about this" ----------
        if (a.kind === "question") {
          const qs: Question[] = a.input?.questions ?? [];
          const answered = qs.every((_, i) => (d.sel[i]?.length ?? 0) > 0) || d.chat.trim().length > 0;
          return (
            <div key={a.toolUseID} className="mb-2 space-y-3 rounded-lg border border-sky-500/50 bg-sky-500/10 p-3">
              {qs.map((q, i) => (
                <div key={i} className="space-y-1.5">
                  {q.header ? <p className="font-mono text-[9px] uppercase tracking-wide text-sky-300/80">{q.header}</p> : null}
                  <p className="font-mono text-[11px] text-ink-100">{q.question}</p>
                  <div className="flex flex-col gap-1.5">
                    {(q.options ?? []).map((opt) => {
                      const on = (d.sel[i] ?? []).includes(opt.label);
                      return (
                        <button
                          key={opt.label}
                          onClick={() => toggleOption(a, i, opt.label, !!q.multiSelect)}
                          className={`rounded border px-2.5 py-1.5 text-left font-mono text-[11px] ${
                            on ? "border-sky-400 bg-sky-400/20 text-ink-100" : "border-ink-600/50 text-ink-300"
                          }`}
                        >
                          <span className="text-sky-300">{on ? "◉" : "○"}</span> {opt.label}
                          {opt.description ? <span className="block pl-4 text-[9px] text-ink-400">{opt.description}</span> : null}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
              <textarea
                value={d.chat}
                onChange={(ev) => patchDraft(a.toolUseID, { chat: ev.target.value })}
                rows={1}
                placeholder="chat about this…"
                className="max-h-24 min-h-[34px] w-full resize-none rounded border border-ink-600/50 bg-transparent px-2.5 py-1.5 font-mono text-[11px] text-ink-100 placeholder:text-ink-400 focus:border-ink-100 focus:outline-none"
              />
              <button
                onClick={() => submitAnswer(a)}
                disabled={!answered}
                className="w-full rounded border border-sky-500/60 py-1.5 font-mono text-[11px] text-sky-200 disabled:border-ink-600/40 disabled:text-ink-500"
              >
                send answer
              </button>
            </div>
          );
        }

        // ---- a plan review: show the plan, approve or revise with feedback ------
        if (a.kind === "plan") {
          return (
            <div key={a.toolUseID} className="mb-2 space-y-2 rounded-lg border border-violet-500/50 bg-violet-500/10 p-3">
              <p className="font-mono text-[9px] uppercase tracking-wide text-violet-300/80">plan for review</p>
              <div className="max-h-56 overflow-auto rounded bg-ink-900/40 p-2 text-[12px]">
                <Markdown>{String(a.input?.plan ?? "")}</Markdown>
              </div>
              {d.revising ? (
                <>
                  <textarea
                    value={d.chat}
                    autoFocus
                    onChange={(ev) => patchDraft(a.toolUseID, { chat: ev.target.value })}
                    rows={2}
                    placeholder="what should change?"
                    className="max-h-32 min-h-[44px] w-full resize-none rounded border border-ink-600/50 bg-transparent px-2.5 py-1.5 font-mono text-[11px] text-ink-100 placeholder:text-ink-400 focus:border-ink-100 focus:outline-none"
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => respond(a, "deny", d.chat.trim() || "Keep planning — revise the approach.")}
                      className="flex-1 rounded border border-amber-500/50 py-1.5 font-mono text-[11px] text-amber-300"
                    >
                      send revision
                    </button>
                    <button
                      onClick={() => patchDraft(a.toolUseID, { revising: false })}
                      className="rounded border border-ink-600/50 px-3 py-1.5 font-mono text-[11px] text-ink-400"
                    >
                      back
                    </button>
                  </div>
                </>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => respond(a, "allow")}
                    className="flex-1 rounded border border-green-500/50 py-1.5 font-mono text-[11px] text-green-300"
                  >
                    approve &amp; proceed
                  </button>
                  <button
                    onClick={() => patchDraft(a.toolUseID, { revising: true })}
                    className="flex-1 rounded border border-amber-500/50 py-1.5 font-mono text-[11px] text-amber-300"
                  >
                    chat about this
                  </button>
                </div>
              )}
            </div>
          );
        }

        // ---- a plain tool approval: allow / deny -------------------------------
        return (
          <div key={a.toolUseID} className="mb-2 rounded-lg border border-amber-500/50 bg-amber-500/10 p-3">
            <p className="font-mono text-[11px] text-ink-100">
              Approve <span className="text-amber-300">{a.toolName}</span>?
            </p>
            <p className="mt-1 break-words font-mono text-[10px] text-ink-400">{short(a.input)}</p>
            <div className="mt-2 flex gap-2">
              <button
                onClick={() => respond(a, "allow")}
                className="flex-1 rounded border border-green-500/50 py-1.5 font-mono text-[11px] text-green-300"
              >
                approve
              </button>
              <button
                onClick={() => respond(a, "deny")}
                className="flex-1 rounded border border-red-500/50 py-1.5 font-mono text-[11px] text-red-300"
              >
                deny
              </button>
            </div>
          </div>
        );
      })}

      {/* pinned queued-message tray — stays put as replies stream in */}
      {queued.length ? (
        <div className="mb-2 rounded-lg border border-ink-600/40 bg-ink-900/30">
          <button
            onClick={() => setQueueOpen((o) => !o)}
            className="flex w-full items-center justify-between px-3 py-1.5 font-mono text-[10px] text-ink-400"
          >
            <span>
              {queued.length} queued · sent when Claude finishes
            </span>
            <span>{queueOpen ? "▾" : "▸"}</span>
          </button>
          {queueOpen ? (
            <div className="max-h-40 space-y-1.5 overflow-y-auto px-2 pb-2">
              {queued.map((e) =>
                editing?.key === e.key ? (
                  <div key={e.key}>
                    <textarea
                      value={editing.text}
                      autoFocus
                      onChange={(ev) => setEditing({ key: e.key, text: ev.target.value })}
                      onKeyDown={(ev) => {
                        if (ev.key === "Enter" && !ev.shiftKey) {
                          ev.preventDefault();
                          saveEdit();
                        }
                      }}
                      rows={1}
                      className="max-h-24 min-h-[34px] w-full resize-none rounded border border-ink-400/60 bg-transparent px-2.5 py-1.5 font-mono text-[11px] text-ink-100 focus:border-ink-100 focus:outline-none"
                    />
                    <div className="mt-1 flex justify-end gap-3">
                      <button onClick={saveEdit} className="font-mono text-[10px] text-green-300">save</button>
                      <button onClick={() => setEditing(null)} className="font-mono text-[10px] text-ink-400">cancel</button>
                    </div>
                  </div>
                ) : (
                  <div key={e.key} className="flex items-start justify-between gap-2 rounded bg-ink-600/20 px-2.5 py-1.5">
                    <button
                      onClick={() => setEditing({ key: e.key, text: e.text })}
                      className="min-w-0 flex-1 text-left"
                      aria-label="edit queued message"
                    >
                      <p className="truncate font-mono text-[11px] text-ink-200">{e.text}</p>
                    </button>
                    <button
                      onClick={() => cancelQueued(e.key)}
                      aria-label="remove queued message"
                      className="shrink-0 font-mono text-[11px] text-ink-400 hover:text-red-300"
                    >
                      ✕
                    </button>
                  </div>
                )
              )}
            </div>
          ) : null}
        </div>
      ) : null}

      {/* input row */}
      <div className="flex items-end gap-2 border-t border-ink-600/30 pt-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          rows={1}
          placeholder={running ? "Queue a message…" : "Message Claude…"}
          className="max-h-32 min-h-[38px] flex-1 resize-none rounded-lg border border-ink-400/60 bg-transparent px-3 py-2 font-mono text-xs text-ink-100 placeholder:text-ink-400 focus:border-ink-100 focus:outline-none"
        />
        {running ? (
          // One button, context-aware: type to queue, empty composer keeps kill a tap away.
          draft.trim() ? (
            <button
              onClick={send}
              className="flex h-[38px] shrink-0 items-center justify-center rounded-lg border border-ink-400/60 px-4 font-mono text-xs font-medium text-ink-100"
            >
              queue
            </button>
          ) : (
            <button
              onClick={stop}
              className="flex h-[38px] shrink-0 items-center justify-center rounded-lg border border-red-500 bg-red-500/15 px-4 font-mono text-xs font-medium text-red-300"
            >
              kill
            </button>
          )
        ) : (
          <button
            onClick={send}
            disabled={!draft.trim()}
            className="flex h-[38px] shrink-0 items-center justify-center rounded-lg bg-ink-100 px-4 font-mono text-xs font-medium text-ink-900 disabled:bg-ink-600/40 disabled:text-ink-400"
          >
            send
          </button>
        )}
      </div>
    </div>
  );
}
