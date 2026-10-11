"use client";

import { useState } from "react";

export type Series = { key: string; label: string; color: string };
export type Column = { label: string; title: string; values: Record<string, number> };

function niceMax(v: number) {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const m = v / p;
  // Steps whose quarters stay round (40K -> 10K ticks, 800K -> 200K).
  return ([1, 2, 4, 6, 8, 10].find((s) => m <= s) ?? 10) * p;
}

const fmt = new Intl.NumberFormat("en-US");

function tick(n: number) {
  if (n >= 1_000_000) return `${n / 1_000_000}M`;
  if (n >= 1000) return `${n / 1000}K`;
  return String(n);
}

// Stacked columns in plain HTML: 2px surface gaps between segments and columns, 4px rounded
// data-end, hairline grid. Hover or focus a column for every series' value at that column.
export function StackedBars({
  columns,
  series,
  height = 180,
  labelEvery = 1,
  ariaLabel,
}: {
  columns: Column[];
  series: Series[];
  height?: number;
  labelEvery?: number;
  ariaLabel: string;
}) {
  const [active, setActive] = useState<number | null>(null);
  const totals = columns.map((c) => series.reduce((s, x) => s + (c.values[x.key] ?? 0), 0));
  const max = niceMax(Math.max(...totals, 0));
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const a = active === null ? null : columns[active];

  return (
    <figure className="relative" aria-label={ariaLabel}>
      <div className="flex">
        <div className="relative w-10 shrink-0" style={{ height }}>
          {ticks.map((t) => (
            <span
              key={t}
              className="absolute right-2 -translate-y-1/2 font-mono text-[10px] tabular-nums text-ink-400"
              style={{ top: height - (t / max) * height }}
            >
              {tick(t)}
            </span>
          ))}
        </div>
        <div className="relative flex-1" style={{ height }} onMouseLeave={() => setActive(null)}>
          {ticks.map((t) => (
            <div
              key={t}
              className={`absolute inset-x-0 h-px ${t === 0 ? "bg-[#383835]" : "bg-[#2c2c2a]"}`}
              style={{ top: height - (t / max) * height }}
            />
          ))}
          <div className="absolute inset-0 flex items-end gap-[2px]">
            {columns.map((c, i) => (
              <button
                key={c.title}
                type="button"
                aria-label={`${c.title}: ${fmt.format(totals[i])} requests`}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="flex h-full flex-1 cursor-default items-end justify-center outline-none"
              >
                <span
                  className={`flex w-full max-w-[24px] flex-col-reverse gap-[2px] overflow-hidden rounded-t transition ${
                    active === i ? "brightness-125" : ""
                  }`}
                  style={{ height: (totals[i] / max) * height }}
                >
                  {series.map((s) => {
                    const v = c.values[s.key] ?? 0;
                    if (!v) return null;
                    return (
                      <span
                        key={s.key}
                        className="block w-full shrink-0"
                        style={{ flexGrow: v, flexBasis: 0, minHeight: 1, background: s.color }}
                      />
                    );
                  })}
                </span>
              </button>
            ))}
          </div>
          {a && active !== null && (
            <div
              className="pointer-events-none absolute top-0 z-10 w-44 rounded-md border border-white/10 bg-[#1a1a19] p-2.5 font-mono text-[11px] shadow-lg"
              style={{
                left: `${((active + 0.5) / columns.length) * 100}%`,
                transform: `translateX(${active / columns.length > 0.6 ? "-105%" : "5%"})`,
              }}
            >
              <div className="mb-1.5 text-ink-400">{a.title}</div>
              <div className="mb-1.5 flex justify-between">
                <span className="text-ink-400">total</span>
                <span className="font-semibold tabular-nums text-ink-50">{fmt.format(totals[active])}</span>
              </div>
              {[...series].reverse().map((s) => (
                <div key={s.key} className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-1.5 text-ink-400">
                    <span className="inline-block h-0.5 w-2.5 rounded" style={{ background: s.color }} />
                    {s.label}
                  </span>
                  <span className="tabular-nums text-ink-50">{fmt.format(a.values[s.key] ?? 0)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <div className="ml-10 mt-2 flex gap-[2px]">
        {columns.map((c, i) => (
          <span key={c.title} className="flex-1 whitespace-nowrap text-center font-mono text-[10px] text-ink-400">
            {i % labelEvery === 0 ? c.label : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}
