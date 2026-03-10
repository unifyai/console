/**
 * User-related Orchestra API calls
 *
 * This file consolidates all direct Orchestra calls for user management.
 * Uses the typed OpenAPI client for type-safe API calls.
 */

import { createOrchestraClient } from '@/lib/orchestra/client';
import {
  UpdateOnboardingStatusRequest,
  OnboardingStatusResponse,
  UpdateOnboardingStatusResponse,
} from '@/types/user';

// =============================================================================
// Account Functions
// =============================================================================

export async function updateOnboardingStatus(
  apiKey: string,
  data: UpdateOnboardingStatusRequest
): Promise<UpdateOnboardingStatusResponse> {
  const client = createOrchestraClient(apiKey);
  const { data: responseData, error } = await client.PUT('/v0/user/onboarding-status', {
    body: data as never,
  });

  if (error) {
    throw new Error(
      ((error as Record<string, unknown>)?.detail as string) || 'Failed to update onboarding status'
    );
  }

  return responseData as unknown as UpdateOnboardingStatusResponse;
}

export async function getOnboardingStatus(apiKey: string): Promise<OnboardingStatusResponse> {
  const client = createOrchestraClient(apiKey);
  const { data, error } = await client.GET('/v0/user/onboarding-status');

  if (error) {
    throw new Error(
      ((error as Record<string, unknown>)?.detail as string) || 'Failed to get onboarding status'
    );
  }

  return data as unknown as OnboardingStatusResponse;
}

// =============================================================================
// Tax Functions
// =============================================================================

import {
  ValidateTaxIdRequest,
  TaxIdValidationResponse,
  SupportedTaxCountriesResponse,
} from '@/types/user';

export async function validateTaxId(
  apiKey: string,
  data: ValidateTaxIdRequest
): Promise<TaxIdValidationResponse> {
  const client = createOrchestraClient(apiKey);
  // Query params need to be snake_case for the OpenAPI types
  // eslint-disable-next-line @typescript-eslint/naming-convention
  const query = { tax_id: data.taxId, country: data.country };
  const { data: responseData, error } = await client.POST('/v0/billing/validate-tax-id' as never, {
    params: { query },
  } as never);

  if (error) {
    throw new Error(
      ((error as Record<string, unknown>)?.detail as string) || 'Failed to validate tax ID'
    );
  }

  return responseData as TaxIdValidationResponse;
}

export async function getSupportedTaxCountries(
  apiKey: string
): Promise<SupportedTaxCountriesResponse> {
  const client = createOrchestraClient(apiKey);
  const { data, error } = await client.GET('/v0/billing/supported-tax-countries' as never);

  if (error) {
    throw new Error(
      ((error as Record<string, unknown>)?.detail as string) ||
        'Failed to get supported tax countries'
    );
  }

  return data as SupportedTaxCountriesResponse;
}
