import React, { Suspense } from "react"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { Light as SyntaxHighlighter } from "react-syntax-highlighter"

import js from "react-syntax-highlighter/dist/esm/languages/hljs/javascript"
import ts from "react-syntax-highlighter/dist/esm/languages/hljs/typescript"
import py from "react-syntax-highlighter/dist/esm/languages/hljs/python"
import bash from "react-syntax-highlighter/dist/esm/languages/hljs/bash"
import json from "react-syntax-highlighter/dist/esm/languages/hljs/json"
import css from "react-syntax-highlighter/dist/esm/languages/hljs/css"
import xml from "react-syntax-highlighter/dist/esm/languages/hljs/xml"

import { atomOneLight } from "react-syntax-highlighter/dist/esm/styles/hljs"
import { atomOneDark } from "react-syntax-highlighter/dist/esm/styles/hljs"

SyntaxHighlighter.registerLanguage("javascript", js)
SyntaxHighlighter.registerLanguage("typescript", ts)
SyntaxHighlighter.registerLanguage("python", py)
SyntaxHighlighter.registerLanguage("bash", bash)
SyntaxHighlighter.registerLanguage("json", json)
SyntaxHighlighter.registerLanguage("css", css)
SyntaxHighlighter.registerLanguage("html", xml)

import { useTheme } from "next-themes"
import { cn } from "@/lib/utils"
import { CopyButton } from "@/components/Common/Buttons/Copy"

type CodeProps = React.HTMLAttributes<HTMLElement> & {
  node?: any
  children?: React.ReactNode
}

interface MarkdownRendererProps {
  children: string
}

export function MarkdownRenderer({ children }: MarkdownRendererProps) {
  return (
    <Markdown
      remarkPlugins={[remarkGfm]} // If removing remark-gfm fixes it, re-enable only if you want GFM features
      components={COMPONENTS}
      className="space-y-3"
    >
      {children}
    </Markdown>
  )
}

// CodeBlock for fenced code
function CodeBlock({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLPreElement>) {
  const code = gatherAllStrings(children)
  // e.g. "language-python"
  const match = /language-(\w+)/.exec(className || "")
  const language = match?.[1] || "text"

  const { theme } = useTheme()
  const chosenStyle = theme === "dark" ? atomOneDark : atomOneLight

  return (
    <div className="group/code relative mb-4">
      <Suspense
        fallback={
          <pre
            {...props}
            className={cn(
              "rounded-md border border-foreground bg-background p-4 overflow-x-scroll font-mono text-sm [scrollbar-width:none]",
              className
            )}
          >
            {code}
          </pre>
        }
      >
        <pre
          {...props}
          className={cn(
            "rounded-md border border-foreground bg-background p-4 overflow-x-scroll font-mono text-sm [scrollbar-width:none]",
            className
          )}
        >
          <SyntaxHighlighter
            language={language}
            style={chosenStyle}
            customStyle={{
              margin: 0,
              background: "transparent",
              padding: 0,
            }}
          >
            {code}
          </SyntaxHighlighter>
        </pre>
      </Suspense>

      <div
        className="invisible absolute right-2 top-2 flex space-x-1
                   rounded-lg p-1 opacity-0 transition-all duration-200
                   group-hover/code:visible group-hover/code:opacity-100"
      >
        <CopyButton content={code} copyMessage="Copied code to clipboard" />
      </div>
    </div>
  )
}

function gatherAllStrings(children: any): string {
  if (typeof children === "string") return children
  if (Array.isArray(children)) {
    return children.map(gatherAllStrings).join("")
  }
  if (children?.props?.children) {
    return gatherAllStrings(children.props.children)
  }
  return ""
}

/**
 * MyCodeRenderer:
 * If remark-gfm (or some other plugin) removes the <pre> parent
 * on unlabeled triple-backticks, we see className=undefined
 * and parentIsPre=false. So we detect multiline text
 * and treat it as a code block anyway.
 */
function MyCodeRenderer({ node, className, children, ...rest }: CodeProps) {
  const raw = gatherAllStrings(children)
  const isMultiLine = raw.includes("\n")

  // If user typed "```python" or "```text", we see className = "language-xxx"
  // Or we forcibly model multiline code as fenced block:
  if (className?.includes("language-") || isMultiLine) {
    const finalCls = className?.includes("language-") ? className : "language-text"
    return (
      <CodeBlock className={finalCls} {...rest}>
        {children}
      </CodeBlock>
    )
  }

  // Otherwise treat as single-backtick inline code
  return (
    <code className="inline font-mono px-[2px] py-[1px]" {...rest}>
      {children}
    </code>
  )
}

function withClass(Tag: keyof JSX.IntrinsicElements, classes: string) {
  const Component = ({ node, ...props }: any) => (
    <Tag className={classes} {...props} />
  )
  Component.displayName = Tag
  return Component
}

const COMPONENTS = {
  h1: withClass("h1", "text-2xl font-semibold"),
  h2: withClass("h2", "font-semibold text-xl"),
  h3: withClass("h3", "font-semibold text-lg"),
  h4: withClass("h4", "font-semibold text-base"),
  h5: withClass("h5", "font-medium"),
  strong: withClass("strong", "font-semibold"),
  a: withClass("a", "text-primary underline underline-offset-2"),
  blockquote: withClass("blockquote", "border-l-2 border-primary pl-4"),
  code: MyCodeRenderer,
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

export default MarkdownRenderer