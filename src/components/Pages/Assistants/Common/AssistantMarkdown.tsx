'use client';

import * as React from 'react';
import Markdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { useTheme } from 'next-themes';
import oneLight from '@/components/Pages/Interfaces/Blocks/Selection/Views/Markdown/Themes/one-light';
import oneDark from '@/components/Pages/Interfaces/Blocks/Selection/Views/Markdown/Themes/one-dark';

const DEFAULT_PROSE =
  'prose-xs prose max-w-none dark:prose-invert prose-headings:text-sm prose-p:text-sm ' +
  'prose-li:text-sm prose-a:text-primary prose-code:text-xs prose-pre:my-2 prose-pre:bg-transparent ' +
  'prose-pre:p-0 prose-pre:text-xs';

/**
 * Syntax-highlighted code block that themes itself off the design tokens
 * (`--code-*`) so it reads correctly in both light and dark mode. Inline code
 * (no newline / no language class) renders as a token chip.
 */
function AssistantCodeBlock({ className, children, inline: providedInline, ...props }: any) {
  const codeString = String(children).replace(/\n$/, '');
  const isInline =
    providedInline !== undefined ? providedInline : !codeString.includes('\n') && !className;
  const { theme } = useTheme();
  const style = theme === 'dark' ? oneDark : oneLight;
  const match = /language-(\w+)/.exec(className || '');

  if (!isInline) {
    return (
      <SyntaxHighlighter
        style={style as Record<string, React.CSSProperties>}
        language={match ? match[1] : 'text'}
        PreTag="div"
        wrapLongLines
        customStyle={{
          margin: 0,
          padding: '0.75em',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          overflow: 'auto',
          maxWidth: '100%',
          borderRadius: 'var(--radius)',
          border: '1px solid var(--code-border)',
          backgroundColor: 'var(--code-bg)',
          color: 'var(--code-fg)',
          fontSize: '0.75rem',
        }}
        {...props}
      >
        {codeString}
      </SyntaxHighlighter>
    );
  }

  return (
    <code
      className={(className ? className + ' ' : '') + 'font-mono'}
      style={{
        display: 'inline',
        backgroundColor: 'var(--code-bg)',
        color: 'var(--code-fg)',
        padding: '0.2em 0.4em',
        borderRadius: '3px',
        fontSize: '85%',
        whiteSpace: 'pre-wrap',
        border: '1px solid var(--code-border)',
      }}
      {...props}
    >
      {children}
    </code>
  );
}

interface AssistantMarkdownProps {
  children: string;
  className?: string;
}

/**
 * Shared GitHub-flavoured markdown renderer for assistant Brain surfaces
 * (Knowledge/Guidance documents, function docstrings/source). Centralises the
 * code-block + prose styling so every surface renders documents identically.
 */
export function AssistantMarkdown({ children, className }: AssistantMarkdownProps) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={{ code: AssistantCodeBlock }}
      className={className ?? DEFAULT_PROSE}
    >
      {children}
    </Markdown>
  );
}

/** Wrap raw source in a fenced code block so it renders via the highlighter. */
export function fencedCode(source: string, language?: string): string {
  return '```' + (language ?? '') + '\n' + source + '\n```';
}
