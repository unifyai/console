import { createOrchestraClient } from '@/lib/orchestra/client';

/**
 * Returns a list of model names that are supported by the given provider.
 *
 * If no provider is given, returns all model names that are supported by any provider.
 * @param apiKey The user's API key
 * @param provider The name of the provider.
 * @returns A list of model names.
 */
export async function listModels(apiKey: string, provider?: string): Promise<string[]> {
  const client = createOrchestraClient(apiKey);
  const { data, error } = await client.GET('/v0/models', {
    params: {
      query: provider ? { provider } : {},
    },
  });

  if (error) {
    console.error('Failed to list models:', error);
    return [];
  }

  return (data as string[]) || [];
}

/**
 * Returns a list of provider names that support the given model.
 *
 * The result is a list of strings, where each string is a provider name.
 * The list is empty if the model is not supported by any provider.
 * The list may be empty if the model is not supported by any provider.
 * If the model is not specified, the list contains all providers.
 *
 * @param apiKey The user's API key
 * @param model - The model to query providers for.
 * @returns A list of provider names that support the given model.
 */
export async function listProviders(apiKey: string, model?: string): Promise<string[]> {
  const client = createOrchestraClient(apiKey);
  const { data, error } = await client.GET('/v0/providers', {
    params: {
      query: model ? { model } : {},
    },
  });

  if (error) {
    console.error('Failed to list providers:', error);
    return [];
  }

  return (data as string[]) || [];
}

/**
 * Returns a list of endpoint names that are supported by the given provider and model.
 *
 * @param apiKey The user's API key
 * @param provider - The name of the provider.
 * @param model - The name of the model.
 * @returns A list of endpoint names.
 */
export async function listEndpoints(
  apiKey: string,
  provider?: string,
  model?: string
): Promise<string[]> {
  const client = createOrchestraClient(apiKey);

  const query: { provider?: string; model?: string } = {};
  if (provider) query.provider = provider;
  if (model) query.model = model;

  const { data, error } = await client.GET('/v0/endpoints', {
    params: { query },
  });

  if (error) {
    console.error('Failed to list endpoints:', error);
    return [];
  }

  return (data as string[]) || [];
}
