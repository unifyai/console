"use client";

import { useState } from "react";
import { useQueryState } from "nuqs";
import { Endpoint } from "@/types/chat/endpoints";
import CodePreview from "./Code";
import Languages from "./Languages";
import { ModelArguments } from "@/types/chat/preview";

const ApiPreview = ({ apiKey, endpoints }: { apiKey: string, endpoints: Endpoint[] }) => {

    const [selectedLanguage, setSelectedLanguage] = useState<string>("python");
    const [selectedVariant, setSelectedVariant] = useState<string>("package");

    const [lastSelectedEndpointParam,] = useQueryState("lastSelected");
    const lastSelectedEndpoint = lastSelectedEndpointParam 
        ? endpoints.find(endpoint => `${endpoint.code}@${endpoint.provider}` === lastSelectedEndpointParam)!
        : {code: "claude-3.5-sonnet", provider: "anthropic"};

    const modelArguments = {
        model: lastSelectedEndpoint.code,
        provider: lastSelectedEndpoint.provider,
        arguments: {
            messages: [{
                role: "user",
                content: "Explain the benefits of dynamically routing prompts to different LLMs"
            }],
            temperature: 0.5,
            maxTokens: 1000
        }
    } as ModelArguments

    return (
            <div className="flex gap-2 w-full h-full bg-background rounded-md p-2 tutorial-api-preview">
                <CodePreview 
                    apiKey={apiKey} 
                    modelArguments={modelArguments}
                    selectedLanguage={selectedLanguage} 
                    selectedVariant={selectedVariant}
                />
                <Languages
                    selectedLanguage={selectedLanguage}
                    setSelectedLanguage={setSelectedLanguage}
                    selectedVariant={selectedVariant}
                    setSelectedVariant={setSelectedVariant}
                />
            </div>
    );
};

export default ApiPreview;
