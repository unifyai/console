import { LanguageModelV1, LanguageModelV1CallWarning, LanguageModelV1FinishReason, LanguageModelV1StreamPart} from '@ai-sdk/provider';
import { FetchFunction, ParseResult, combineHeaders, createEventSourceResponseHandler, createJsonResponseHandler, postJsonToApi } from '@ai-sdk/provider-utils';
import { z } from 'zod';
import { convertToUnifyChatMessages } from './convert-to-unify-chat-messages';
import { mapUnifyFinishReason } from './map-unify-finish-reason';
import { UnifyChatModelId, UnifyChatSettings } from './unify-chat-settings';
import { unifyFailedResponseHandler } from './unify-error';
import { getResponseMetadata } from './get-response-metadata';
import { prepareTools } from './unify-prepare-tools';

type UnifyChatConfig = {
  provider: string;
  baseURL: string;
  headers: () => Record<string, string | undefined>;
  fetch?: FetchFunction;
};

export class UnifyChatLanguageModel implements LanguageModelV1 {
  readonly specificationVersion = 'v1';
  readonly defaultObjectGenerationMode = 'json';
  readonly supportsImageUrls = false;

  readonly modelId: UnifyChatModelId;
  readonly settings: UnifyChatSettings;

  private readonly config: UnifyChatConfig;

  constructor(
    modelId: UnifyChatModelId,
    settings: UnifyChatSettings,
    config: UnifyChatConfig,
  ) {
    this.modelId = modelId;
    this.settings = settings;
    this.config = config;
  }

  get provider(): string {
    return this.config.provider;
  }

