"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  children: string;
  language?: "typescript" | "bash";
  className?: string;
}

const RE_COMMENTS = /(\/\/.*$)/gm;
const RE_STRINGS = /(["'`])(?:(?!\1|\\).|\\.)*\1/g;
const RE_KEYWORDS = /\b(const|let|var|import|from|export|async|await|function|return|new|type|interface)\b/g;
const RE_TYPES = /\b([A-Z][a-zA-Z0-9]*)\b/g;

const TOKEN_CLASSES: Record<string, string> = {
  comment: "text-muted-foreground/50",
  string: "text-payment",
  keyword: "text-crypto",
  type: "text-chain",
};

function highlightTS(code: string): React.ReactNode[] {
  const parts: { start: number; end: number; type: string }[] = [];
  let m: RegExpExecArray | null;

  // Reset lastIndex since these are module-level regex with /g flag
  RE_COMMENTS.lastIndex = 0;
  RE_STRINGS.lastIndex = 0;
  RE_KEYWORDS.lastIndex = 0;
  RE_TYPES.lastIndex = 0;

  while ((m = RE_COMMENTS.exec(code)) !== null)
    parts.push({ start: m.index, end: m.index + m[0].length, type: "comment" });
  while ((m = RE_STRINGS.exec(code)) !== null)
    parts.push({ start: m.index, end: m.index + m[0].length, type: "string" });
  while ((m = RE_KEYWORDS.exec(code)) !== null)
    parts.push({ start: m.index, end: m.index + m[0].length, type: "keyword" });
  while ((m = RE_TYPES.exec(code)) !== null) {
    if (!parts.some((p) => m!.index >= p.start && m!.index < p.end))
      parts.push({ start: m.index, end: m.index + m[0].length, type: "type" });
  }

  parts.sort((a, b) => a.start - b.start);

  const deduped: typeof parts = [];
  for (const p of parts) {
    if (!deduped.length || p.start >= deduped[deduped.length - 1].end) {
      deduped.push(p);
    }
  }

  const result: React.ReactNode[] = [];
  let cursor = 0;

  for (const p of deduped) {
    if (p.start > cursor) result.push(code.slice(cursor, p.start));
    result.push(
      <span key={p.start} className={TOKEN_CLASSES[p.type] || ""}>
        {code.slice(p.start, p.end)}
      </span>
    );
    cursor = p.end;
  }
  if (cursor < code.length) result.push(code.slice(cursor));

  return result;
}

export function CodeBlock({
  children,
  language = "typescript",
  className,
}: CodeBlockProps) {
  const highlighted = useMemo(
    () => (language === "bash" ? null : highlightTS(children)),
    [children, language]
  );

  return (
    <div className={cn("rounded-xl bg-code-bg p-5 overflow-x-auto", className)}>
      <pre className="text-sm font-mono leading-relaxed text-code-foreground">
        <code>
          {language === "bash" ? (
            <span className="text-payment">{children}</span>
          ) : (
            highlighted
          )}
        </code>
      </pre>
    </div>
  );
}
