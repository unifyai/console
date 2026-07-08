import { describe, expect, it, vi } from 'vitest';
import { fetchCoordinatorState } from '@/lib/assistants/coordinatorState';
import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';

vi.mock('@/lib/user/user', () => ({
  getCurrentUser: vi.fn(async () => ({ apiKey: 'test-key' })),
}));

vi.mock('@/lib/orchestra/orchestra-client', () => ({
  getOrchestraUserClient: vi.fn(),
}));

describe('fetchCoordinatorState', () => {
  it('normalizes onboarding chip metadata from Orchestra', async () => {
    vi.mocked(getOrchestraUserClient).mockResolvedValue({
      get: vi.fn(async () => ({
        data: {
          info: {
            onboarding_active: true,
            completed_step_ids: [],
            skipped_step_ids: [],
            skipped_phase_ids: [],
            onboarding: {
              steps: [
                {
                  id: 'apps',
                  title: 'Connect T-W1N with your apps',
                  phase: 'Integrations',
                  status: 'available',
                  can_skip: true,
                  chips_chat: [
                    {
                      id: 'crm-sales',
                      label: 'Connect a CRM or sales tool',
                      gallery_category: 'crm_sales',
                      search_query: 'crm|sales|hubspot|pipedrive',
                    },
                  ],
                  chips_call: [],
                  dependencies: [],
                },
              ],
            },
          },
        },
      })),
    } as never);

    const state = await fetchCoordinatorState(123);
    const chip = state.onboarding?.steps[0]?.chipsChat[0];

    expect(chip).toMatchObject({
      id: 'crm-sales',
      label: 'Connect a CRM or sales tool',
      galleryCategory: 'crm_sales',
      searchQuery: 'crm|sales|hubspot|pipedrive',
    });
  });
});
