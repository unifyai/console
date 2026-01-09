import { createOrchestraClient } from '@/lib/orchestra/client';
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
  const { data: responseData, error } = await client.POST('/v0/user/validate-tax-id', {
    params: { query },
  });

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
  const { data, error } = await client.GET('/v0/user/supported-tax-countries');

  if (error) {
    throw new Error(
      ((error as Record<string, unknown>)?.detail as string) ||
        'Failed to get supported tax countries'
    );
  }

  return data as SupportedTaxCountriesResponse;
}
