import { LanguageModelV1FinishReason } from '@ai-sdk/provider';

export function mapUnifyFinishReason(
  finishReason: string | null | undefined
): LanguageModelV1FinishReason {
  switch (finishReason) {
    case 'stop':
      return 'stop';
    case 'length':
    case 'model_length':
      return 'length';
    case 'toolCalls':
      return 'tool-calls';
    default:
      return 'unknown';
  }
}
