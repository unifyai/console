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
