import * as React from 'react';
import { DefaultModelOption } from '@/types/assistants/assistant';
import { fetchDefaultModelOptions } from '@/lib/client/defaultModels';

/** Select value for the catalog's system-default (unset) option. */
export const SYSTEM_DEFAULT_MODEL_VALUE = '__system_default__';

/**
 * Loads Orchestra's curated catalog of per-assistant default LLM options.
 *
 * The catalog's first entry is the system default (``model: null``), which
 * leaves the assistant unset so the runtime applies its own defaults. A
 * separate MiniMax entry pins that model explicitly.
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
  if (!model) return SYSTEM_DEFAULT_MODEL_VALUE;
  return reasoningEffort ? `${model}::${reasoningEffort}` : model;
}

/** Decode a Select item value back into the (model, effort) pair. */
export function decodeDefaultModelValue(value: string): {
  model: string | null;
  reasoningEffort: string | null;
} {
  if (!value || value === SYSTEM_DEFAULT_MODEL_VALUE) {
    return { model: null, reasoningEffort: null };
  }
  const [model, reasoningEffort] = value.split('::');
  return { model, reasoningEffort: reasoningEffort || null };
}
