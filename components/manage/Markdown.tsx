"use client";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

// Render Claude's markdown in the ink/mono chat theme. Claude text arrives as whole
// blocks (not deltas), so each render is a complete markdown string.
const components: Components = {
  p: ({ node, ...p }) => <p className="mb-2 break-words last:mb-0" {...p} />,
  strong: ({ node, ...p }) => <strong className="font-semibold text-ink-100" {...p} />,
  em: ({ node, ...p }) => <em className="italic" {...p} />,
  a: ({ node, ...p }) => (
    <a className="text-amber-300 underline" target="_blank" rel="noreferrer" {...p} />
  ),
  ul: ({ node, ...p }) => <ul className="my-2 ml-4 list-disc space-y-1" {...p} />,
  ol: ({ node, ...p }) => <ol className="my-2 ml-4 list-decimal space-y-1" {...p} />,
  li: ({ node, ...p }) => <li className="break-words" {...p} />,
  h1: ({ node, ...p }) => <h1 className="mb-1 mt-3 text-sm font-semibold text-ink-100" {...p} />,
  h2: ({ node, ...p }) => <h2 className="mb-1 mt-3 text-sm font-semibold text-ink-100" {...p} />,
  h3: ({ node, ...p }) => <h3 className="mb-1 mt-2 font-semibold text-ink-100" {...p} />,
  blockquote: ({ node, ...p }) => (
    <blockquote className="my-2 border-l-2 border-ink-600 pl-2 text-ink-400" {...p} />
  ),
  hr: () => <hr className="my-3 border-ink-600/40" />,
  pre: ({ node, ...p }) => (
    <pre className="my-2 overflow-x-auto rounded bg-ink-900/70 p-2 text-[11px] text-ink-100" {...p} />
  ),
  code: ({ node, className, children, ...rest }) => {
    // Block code (inside <pre>) carries a language class or spans multiple lines;
    // inline code gets the chip styling.
    const isBlock = String(children ?? "").includes("\n") || /language-/.test(className || "");
    return isBlock ? (
      <code className={className} {...rest}>
        {children}
      </code>
    ) : (
      <code className="rounded bg-ink-600/30 px-1 py-0.5 text-[11px]" {...rest}>
        {children}
      </code>
    );
  },
  table: ({ node, ...p }) => (
    <div className="my-2 overflow-x-auto">
      <table className="w-full border-collapse text-[11px]" {...p} />
    </div>
  ),
  th: ({ node, ...p }) => <th className="border border-ink-600/40 px-2 py-1 text-left" {...p} />,
  td: ({ node, ...p }) => <td className="border border-ink-600/40 px-2 py-1" {...p} />,
};

export default function Markdown({ children }: { children: string }) {
  return (
    <div className="font-mono text-xs leading-relaxed text-ink-100">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {children}
      </ReactMarkdown>
    </div>
  );
}
