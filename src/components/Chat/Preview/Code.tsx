"use client";

import { useMemo, useEffect, useState } from "react";
import SyntaxHighlighter from "react-syntax-highlighter";
import { dracula } from "react-syntax-highlighter/dist/esm/styles/hljs";
import { CopyButton } from "@/components/Common/Buttons/Copy";
import { generateRequest } from "@/utils/chat/preview/code";
import { ModelArguments } from "@/types/chat/preview";
import { generateSnippet } from "@/utils/chat/preview/code";
import { ScrollArea, ScrollBar } from "@/components/UI/scroll-area";

const LanguageCorrectorMap: Record<string, string> = {
    nodejs: "javascript",
    curl: "bash",
    "objective-c": "objectivec",
};

const getCorrectedLanguage = (language: string) => {
    return LanguageCorrectorMap[language] || language;
};

const CodePreview = ({apiKey, modelArguments, selectedLanguage, selectedVariant}: {
    apiKey: string,
    modelArguments: ModelArguments
    selectedLanguage: string,
    selectedVariant: string
}) => {

    // Generate code
    const [secureCode, setSecureCode] = useState("");
    const [code, setCode] = useState("");
    const request = useMemo(() => generateRequest({
        modelArguments: modelArguments,
        apiKey: apiKey
    }), [modelArguments, apiKey]);
    useEffect(() => {
        const snippets = generateSnippet(selectedLanguage, selectedVariant, request)
        setCode(snippets.code)
        setSecureCode(snippets.secureCode)
    }, [selectedLanguage, selectedVariant])
    
    // Pip install header
    let install = null;
    if (selectedVariant === "package")
        install = <SyntaxHighlighter
                    language="python"
                    style={dracula}
                    showLineNumbers
                    wrapLines
                    lineNumberStyle={{
                        minWidth: `${1.25 * (secureCode.split("\n").length.toString().length)}em`
                    }}
                    customStyle={{
                        borderRadius: "10px",
                        border: "1px solid #E5E7EB",
                        marginBottom: "2px"
                    }}
                >
                    {"pip install unifyai"}
                </SyntaxHighlighter>
    
    // Copy button
    const content = selectedVariant === "package" ? code.replace("YOUR_API_KEY", request.headers.Authorization) : code
    const copy = <CopyButton content={content} copyMessage="Code copied!"/>

    // Code snippet
    const snippet = <SyntaxHighlighter
                        language={getCorrectedLanguage(selectedLanguage)}
                        style={dracula}
                        showLineNumbers
                        wrapLines
                        lineNumberStyle={{
                            minWidth: `${1.25 * (secureCode.split("\n").length.toString().length)}em`
                        }}
                        customStyle={{
                            borderRadius: "10px",
                            border: "1px solid #E5E7EB",
                        }}
                    >
                        {secureCode}
                    </SyntaxHighlighter>
    return (
        <ScrollArea className="text-sm relative group/code">
            <div className={`absolute right-2 ${selectedVariant === "package" ? "top-11" : "top-2"} flex rounded-lg items-center z-10 bg-background`}>
                {copy}
            </div>
            {install} 
            {snippet}
            <ScrollBar orientation="horizontal"/>
        </ScrollArea>
    )
}

export default CodePreview
