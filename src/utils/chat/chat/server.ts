"use server";

import NodeCache from "node-cache";
import { v4 as uuid } from "uuid";
import { Endpoint } from "@/types/chat/endpoints";
import { AssistantMessage, ChatHistory, UserMessage, ResponseChunk, ChatFrame, ChatRequest, Parameters, Arguments } from "@/types/chat/chat";
import { generateRequest, getEndpointChat, generateInput } from "@/utils/chat/chat/client";
import { noStreamingEndpoints } from "@/constants/chat";
import { streamResponse } from "./stream";

const histories = new NodeCache({
    stdTTL: 60 * 60 * 12, // 12 hour
    checkperiod: 60 * 30, // 30 minutes
});

export async function* race<T>(iterable: AsyncGenerator<T>[]) {
    const generators = [...iterable];
    const next = (gen: AsyncGenerator<T>) => {
        const promise: any = gen.next().then(
            ({ done, value }) => ({ done, value, gen, promise }),
        );
        return promise;
    };
    const promises: any = generators.reduce(
        (set, gen) => set.add(next(gen)), new Set(),
    );

    while (promises.size > 0) {
        const { done, value, gen, promise } = await Promise.race(promises);
        promises.delete(promise);

        if (!done) {
            promises.add(next(gen));
            yield value;
        }
    }
}

const chatWithEndpoint = async function* (key: string, endpoint: Endpoint, chatHistory: (AssistantMessage | UserMessage)[], parameters: Parameters, apiKey: string): AsyncGenerator<ChatFrame> {
    const start = performance.now();
    let timeToFirstToken: number | undefined;
    let timeToCompletion: number | undefined;
    const url = process.env.ORCHESTRA_URL + "/v0/chat/completions";
    const response = await fetch(
        url,
        {
            ...generateRequest({
                endpoint: endpoint,
                arguments: generateInput(
                    parameters.modelArguments,
                    parameters.modelInputs ?? null,
                    chatHistory
                ),
                connection: {
                    orchestraUrl: process.env.ORCHESTRA_URL!,
                    apiKey: apiKey == "***REMOVED***" ? process.env.ORCHESTRA_API_KEY! : apiKey,
                }
            }),
            cache: "no-store"
        }
    );
    if (response.status != 200) {
        yield {
            key,
            endpoint,
            delta: response.statusText == "Payment Required" ?
                "Whoops! It seems like this account doesn't have enough credits. To get a recharge, visit https://console.unify.ai/"
                : response.statusText
        };
    }

    const reader = response.body?.getReader();
    if (!reader) return;

    const decoder = new TextDecoder();
    let done = false;
    let gotFirstChunk = false;
    let value: Uint8Array | undefined;
    let lastChunk: ResponseChunk | null = null;
    // This buffer is added to handle the case where the response is split into multiple chunks
    let buffer = "";
    let totalTokens = 0;
    while (!done) {
        ({ done, value } = await reader.read());
        if (!gotFirstChunk) {
            timeToFirstToken = performance.now() - start;
            gotFirstChunk = true;
        }
        if (value) {
            buffer += decoder.decode(value);
            const chunks = buffer
                .split(/\s*data:\s*/g)
                .filter((str) => str.length > 0);

            const jsonChunks = chunks.map((str) => {
                try {
                    return JSON.parse(str) as ResponseChunk;
                } catch (e) {
                    return str;
                }
            });

            buffer = "";
            for (const chunk of jsonChunks) {
                if (typeof chunk === "string") {
                    buffer += chunk;
                    continue;
                }
                lastChunk = chunk;
            }

            const stringChunks = (jsonChunks.filter((chunk) => typeof chunk !== "string") as ResponseChunk[])
                .map((chunk) => (chunk?.choices?.[0]?.message?.content || chunk?.choices?.[0]?.delta?.content));
            const timeTaken = performance.now() - start;
            for (let chunk of stringChunks) {
                if (!chunk)
                    continue;
                totalTokens += chunk.length / 4.1;
                for (let char of chunk) {
                    yield {
                        key,
                        endpoint,
                        delta: char || "",
                        metrics: {
                            model: (jsonChunks[0] as any).model,
                            provider: undefined,
                            latency: timeToFirstToken,
                            throughput: totalTokens / (timeTaken / 1000),
                        }
                    };
                }
            }
        }
    }

    timeToCompletion = performance.now() - start;

    yield {
        key: key,
        delta: "",
        endpoint: endpoint,
        metrics: lastChunk ? {
            model: lastChunk.model,
            provider: lastChunk.provider,
            latency: timeToFirstToken,
            throughput: timeToCompletion !== undefined
                && lastChunk.usage?.totalTokens !== undefined
                ? lastChunk.usage?.totalTokens / (timeToCompletion / 1000)
                : undefined,
            cost: lastChunk.usage?.cost,
        } : undefined,
        done: true,
    };
    reader.releaseLock();
};

const chatWithEndpointWithError = async function* (key: string, endpoint: Endpoint, chatHistory: (AssistantMessage | UserMessage)[], parameters: Parameters, apiKey: string): AsyncGenerator<ChatFrame> {
    try {
        yield* chatWithEndpoint(key, endpoint, chatHistory, parameters, apiKey);
    }
    catch (error) {
        yield {
            key,
            endpoint,
            delta: "",
            error: true,
        };
    }
};

export const chat = streamResponse(async function* ({ key, message, endpoints, parameters, prevResponses, apiKey }: ChatRequest): AsyncGenerator<ChatFrame> {
    if (!key) {
        key = uuid();
    }

    let history = histories.get<ChatHistory>(key) || [];
    prevResponses = prevResponses.filter((response) => response.content != "");
    if (prevResponses.length > 0)
        history.push(prevResponses);
    history.push({
        content: message,
        role: "user",
    });

    histories.set(key, history);

    const customParameters = (endpoint: Endpoint) => {
        const endpointName = `${endpoint.code}@${endpoint.provider}`;

        const streamParam = noStreamingEndpoints.includes(endpointName) ? false : true;
        // const maxTokensParam = endpoint.provider === "openai" ? false : true;
        // const maxCompletionTokensParam = endpoint.provider === "openai" ? true: false;

        // Remove max tokens and temperature 
        // remove streaming for models that don't support streaming
        const modelInputsParams: { [key: string]: any } = {
            // temperature: parameters.modelInputs!.temperature, // remove temperature input
            stream: streamParam,
            messages: parameters.modelInputs!.messages
        };
        // if (maxTokensParam) modelInputsParams["maxTokens"] = parameters.modelInputs!.maxTokens;
        // if (maxCompletionTokensParam) modelInputsParams["max_completion_tokens"] = parameters.modelInputs!.maxTokens;

        // Remove max tokens from model args for openai models
        const { maxTokens: _maxTokens, temperature: _temp, ...otherModelArguments } = parameters.modelArguments;
        // const modelArgumentsParams = maxTokensParam ? {...otherModelArguments, maxTokens: parameters.modelArguments.maxTokens} : {...otherModelArguments};
        const modelArgumentsParams = { ...otherModelArguments };

        const params = {
            ...parameters,
            modelInputs: modelInputsParams,
            modelArguments: modelArgumentsParams
        };

        return params;
    };

    yield* race(endpoints.map((endpoint) => chatWithEndpointWithError(
        key!,
        endpoint,
        getEndpointChat(endpoint, history),
        customParameters(endpoint) as Parameters<Arguments>,
        apiKey
    )));
});

export const clearChat = async (key: string) => {
    histories.del(key);
};
