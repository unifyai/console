import * as React from 'react';
import { DefaultModelOption } from '@/types/assistants/assistant';
import { fetchDefaultModelOptions } from '@/lib/client/defaultModels';

/**
 * Loads Orchestra's curated catalog of per-assistant default LLM options.
 *
 * The catalog's first entry is the platform default (used when an assistant
 * has no explicit selection), so it doubles as the dropdown fallback value.
 */
export function useDefaultModelOptions() {
  const [options, setOptions] = React.useState<DefaultModelOption[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const result = await fetchDefaultModelOptions();
      if (cancelled) return;
      if (Array.isArray(result)) {
        setOptions(result);
      }
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { options, isLoading };
}

/** Encode a (model, effort) pair as a stable Select item value. */
export function encodeDefaultModelValue(
  model: string | null | undefined,
  reasoningEffort: string | null | undefined
): string {
  if (!model) return '';
  return reasoningEffort ? `${model}::${reasoningEffort}` : model;
}

/** Decode a Select item value back into the (model, effort) pair. */
export function decodeDefaultModelValue(value: string): {
  model: string | null;
  reasoningEffort: string | null;
} {
  if (!value) return { model: null, reasoningEffort: null };
  const [model, reasoningEffort] = value.split('::');
  return { model, reasoningEffort: reasoningEffort || null };
}
