"use client";

import React, { ReactNode, ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import remarkBreaks from "remark-breaks";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { useTheme } from "next-themes";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import oneLight from "./Themes/one-light";
import oneDark from "./Themes/one-dark";
import { preserveLeadingSpaces } from "@/plugins/preserveLeadingSpaces";
import { preprocessMarkdown } from "@/utils/markdownPreprocessor";

// Updated CodeBlock Component with Discord-like styling for inline code
function CodeBlock({
  node,
  inline: providedInline,
  className,
  children,
  ...props
}: {
  node: any;
  inline?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const codeString = String(children).replace(/\n$/, "");
  
  const isInline =
    providedInline !== undefined ? providedInline : (!codeString.includes("\n") && !className);
  const { theme } = useTheme();
  const style = theme === "dark" ? oneDark : oneLight;
  const match = /language-(\w+)/.exec(className || "");

  if (!isInline) {
    return (
      <div
        style={{
          position: "relative",
          margin: "0.5em 0", 
          overflow: "hidden",
          borderRadius: "var(--radius)",
        }}
        className="group"
      >
        <SyntaxHighlighter
          style={style as Record<string, React.CSSProperties>}
          language={match ? match[1] : "text"}
          PreTag="div"
          wrapLongLines={true}
          customStyle={{
            margin: 0,
            padding: "0.75em",
            whiteSpace: "pre-wrap",
            borderRadius: "var(--radius)",
            border: "1px solid var(--border)",
            backgroundColor: "var(--code-block-bg, var(--card))",
          }}
          {...props}
        >
          {codeString}
        </SyntaxHighlighter>
        <CopyButton
          content={codeString}
          copyMessage="Copied code!"
          tooltipContent="Copy code"
          className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        />
      </div>
    );
  }
  
  // Use app color scheme for inline code
  const isDark = theme === "dark";
  return (
    <code
      className={className}
      style={{
        display: "inline",
        backgroundColor: isDark ? "rgba(47, 49, 54, 0.6)" : "rgba(240, 240, 240, 0.7)",
        color: "var(--primary)",
        padding: "0.2em 0.4em",
        borderRadius: "3px",
        fontSize: "85%",
        fontFamily: "\"Fira Code\", \"Fira Mono\", Menlo, Consolas, \"DejaVu Sans Mono\", monospace",
        whiteSpace: "pre-wrap",
        border: isDark ? "1px solid var(--border)" : "none",
      }}
      {...props}
    >
      {children}
    </code>
  );
}

export { CodeBlock };

//────────────────────────────────────────────────────────────
// MarkdownErrorBoundary Component (unchanged)
//────────────────────────────────────────────────────────────
type ErrorBoundaryState = { hasError: boolean };

class MarkdownErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error: any, errorInfo: any) {
    console.error("Error rendering markdown:", error, errorInfo);
  }
  render() {
    if (this.state.hasError) {
      return <div className="text-destructive">There was an error rendering the markdown content.</div>;
    }
    return this.props.children;
  }
}

