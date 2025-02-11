"use client";

import React from "react";
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

// Updated CodeBlock Component with adjustments for gap and wrapping
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
  console.log("CodeBlock rendering:", {
    providedInline,
    computedInline: isInline,
    className,
    codeString,
  });

  const { theme } = useTheme();
  const style = theme === "dark" ? oneDark : oneLight;
  const match = /language-(\w+)/.exec(className || "");

  if (!isInline) {
    return (
      <div
        style={{
          position: "relative",
          margin: "0.5em 0", // Reduced margin to lessen extra gap
          overflow: "hidden",
        }}
        className="group"
      >
        <SyntaxHighlighter
          style={style as Record<string, React.CSSProperties>}
          language={match ? match[1] : "text"}
          PreTag="div"
          wrapLongLines={true}   // Forces long lines to wrap
          customStyle={{
            margin: 0,
            padding: "0.5em",   // Custom padding if desired; adjust as needed
            whiteSpace: "pre-wrap", // Ensure wrapping
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
  
  // For inline code, enforce inline display explicitly.
  return (
    <code
      className={className}
      style={{
        display: "inline",
        backgroundColor: "transparent",
        padding: "0.1em 0.2em", // Reduced padding
        fontFamily: "\"Fira Code\", \"Fira Mono\", Menlo, Consolas, \"DejaVu Sans Mono\", monospace", // Match the theme's font
        whiteSpace: "pre-wrap",
        color: "inherit", // Use the parent text color
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
      return <div className="text-red-500">There was an error rendering the markdown content.</div>;
    }
    return this.props.children;
  }
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
}

export default function MarkdownRenderer({
  children,
  allowRawHtml = false,
  remarkPlugins = [remarkGfm, remarkBreaks],
  rehypePlugins,
  components = { code: CodeBlock },
  className = "",
}: MarkdownRendererProps) {
  const defaultRehypePlugins = allowRawHtml
    ? [rehypeRaw, rehypeSanitize]
    : [rehypeSanitize];
  const finalRehypePlugins = rehypePlugins
    ? [...defaultRehypePlugins, ...rehypePlugins]
    : defaultRehypePlugins;

  return (
    <MarkdownErrorBoundary>
      <ReactMarkdown
        className={className}
        remarkPlugins={remarkPlugins}
        rehypePlugins={finalRehypePlugins}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </MarkdownErrorBoundary>
  );
}