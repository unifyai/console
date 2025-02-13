"use client";

import React from "react";
import { useTheme } from "next-themes";
import Markdown from "react-markdown";
import SyntaxHighlighter from "react-syntax-highlighter";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import {
  dracula,
  docco,
} from "react-syntax-highlighter/dist/esm/styles/hljs";

const MarkdownRender = ({ content, noBackground }: { content: string, noBackground?: boolean }) => {
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
        <div className="absolute top-1 right-1">
          <CopyButton content={codeContent} copyMessage="Copied!" />
        </div>
        <SyntaxHighlighter
          language={language?.[1] ?? undefined}
          style={theme === "dark" ? dracula : docco}
          PreTag="div"
          lineProps={{ style: { wordBreak: "break-all", whiteSpace: "pre-wrap" } }}
          wrapLines={true}
          wrapLongLines={true}
          customStyle={noBackground ? { backgroundColor: "transparent" } : undefined}
        >
          {codeContent}
        </SyntaxHighlighter>
      </div>
    ) : (
      <code className={className} {...props}>
        {children}
      </code>
    );
  };

  return (
    <div className={"prose w-full " + (noBackground ? "text-sm" : "")}>
      <Markdown
        components={{
          code: CodeBlock as any,
        }}
      >
        {content}
      </Markdown>
    </div>
  );
};

export default MarkdownRender;