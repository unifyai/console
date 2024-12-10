"use client";

import { CopyButton } from "@/components/Common/Buttons/Copy"
import { useEffect } from "react";
import Markdown from "react-markdown";
import SyntaxHighlighter from "react-syntax-highlighter";

const MarkdownRender = ({ content, index, subIndex }: { content: string, index: number, subIndex: number }) => {
    useEffect(() => {
        const markdown = document.querySelectorAll(`.markdown-${index}-${subIndex}`);
        markdown.forEach((value) => value.scrollTo({ top: value.scrollHeight, behavior: "smooth" }));
    }, [content]);

    return (<Markdown
        className={`markdown-${index}-${subIndex} w-full max-h-[18em] overflow-y-auto self-center`}
        components={{
            code(props) {
                // eslint-disable-next-line no-unused-vars
                const { children, className, node, ...rest } = props;
                const language = /language-(\w+)/.exec(className || "");
                const block = String(children).endsWith("\n");
                return block ? (
                    <div className="relative">
                        <div className="absolute top-1 right-1">
                            <CopyButton
                                content={String(children).replace(/\n$/, "")}
                                copyMessage="Copied!"
                            />
                        </div>
                        <SyntaxHighlighter
                            PreTag="div"
                            language={language?.[1] ?? undefined}
                        >
                            {String(children).replace(/\n$/, "")}
                        </SyntaxHighlighter>
                    </div>
                ) : (
                    <code {...rest} className={className}>
                        {children}
                    </code>
                );
            }
        }}
    >
        {content}
    </Markdown>);
};

export default MarkdownRender;
