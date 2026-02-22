'use client';

import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { CodeBlock } from '@/components/Pages/Interfaces/Blocks/Selection/Views/Markdown/MarkdownRenderer';

/* eslint-disable @typescript-eslint/no-explicit-any */
const chatMarkdownComponents = {
  code: CodeBlock as any,
  p: ({ children }: any) => (
    <p className="mb-1.5 whitespace-pre-wrap break-words last:mb-0">{children}</p>
  ),
  a: ({ href, children }: any) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-link break-all"
      onClick={(e: React.MouseEvent) => e.stopPropagation()}
    >
      {children}
    </a>
  ),
  ul: ({ children }: any) => <ul className="my-1 list-disc pl-5">{children}</ul>,
  ol: ({ children }: any) => <ol className="my-1 list-decimal pl-5">{children}</ol>,
  li: ({ children }: any) => <li className="mb-0.5">{children}</li>,
  blockquote: ({ children }: any) => (
    <blockquote className="border-primary/50 my-1.5 border-l-2 pl-3 italic opacity-80">
      {children}
    </blockquote>
  ),
  pre: ({ children }: any) => <div className="my-1.5 max-w-full overflow-hidden">{children}</div>,
  table: ({ children }: any) => (
    <div className="my-1.5 overflow-x-auto">
      <table className="w-full border-collapse border border-border text-[0.8125rem]">
        {children}
      </table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className="bg-muted/50 border border-border px-2 py-1 text-left font-semibold">
      {children}
    </th>
  ),
  td: ({ children }: any) => <td className="border border-border px-2 py-1">{children}</td>,
  h1: ({ children }: any) => <p className="mb-1 mt-2 font-bold first:mt-0">{children}</p>,
  h2: ({ children }: any) => <p className="mb-1 mt-2 font-bold first:mt-0">{children}</p>,
  h3: ({ children }: any) => <p className="mb-0.5 mt-1.5 font-semibold first:mt-0">{children}</p>,
  h4: ({ children }: any) => <p className="mb-0.5 mt-1 font-semibold first:mt-0">{children}</p>,
  hr: () => <hr className="my-2 border-border" />,
};
/* eslint-enable @typescript-eslint/no-explicit-any */

const remarkPlugins = [remarkGfm];

/**
 * Lightweight markdown renderer for chat bubbles.
 * Inherits font size and line height from the parent element instead of
 * injecting global CSS, so it fits naturally inside chat bubble styling.
 */
export function ChatMarkdown({ content }: { content: string }) {
  return (
    <div className="max-w-full break-words [&_img]:max-w-full">
      <Markdown remarkPlugins={remarkPlugins} components={chatMarkdownComponents}>
        {content}
      </Markdown>
    </div>
  );
}