// Function to generate markdown styles using CSS variables
function getMarkdownStyles() {
  return `
    .react-markdown-content {
      /* General styles */
      font-size: 1rem;
      line-height: 1.6;
      color: var(--foreground);
      
      /* Links - use primary color with underline on hover */
      a {
        color: var(--primary);
        text-decoration: none;
        border-bottom: 1px solid transparent;
        transition: border-color 0.2s, opacity 0.2s;
      }
      
      a:hover {
        border-bottom-color: var(--primary);
        opacity: 0.85;
      }
      
      /* Lists - enhanced spacing and bullets */
      ul {
        list-style-type: disc;
        padding-left: 1.5rem;
        margin-bottom: 1rem;
      }
      
      ol {
        list-style-type: decimal;
        padding-left: 1.5rem;
        margin-bottom: 1rem;
      }
      
      li {
        margin-bottom: 0.375rem;
        padding-left: 0.25rem;
      }
      
      /* Nested lists with custom bullets */
      ul ul, ol ul {
        list-style-type: circle;
        margin-top: 0.375rem;
        margin-bottom: 0.5rem;
      }
      
      ul ol, ol ol {
        list-style-type: lower-alpha;
        margin-top: 0.375rem;
        margin-bottom: 0.5rem;
      }
      
      /* Tables with your color scheme */
      table {
        border-collapse: collapse;
        width: 100%;
        margin-bottom: 1.25rem;
        border: 1px solid var(--border);
        border-radius: var(--radius);
        overflow: hidden;
      }
      
      th, td {
        padding: 0.625rem;
        border: 1px solid var(--border);
        text-align: left;
      }
      
      th {
        background-color: rgba(0, 0, 0, 0.08);
        font-weight: 600;
        color: var(--foreground);
      }
      
      tr:hover {
        background-color: rgba(0, 0, 0, 0.04);
      }
      
      /* Dark mode table adjustments */
      .dark th {
        background-color: rgba(255, 255, 255, 0.1);
      }
      
      .dark tr:hover {
        background-color: rgba(255, 255, 255, 0.05);
      }
      
      /* Blockquotes using accent color */
      blockquote {
        border-left: 4px solid var(--primary);
        padding: 0.75rem 1rem;
        margin: 1.25rem 0;
        background-color: rgba(0, 0, 0, 0.03);
        border-radius: 0 var(--radius) var(--radius) 0;
      }
      
      /* Dark mode blockquote adjustment */
      .dark blockquote {
        background-color: rgba(255, 255, 255, 0.05);
      }
      
      blockquote p {
        margin-bottom: 0.5rem;
      }
      
      blockquote p:last-child {
        margin-bottom: 0;
      }
      
      /* Headings using your color scheme */
      h1 {
        font-size: 1.75rem;
        font-weight: 700;
        margin-top: 2rem;
        margin-bottom: 1rem;
        color: var(--foreground);
        border-bottom: 1px solid var(--border);
        padding-bottom: 0.375rem;
      }
      
      h2 {
        font-size: 1.5rem;
        font-weight: 600;
        margin-top: 1.75rem;
        margin-bottom: 0.875rem;
        color: var(--foreground);
      }
      
      h3 {
        font-size: 1.25rem;
        font-weight: 600;
        margin-top: 1.5rem;
        margin-bottom: 0.75rem;
        color: var(--foreground);
      }
      
      h4 {
        font-size: 1.125rem;
        font-weight: 600;
        margin-top: 1.25rem;
        margin-bottom: 0.625rem;
        color: var(--foreground);
      }
      
      /* Paragraphs and spacing */
      p {
        margin-bottom: 1rem;
      }
      
      /* Horizontal rule */
      hr {
        border: 0;
        height: 1px;
        background-color: var(--border);
        margin: 2rem 0;
      }
      
      /* Images */
      img {
        max-width: 100%;
        height: auto;
        border-radius: var(--radius);
        border: 1px solid var(--border);
      }
      
      /* Emphasis */
      em {
        font-style: italic;
      }
      
      strong {
        font-weight: 700;
        color: var(--foreground);
      }
      
      /* Code blocks are handled by the CodeBlock component */
      
      /* Additional spacing for better readability */
      * + h1, * + h2, * + h3 {
        margin-top: 2rem;
      }
      
      /* Enhancing general readability */
      > * + * {
        margin-top: 1.25rem;
      }
    }
  `;
}

//────────────────────────────────────────────────────────────
// MarkdownRenderer Component
// Exposes options such as allowing raw HTML, additional plugins, and custom mappings.
//────────────────────────────────────────────────────────────
export interface MarkdownRendererProps {
  children: string;
  allowRawHtml?: boolean;
  remarkPlugins?: any[];
  rehypePlugins?: any[];
  components?: Record<string, any>;
  className?: string;
  preventIndentedCodeBlocks?: boolean; // New option to control the preprocessing
}

export default function MarkdownRenderer({
  children,
  allowRawHtml = false,
  remarkPlugins = [remarkGfm, remarkBreaks, preserveLeadingSpaces],
  rehypePlugins,
  components = { code: CodeBlock },
  className = "",
  preventIndentedCodeBlocks = true, // Default to preprocessing
}: MarkdownRendererProps) {
  // Apply preprocessing only if the option is enabled
  const content = preventIndentedCodeBlocks ? preprocessMarkdown(children) : children;
  
  // remarkGfm enables URL auto-linking, tables, strikethrough, and task lists
  // If allowRawHtml is true, users can embed videos, iframes and other media via HTML
  const defaultRehypePlugins = allowRawHtml
    ? [rehypeRaw, rehypeSanitize]
    : [rehypeSanitize];
  const finalRehypePlugins = rehypePlugins
    ? [...defaultRehypePlugins, ...rehypePlugins]
    : defaultRehypePlugins;

  // Get the current theme for any component-level styling
  const { theme } = useTheme();
  
  // Generate the markdown styles using CSS variables
  const markdownStyles = getMarkdownStyles();

  return (
    <MarkdownErrorBoundary>
      {/* Add the styles needed for proper markdown rendering */}
      <style dangerouslySetInnerHTML={{ __html: markdownStyles }} />
      
      <ReactMarkdown
        className={`react-markdown-content ${className}`}
        remarkPlugins={remarkPlugins}
        rehypePlugins={finalRehypePlugins}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </MarkdownErrorBoundary>
  );
}