import type { ReactNode } from "react";

/**
 * Minimal renderer for docs/legal/*.md - just enough of the subset those
 * five drafts actually use (h1/h2, blockquote, bullet list, bold, inline
 * code, paragraphs). Not a general markdown engine; adding a real one
 * (remark/react-markdown) for five small, structurally-simple documents
 * would be a dependency for a problem this doesn't have.
 */
export function renderLegalMarkdown(source: string): ReactNode[] {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let paragraph: string[] = [];
  let quote: string[] = [];
  let list: string[] = [];
  let key = 0;

  function flushParagraph() {
    if (paragraph.length === 0) return;
    blocks.push(
      <p key={key++} className="mt-5 text-body text-ink-muted">
        {renderInline(paragraph.join(" "), key)}
      </p>,
    );
    paragraph = [];
  }

  function flushQuote() {
    if (quote.length === 0) return;
    blocks.push(
      <blockquote key={key++} className="mt-6 rounded-lg border border-border-strong bg-surface px-5 py-4 text-sm text-ink-muted">
        {renderInline(quote.join(" "), key)}
      </blockquote>,
    );
    quote = [];
  }

  function flushList() {
    if (list.length === 0) return;
    blocks.push(
      <ul key={key++} className="mt-5 list-disc space-y-2 pl-5 text-body text-ink-muted">
        {list.map((item, i) => (
          <li key={i}>{renderInline(item, key + i)}</li>
        ))}
      </ul>,
    );
    list = [];
  }

  function flushAll() {
    flushParagraph();
    flushQuote();
    flushList();
  }

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    if (line.startsWith("> ")) {
      flushParagraph();
      flushList();
      quote.push(line.slice(2));
      continue;
    }
    if (line.startsWith("# ")) {
      flushAll();
      blocks.push(
        <h1 key={key++} className="mt-2 font-display text-h1 text-ink">
          {line.slice(2)}
        </h1>,
      );
      continue;
    }
    if (line.startsWith("## ")) {
      flushAll();
      blocks.push(
        <h2 key={key++} className="mt-12 font-display text-h3 text-ink">
          {line.slice(3)}
        </h2>,
      );
      continue;
    }
    if (line.startsWith("- ")) {
      flushParagraph();
      flushQuote();
      list.push(line.slice(2));
      continue;
    }
    if (line.trim() === "") {
      flushAll();
      continue;
    }
    // continuation of whichever block is open
    if (quote.length > 0) quote.push(line);
    else if (list.length > 0) list[list.length - 1] += " " + line.trim();
    else paragraph.push(line);
  }
  flushAll();

  return blocks;
}

function renderInline(text: string, keySeed: number): ReactNode[] {
  const parts: ReactNode[] = [];
  const regex = /(\*\*[^*]+\*\*|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let i = 0;

  while ((match = regex.exec(text))) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (token.startsWith("**")) {
      parts.push(
        <strong key={`${keySeed}-${i}`} className="font-semibold text-ink">
          {token.slice(2, -2)}
        </strong>,
      );
    } else {
      parts.push(
        <code key={`${keySeed}-${i}`} className="rounded bg-border/50 px-1.5 py-0.5 text-[0.85em] text-ink">
          {token.slice(1, -1)}
        </code>,
      );
    }
    lastIndex = regex.lastIndex;
    i++;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
