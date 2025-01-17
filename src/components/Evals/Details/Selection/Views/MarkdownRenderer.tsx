import React, { Suspense } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

import {
  Light as SyntaxHighlighter,
} from "react-syntax-highlighter"

// Import highlight.js languages
import js from "react-syntax-highlighter/dist/esm/languages/hljs/javascript"
import ts from "react-syntax-highlighter/dist/esm/languages/hljs/typescript"
import py from "react-syntax-highlighter/dist/esm/languages/hljs/python"
import bash from "react-syntax-highlighter/dist/esm/languages/hljs/bash"
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json"
import css from "react-syntax-highlighter/dist/esm/languages/hljs/css"
import xml from "react-syntax-highlighter/dist/esm/languages/hljs/xml" // often used for html/xhtml

// Import two stylesheet themes: one for light, one for dark
import { docco } from "react-syntax-highlighter/dist/esm/styles/hljs"
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs"

SyntaxHighlighter.registerLanguage("javascript", js)
SyntaxHighlighter.registerLanguage("typescript", ts)
SyntaxHighlighter.registerLanguage("python", py)
SyntaxHighlighter.registerLanguage("bash", bash)
SyntaxHighlighter.registerLanguage("json", json)
SyntaxHighlighter.registerLanguage("css", css)
SyntaxHighlighter.registerLanguage("html", xml)

// Example hook for theme detection. Adjust for your environment.
import { useTheme } from "next-themes"

import { cn } from "@/lib/utils"
import { CopyButton } from "@/components/Common/Buttons/Copy"

interface MarkdownRendererProps {
  children: string
}

/**
 * MarkdownRenderer:
 *  - Renders a markdown string with GitHub-flavored MD support.
 *  - Takes advantage of a custom set of components that control how
 *    headings, lists, tables, code blocks, etc. are rendered.
 */
export function MarkdownRenderer({ children }: MarkdownRendererProps) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]}
      components={COMPONENTS}
      className="space-y-3"
    >
      {children}
    </Markdown>
  )
}

/**
 * CodeBlock:
 * - Extracts the language from the className (e.g. "language-js").
 * - Dynamically uses either docco (light) or atomOneDark (dark) style from
 *   react-syntax-highlighter, based on the current theme.
 * - Suspense fallback just in case, so the code initially shows unstyled until
 *   the syntax highlighter finishes loading.
 */
function CodeBlock({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLPreElement>) {
  const match = /language-(\w+)/.exec(className || "")
  const code = gatherAllStrings(children)
  const language = match?.[1] || "text"

  const { theme } = useTheme() // e.g. { theme: "light" | "dark" }
  const chosenStyle = theme === "dark" ? atomOneDark : docco

  console.log("theme", theme, "chosenStyle", chosenStyle)
  console.log("code", code)
  console.log("language", language)
  console.log(children)

  return (
    <div className="group/code relative mb-4">
      <Suspense
        fallback={
          <pre
            className={cn(
              "overflow-x-scroll rounded-md border bg-background/50 p-4 font-mono text-sm [scrollbar-width:none]",
              className
            )}
            {...props}
          >
            {code}
          </pre>
        }
      >
        <SyntaxHighlighter
          language={language}
          style={chosenStyle}
          customStyle={{
            margin: 0,
            background: "transparent", 
            padding: 0,
          }}
          // If you want line numbers:
          // showLineNumbers
          // lineNumberStyle={{ minWidth: "2em", paddingRight: "1em" }}
        >
          {code}
        </SyntaxHighlighter>
      </Suspense>

      {/* Copy button in the top-right corner, shows on hover */}
      <div className="invisible absolute right-2 top-2 flex space-x-1 
                      rounded-lg p-1 opacity-0 transition-all duration-200 
                      group-hover/code:visible group-hover/code:opacity-100">
        <CopyButton content={code} copyMessage="Copied code to clipboard" />
      </div>
    </div>
  )
}

/**
 * gatherAllStrings:
 * Collects any nested text children (in case they're arrays or React elements).
 */
function gatherAllStrings(children: any): string {
  if (typeof children === "string") return children
  if (Array.isArray(children))
    return children.map(gatherAllStrings).join("")
  if (children?.props?.children)
    return gatherAllStrings(children.props.children)
  return ""
}

// The custom components for various markdown element tags.
const COMPONENTS = {
  h1: withClass("h1", "text-2xl font-semibold"),
  h2: withClass("h2", "font-semibold text-xl"),
  h3: withClass("h3", "font-semibold text-lg"),
  h4: withClass("h4", "font-semibold text-base"),
  h5: withClass("h5", "font-medium"),
  strong: withClass("strong", "font-semibold"),
  a: withClass("a", "text-primary underline underline-offset-2"),
  blockquote: withClass("blockquote", "border-l-2 border-primary pl-4"),
  code: ({ node, inline, className, children, ...rest }: any) => {
    // If inline is false => code block within <pre>, use CodeBlock
    return !inline ? (
      <CodeBlock className={className} {...rest}>
        {children}
      </CodeBlock>
    ) : (
      // Inline code
      <code
        className={cn(
          "font-mono [:not(pre)>&]:rounded-md [:not(pre)>&]:bg-background/50 [:not(pre)>&]:px-1 [:not(pre)>&]:py-0.5",
          className
        )}
        {...rest}
      >
        {children}
      </code>
    )
  },
  pre: ({ children }: any) => children,
  ol: withClass("ol", "list-decimal space-y-2 pl-6"),
  ul: withClass("ul", "list-disc space-y-2 pl-6"),
  li: withClass("li", "my-1.5"),
  table: withClass(
    "table",
    "w-full border-collapse rounded-md border border-foreground/20"
  ),
  th: withClass(
    "th",
    "border border-foreground/20 px-4 py-2 text-left font-bold \
     [&[align=center]]:text-center [&[align=right]]:text-right"
  ),
  td: withClass(
    "td",
    "border border-foreground/20 px-4 py-2 text-left \
     [&[align=center]]:text-center [&[align=right]]:text-right"
  ),
  tr: withClass("tr", "m-0 border-t p-0 even:bg-muted"),
  p: withClass("p", "whitespace-pre-wrap"),
  hr: withClass("hr", "border-foreground/20"),
}

/**
 * Helper to attach your desired classes to a given HTML tag (h1, h2, etc.).
 */
function withClass(Tag: keyof JSX.IntrinsicElements, classes: string) {
  const Component = ({ node, ...props }: any) => (
    <Tag className={classes} {...props} />
  )
  Component.displayName = Tag
  return Component
}

// Export as default so you can import it in your code:
export default MarkdownRenderer