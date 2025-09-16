"use client";

import React from "react";
import { useTheme } from "next-themes";
import Markdown from "react-markdown";
import SyntaxHighlighter from "react-syntax-highlighter";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import { dracula, docco } from "react-syntax-highlighter/dist/esm/styles/hljs";

const MarkdownRender = ({ content, darkOnly }: { content: string, darkOnly?: boolean }) => {
  const { theme } = useTheme();

  const CodeBlock = ({
    inline,
    className,
    children,
    ...props
  }: {
    inline: boolean;
    className: string;
    children: React.ReactNode;
    [key: string]: any;
  }) => {
    const language = /language-(\w+)/.exec(className || "");
    const codeContent = String(children).replace(/\n$/, "");
    return !inline ? (
      <div className="relative">
        <div className={"absolute top-1 right-1 " + (darkOnly ? theme == "dark" ? "text-foreground" : "text-muted" : "")}>
          <CopyButton content={codeContent} copyMessage="Copied!" />
        </div>
        <SyntaxHighlighter
          language={language?.[1] ?? undefined}
          style={(darkOnly || (theme && ["dark", "system"].includes(theme))) ? dracula : docco}
          PreTag="div"
          lineProps={{ style: { wordBreak: "break-all", whiteSpace: "pre-wrap" } }}
          wrapLines={true}
          wrapLongLines={true}
          customStyle={
            (darkOnly && theme == "dark")
              ? { backgroundColor: "transparent" }
              : darkOnly
                ? { backgroundColor: "var(--eerie-black)" }
                : undefined
          }
        >
          {codeContent}
        </SyntaxHighlighter>
      </div>
    ) : (
      <code className={className + " font-mono"} {...props}>
        {children}
      </code>
    );
  };

  return (
    <div className={("prose max-w-none " + (darkOnly ? "text-body" : "")).trim()}>
      <Markdown
        components={{ code: CodeBlock as any }}
      >
        {content}
      </Markdown>
    </div>
  );
};

export default MarkdownRender;
