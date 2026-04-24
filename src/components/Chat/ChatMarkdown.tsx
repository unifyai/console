'use client';

import * as React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from '@/components/Pages/Interfaces/Blocks/Selection/Views/Markdown/MarkdownRenderer';
import { parseEmbedUrl, escapeEmbedTokens, InlineEmbed } from './InlineEmbed';

function markdownChildrenToPlainText(node: React.ReactNode): string {
  if (node == null || node === false) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(markdownChildrenToPlainText).join('');
  if (React.isValidElement(node)) {
    return markdownChildrenToPlainText(node.props.children as React.ReactNode);
  }
  return '';
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const chatMarkdownComponents = {
  code: CodeBlock as any,
  p: ({ children }: any) => (
    <p className="mb-2.5 whitespace-pre-wrap break-words last:mb-0">{children}</p>
  ),
  a: ({ href, children }: any) => {
    if (href) {
      const embed = parseEmbedUrl(href);
      if (embed) {
        const plain = markdownChildrenToPlainText(children).trim();
        const linkLabel = plain && !/^https?:\/\//i.test(plain) ? plain : undefined;
        return <InlineEmbed embed={{ ...embed, linkLabel }} expandedHeight={420} />;
      }
    }
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-link break-all underline decoration-1 underline-offset-2"
        onClick={(e: React.MouseEvent) => e.stopPropagation()}
      >
        {children}
      </a>
    );
  },
  ul: ({ children }: any) => <ul className="my-2 list-disc space-y-1 pl-5">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-2 list-decimal space-y-1 pl-5">{children}</ol>,
  li: ({ children }: any) => <li className="leading-relaxed">{children}</li>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-primary/40 bg-muted/30 my-2.5 rounded-r border-l-2 py-1 pl-4 pr-2 italic">
      {children}
    </blockquote>
  ),
  pre: ({ children }: any) => <div className="my-2.5 max-w-full overflow-hidden">{children}</div>,
  table: ({ children }: any) => (
    <div className="my-3 overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse text-[0.8125rem]">{children}</table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className="bg-muted/50 border-b border-border px-3 py-2 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: any) => <td className="border-border/50 border-b px-3 py-2">{children}</td>,
  h1: ({ children }: any) => <div className="text-h1-bold mb-2 mt-4 first:mt-0">{children}</div>,
  h2: ({ children }: any) => <div className="text-h2-bold mb-2 mt-4 first:mt-0">{children}</div>,
  h3: ({ children }: any) => <div className="text-h3-bold mb-1.5 mt-3 first:mt-0">{children}</div>,
  h4: ({ children }: any) => <div className="text-title mb-1 mt-2.5 first:mt-0">{children}</div>,
  hr: () => <hr className="border-border/40 my-4" />,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const remarkPlugins = [remarkGfm];

/**
 * Lightweight markdown renderer for chat messages.
 * Inherits font size and line height from the parent element instead of
 * injecting global CSS, so it fits naturally alongside chat styling.
 *
 * Wrapped in `React.memo` so the (relatively expensive) `react-markdown`
 * mdast/hast parsing pipeline is skipped whenever the surrounding chat
 * panel re-renders for unrelated reasons (most notably keystrokes in the
 * composer textarea, which would otherwise re-parse every message in the
 * conversation on every keystroke).
 */
export const ChatMarkdown = React.memo(function ChatMarkdown({ content }: { content: string }) {
  const safeContent = escapeEmbedTokens(content);
  return (
    <div className="max-w-full break-words [&_img]:max-w-full">
      <Markdown remarkPlugins={remarkPlugins} components={chatMarkdownComponents}>
        {safeContent}
      </Markdown>
    </div>
  );
});
