import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';
import {
  ValidateTaxIdRequest,
  TaxIdValidationResponse,
  SupportedTaxCountriesResponse,
} from '@/types/user';

export async function validateTaxId(
  apiKey: string,
  data: ValidateTaxIdRequest
): Promise<TaxIdValidationResponse> {
  const orchestraClient = await getOrchestraUserClient(apiKey);
  const response = await orchestraClient.post('/user/validate-tax-id', null, { params: data });
  return response.data;
}

export async function getSupportedTaxCountries(
  apiKey: string
): Promise<SupportedTaxCountriesResponse> {
  const orchestraClient = await getOrchestraUserClient(apiKey);
  const response = await orchestraClient.get('/user/supported-tax-countries');
  return response.data;
}
