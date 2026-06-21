import type { IntegrationGalleryItem } from '@/types/integrations';

export function integrationTypeFilterValue(item: IntegrationGalleryItem): 'native' | 'third_party' {
  if (item.sourceMetadata?.sourceType === 'native') return 'native';
  if (item.sourceMetadata?.sourceType === 'third_party') return 'third_party';
  return item.source === 'provider_backed' || item.source === 'overlay_curated'
    ? 'third_party'
    : 'native';
}

export function integrationTypeLabel(item: IntegrationGalleryItem): 'Native' | 'Third-party' {
  return integrationTypeFilterValue(item) === 'third_party' ? 'Third-party' : 'Native';
}

/* eslint-disable @typescript-eslint/naming-convention -- keys are backend auth-mode ids (snake_case) */
const AUTH_MODE_LABELS: Record<string, string> = {
  oauth: 'OAuth',
  oauth_authorization_code: 'OAuth',
  api_key: 'API key',
  custom: 'Custom',
  native: 'Native',
};
/* eslint-enable @typescript-eslint/naming-convention */

function humanizeAuthMode(mode: string): string {
  const key = mode.trim().toLowerCase();
  if (AUTH_MODE_LABELS[key]) return AUTH_MODE_LABELS[key];
  if (key.includes('api_key')) return 'API key';
  if (key.includes('oauth')) return 'OAuth';
  return key.replace(/[_-]+/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Return every authentication mode an app supports, de-duplicated and
 * human-readable. Apps frequently support more than one mode (e.g. OAuth and an
 * API key), so callers should render the full set rather than a single label.
 */
export function integrationAuthLabels(item: IntegrationGalleryItem): string[] {
  if (item.sourceMetadata?.sourceType === 'native' || item.authModes.includes('native')) {
    return ['Native'];
  }
  const labels: string[] = [];
  for (const mode of item.authModes) {
    const label = humanizeAuthMode(mode);
    if (label && !labels.includes(label)) labels.push(label);
  }
  return labels;
}