  private getArgs({
    mode,
    prompt,
    maxTokens,
    temperature,
    topP,
    topK,
    frequencyPenalty,
    presencePenalty,
    stopSequences,
    responseFormat,
    seed,
  }: Parameters<LanguageModelV1['doGenerate']>[0]) {
    const type = mode.type;

    const warnings: LanguageModelV1CallWarning[] = [];

    if (topK != null) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'topK',
      });
    }

    if (frequencyPenalty != null) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'frequencyPenalty',
      });
    }

    if (presencePenalty != null) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'presencePenalty',
      });
    }

    if (stopSequences != null) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'stopSequences',
      });
    }

    if (
      responseFormat != null &&
      responseFormat.type === 'json' &&
      responseFormat.schema != null
    ) {
      warnings.push({
        type: 'unsupported-setting',
        setting: 'responseFormat',
        details: 'JSON response format schema is not supported',
      });
    }

    const baseArgs = {
      // model id:
      model: this.modelId,

      // model specific settings:
      // safe_prompt: {}, //this.settings.safePrompt,

      // standardized settings:
      maxTokens: maxTokens,
      temperature,
      topP: topP,
      randomSeed: seed,

      // response format:
      responseFormat:
        responseFormat?.type === 'json' ? { type: 'json_object' } : undefined,

      // messages:
      messages: convertToUnifyChatMessages(prompt),
    };

    switch (type) {
      case 'regular': {
        const { tools, toolChoice, toolWarnings } = prepareTools(mode);

        return {
          args: { ...baseArgs, tools, toolChoice },
          warnings: [...warnings, ...toolWarnings],
        };
      }

      case 'object-json': {
        return {
          args: {
            ...baseArgs,
            responseFormat: { type: 'json_object' },
          },
          warnings,
        };
      }

      case 'object-tool': {
        return {
          args: {
            ...baseArgs,
            toolChoice: 'any',
            tools: [{ type: 'function', function: mode.tool }],
          },
          warnings,
        };
      }

      default: {
        const _exhaustiveCheck: never = type;
        throw new Error(`Unsupported type: ${_exhaustiveCheck}`);
      }
    }
  }

  async doGenerate(
    options: Parameters<LanguageModelV1['doGenerate']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV1['doGenerate']>>> {
    const { args, warnings } = this.getArgs(options);

    const { responseHeaders, value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/chat/completions`,
      headers: combineHeaders(this.config.headers(), options.headers),
      body: args,
      failedResponseHandler: unifyFailedResponseHandler,
      successfulResponseHandler: createJsonResponseHandler(
        unifyChatResponseSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const { messages: rawPrompt, ...rawSettings } = args;
    const choice = response.choices[0];
    let text = choice.message.content ?? undefined;

    // when there is a trailing assistant message, unify will send the
    // content of that message again. we skip this repeated content to
    // avoid duplication, e.g. in continuation mode.
    const lastMessage = rawPrompt[rawPrompt.length - 1];
    if (
      lastMessage.role === 'assistant' &&
      text?.startsWith(lastMessage.content)
    ) {
      text = text.slice(lastMessage.content.length);
    }

    return {
      text,
      toolCalls: choice.message.toolCalls?.map(toolCall => ({
        toolCallType: 'function',
        toolCallId: toolCall.id,
        toolName: toolCall.function.name,
        args: toolCall.function.arguments!,
      })),
      finishReason: mapUnifyFinishReason(choice.finishReason),
      usage: {
        promptTokens: response.usage.promptTokens,
        completionTokens: response.usage.completionTokens,
      },
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      request: { body: JSON.stringify(args) },
      response: getResponseMetadata(response),
      warnings,
    };
  }

  async doStream(
    options: Parameters<LanguageModelV1['doStream']>[0],
  ): Promise<Awaited<ReturnType<LanguageModelV1['doStream']>>> {
    const { args, warnings } = this.getArgs(options);

    const body = { ...args, stream: true };

    const { responseHeaders, value: response } = await postJsonToApi({
      url: `${this.config.baseURL}/chat/completions`,
      headers: combineHeaders(this.config.headers(), options.headers),
      body,
      failedResponseHandler: unifyFailedResponseHandler,
      successfulResponseHandler: createEventSourceResponseHandler(
        unifyChatChunkSchema,
      ),
      abortSignal: options.abortSignal,
      fetch: this.config.fetch,
    });

    const { messages: rawPrompt, ...rawSettings } = args;

    let finishReason: LanguageModelV1FinishReason = 'unknown';
    let usage: { promptTokens: number; completionTokens: number } = {
      promptTokens: Number.NaN,
      completionTokens: Number.NaN,
    };
    let chunkNumber = 0;
    let trimLeadingSpace = false;

    return {
      stream: response.pipeThrough(
        new TransformStream<
          ParseResult<z.infer<typeof unifyChatChunkSchema>>,
          LanguageModelV1StreamPart
        >({
          transform(chunk, controller) {
            if (!chunk.success) {
              controller.enqueue({ type: 'error', error: chunk.error });
              return;
            }

            chunkNumber++;

            const value = chunk.value;

            if (chunkNumber === 1) {
              controller.enqueue({
                type: 'response-metadata',
                ...getResponseMetadata(value),
              });
            }

            if (value.usage != null) {
              usage = {
                promptTokens: value.usage.promptTokens,
                completionTokens: value.usage.completionTokens,
              };
            }

            const choice = value.choices[0];

            if (choice?.finishReason != null) {
              finishReason = mapUnifyFinishReason(choice.finishReason);
            }

            if (choice?.delta == null) {
              return;
            }

            const delta = choice.delta;

            // when there is a trailing assistant message, unify will send the
            // content of that message again. we skip this repeated content to
            // avoid duplication, e.g. in continuation mode.
            if (chunkNumber <= 2) {
              const lastMessage = rawPrompt[rawPrompt.length - 1];

              if (
                lastMessage.role === 'assistant' &&
                delta.content === lastMessage.content.trimEnd()
              ) {
                // unify moves the trailing space from the prefix to the next chunk.
                // We trim the leading space to avoid duplication.
                if (delta && delta.content && delta.content.length < lastMessage.content.length) {
                  trimLeadingSpace = true;
                }

                // skip the repeated content:
                return;
              }
            }

            if (delta.content != null) {
              controller.enqueue({
                type: 'text-delta',
                textDelta: trimLeadingSpace
                  ? delta.content.trimStart()
                  : delta.content,
              });

              trimLeadingSpace = false;
            }

            if (delta.toolCalls != null) {
              for (const toolCall of delta.toolCalls) {
                // unify tool calls come in one piece:
                controller.enqueue({
                  type: 'tool-call-delta',
                  toolCallType: 'function',
                  toolCallId: toolCall.id,
                  toolName: toolCall.function.name,
                  argsTextDelta: toolCall.function.arguments,
                });
                controller.enqueue({
                  type: 'tool-call',
                  toolCallType: 'function',
                  toolCallId: toolCall.id,
                  toolName: toolCall.function.name,
                  args: toolCall.function.arguments,
                });
              }
            }
          },

          flush(controller) {
            controller.enqueue({ type: 'finish', finishReason, usage });
          },
        }),
      ),
      rawCall: { rawPrompt, rawSettings },
      rawResponse: { headers: responseHeaders },
      request: { body: JSON.stringify(body) },
      warnings,
    };
  }
}

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const unifyChatResponseSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      message: z.object({
        role: z.literal('assistant'),
        content: z.string().nullable(),
        toolCalls: z
          .array(
            z.object({
              id: z.string(),
              function: z.object({ name: z.string(), arguments: z.string() }),
            }),
          )
          .nullish(),
      }),
      index: z.number(),
      finishReason: z.string().nullish(),
    }),
  ),
  object: z.literal('chat.completion'),
  usage: z.object({
    promptTokens: z.number(),
    completionTokens: z.number(),
  }),
});

// limited version of the schema, focussed on what is needed for the implementation
// this approach limits breakages when the API changes and increases efficiency
const unifyChatChunkSchema = z.object({
  id: z.string().nullish(),
  created: z.number().nullish(),
  model: z.string().nullish(),
  choices: z.array(
    z.object({
      delta: z.object({
        role: z.enum(['assistant']).optional(),
        content: z.string().nullish(),
        toolCalls: z
          .array(
            z.object({
              id: z.string(),
              function: z.object({ name: z.string(), arguments: z.string() }),
            }),
          )
          .nullish(),
      }),
      finishReason: z.string().nullish(),
      index: z.number(),
    }),
  ),
  usage: z
    .object({
      promptTokens: z.number(),
      completionTokens: z.number(),
    })
    .nullish(),
});