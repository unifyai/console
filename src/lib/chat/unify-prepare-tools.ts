import { LanguageModelV1, LanguageModelV1CallWarning, UnsupportedFunctionalityError } from '@ai-sdk/provider';
  
export function prepareTools(
    mode: Parameters<LanguageModelV1['doGenerate']>[0]['mode'] & {
      type: 'regular';
    },
): {
    tools:
      | Array<{
          type: 'function';
          function: {
            name: string;
            description: string | undefined;
            parameters: unknown;
          };
        }>
      | undefined;
    toolChoice:
      | { type: 'function'; function: { name: string } }
      | 'auto'
      | 'none'
      | 'any'
      | undefined;
    toolWarnings: LanguageModelV1CallWarning[];
} {
    // when the tools array is empty, change it to undefined to prevent errors:
    const tools = mode.tools?.length ? mode.tools : undefined;
    const toolWarnings: LanguageModelV1CallWarning[] = [];
  
    if (tools == null) {
      return { tools: undefined, toolChoice: undefined, toolWarnings };
    }
  
    const unifyTools: Array<{
      type: 'function';
      function: {
        name: string;
        description: string | undefined;
        parameters: unknown;
      };
    }> = [];
  
    for (const tool of tools) {
      if (tool.type === 'provider-defined') {
        toolWarnings.push({ type: 'unsupported-tool', tool });
      } else {
        unifyTools.push({
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
          },
        });
      }
    }
  
    const toolChoice = mode.toolChoice;
  
    if (toolChoice == null) {
      return { tools: unifyTools, toolChoice: undefined, toolWarnings };
    }
  
    const type = toolChoice.type;
  
    switch (type) {
      case 'auto':
      case 'none':
        return { tools: unifyTools, toolChoice: type, toolWarnings };
      case 'required':
        return { tools: unifyTools, toolChoice: 'any', toolWarnings };
  
      // unify does not support tool mode directly,
      // so we filter the tools and force the tool choice through 'any'
      case 'tool':
        return {
          tools: unifyTools.filter(
            tool => tool.function.name === toolChoice.toolName,
          ),
          toolChoice: 'any',
          toolWarnings,
        };
      default: {
        const _exhaustiveCheck: never = type;
        throw new UnsupportedFunctionalityError({
          functionality: `Unsupported tool choice type: ${_exhaustiveCheck}`,
        });
      }
    }
}