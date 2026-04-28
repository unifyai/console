import { AxiosError } from 'axios';
import { ResponseProps } from '@/types/common';
import {
  AvailablePhoneCountry,
  AvailableSocialPlatform,
  Assistant,
} from '../../types/assistants/assistant';
import { getCountryFlag, getCountryName } from '../../utils/assistants/country-utils';
import { snakeToCamelObject, camelToSnakeObject } from '@/utils/casing';
import {
  AssistantContactCost,
  AssistantContactCreatePayload,
  ContactCosts,
  ContactType,
  OAuthProvider,
  GrantedFeaturesResponse,
} from '@/types/assistants/contact';
import { OrchestraAdminClient } from '@/lib/orchestra/orchestra-client';

export const listAvailablePhoneCountries = async (apiKey: string) => {
  return async (): Promise<AvailablePhoneCountry[]> => {
    'use server';
    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/contact/phone/available-countries`,
        {
          method: 'GET',
          headers: { apiKey: apiKey },
        }
      );
      if (!response.ok) {
        console.error('Failed to fetch available countries, status:', response.status);
        throw new Error('Failed to fetch available countries');
      }
      const data = await response.json();

      if (Array.isArray(data?.countries)) {
        return data.countries;
      } else {
        console.warn('Unexpected response format for countries:', data);
        const usName = getCountryName('US') || 'United States';
        const usFlag = getCountryFlag('US');
        return [{ code: 'US', name: usName, flag: usFlag }];
      }
    } catch (error) {
      console.error('Error fetching available countries:', error);
      // Fallback to US only in case of error
      const usName = getCountryName('US') || 'United States';
      const usFlag = getCountryFlag('US');
      return [{ code: 'US', name: usName, flag: usFlag }];
    }
  };
};

export const listAvailableSocialPlatforms = async (apiKey: string) => {
  return async (): Promise<AvailableSocialPlatform[] | ResponseProps> => {
    'use server';
    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/contact/social/available-platforms`,
        {
          method: 'GET',
          headers: { apiKey: apiKey },
        }
      );
      const data = await response.json();
      if (!response.ok) {
        return {
          detail:
            data.detail || `Failed to list available social platforms: ${response.statusText}`,
        };
      }
      if (data.platforms && Array.isArray(data.platforms)) {
        return data.platforms as AvailableSocialPlatform[];
      }
      return { detail: 'Listing social platforms succeeded but response format was unexpected.' };
    } catch (error) {
      return {
        detail: error instanceof Error ? error.message : 'Unknown error listing social platforms.',
      };
    }
  };
};

export const verifySocialAccount = async (apiKey: string) => {
  return async (
    platform: string,
    accountIdentifier: string
  ): Promise<{ verificationCode: string; sentAt: string } | ResponseProps> => {
    'use server';
    try {
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/contact/social/verify`, {
        method: 'POST',
        headers: { apiKey: apiKey, 'Content-Type': 'application/json' },
        // API expects snake_case
        body: JSON.stringify({ platform, accountIdentifier: accountIdentifier }),
      });
      const data = await response.json();
      if (!response.ok) {
        return {
          detail:
            data.detail || `Failed to send verification for ${platform}: ${response.statusText}`,
        };
      }
      if (data.verificationCode && data.sentAt) {
        return snakeToCamelObject<{ verificationCode: string; sentAt: string }>(data);
      }
      return { detail: 'Verification succeeded but response format was unexpected.' };
    } catch (error) {
      return {
        detail: error instanceof Error ? error.message : 'Unknown error during verification.',
      };
    }
  };
};

export const deleteAssistantContact = async (apiKey: string) => {
  return async (
    assistantId: string,
    contactType: ContactType
  ): Promise<ResponseProps & { assistant?: Assistant }> => {
    'use server';

    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/assistant/${assistantId}/contact`,
        {
          method: 'DELETE',
          headers: {
            apiKey: apiKey,
            'Content-Type': 'application/json',
          },
          // eslint-disable-next-line @typescript-eslint/naming-convention
          body: JSON.stringify({ contact_type: contactType }),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.detail || `Failed to delete contact: ${response.statusText}`;
        return { detail: errorMessage };
      }

      const successMessage = data.info || `Contact deleted successfully.`;
      // The backend is expected to return the updated assistant object in the 'info' field.
      const updatedAssistant = snakeToCamelObject<Assistant>(data.info);
      return { info: successMessage, assistant: updatedAssistant };
    } catch (error) {
      console.error(
        `[actions.ts deleteAssistantContact] Error deleting contact for assistant ${assistantId}:`,
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown server error occurred.';
      return { detail: errorMessage };
    }
  };
};

/**
 * Create a new contact detail for an assistant.
 *
 * Calls POST /api/assistant/{assistantId}/contact which proxies to
 * POST /v0/assistant/{assistant_id}/contact in Orchestra.
 *
 * This provisions the external infrastructure (phone, email, WhatsApp) and
 * creates a billing-tracked AssistantContact record.
 */
export const createAssistantContact = async (apiKey: string) => {
  return async (
    assistantId: string,
    payload: AssistantContactCreatePayload
  ): Promise<ResponseProps & { assistant?: Assistant }> => {
    'use server';

    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/assistant/${assistantId}/contact`,
        {
          method: 'POST',
          headers: {
            apiKey: apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(camelToSnakeObject(payload)),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        const errorMessage = data.detail || `Failed to create contact: ${response.statusText}`;
        return { detail: errorMessage };
      }

      const successMessage = data.info || `Contact created successfully.`;
      const updatedAssistant = data.info ? snakeToCamelObject<Assistant>(data.info) : undefined;
      return { info: successMessage, assistant: updatedAssistant };
    } catch (error) {
      console.error(
        `[contact.ts createAssistantContact] Error creating contact for assistant ${assistantId}:`,
        error
      );
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown server error occurred.';
      return { detail: errorMessage };
    }
  };
};

/**
 * Initiate a BYOD OAuth connection for an assistant.
 *
 * Calls POST /api/assistant/{assistantId}/connect which proxies to
 * POST /v0/assistant/{assistant_id}/connect in Orchestra.
 *
 * Returns an OAuth URL the user should be redirected to.
 */
export const connectAssistantAccount = async (apiKey: string) => {
  return async (
    assistantId: string,
    provider: OAuthProvider,
    features: string[],
    redirectAfter?: string
  ): Promise<{ oauthUrl: string } | ResponseProps> => {
    'use server';

    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/assistant/${assistantId}/connect`,
        {
          method: 'POST',
          headers: {
            apiKey: apiKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(camelToSnakeObject({ provider, features, redirectAfter })),
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { detail: data.detail || `Failed to initiate connection: ${response.statusText}` };
      }

      const info = data.info ?? data;
      const oauthUrl = info.oauthUrl ?? info.oauth_url;
      if (oauthUrl) {
        return { oauthUrl };
      }
      return { detail: 'Connection succeeded but no OAuth URL was returned.' };
    } catch (error) {
      return {
        detail: error instanceof Error ? error.message : 'Unknown error initiating connection.',
      };
    }
  };
};

/**
 * Fully disconnect a BYOD account from an assistant.
 *
 * Calls DELETE /api/assistant/{assistantId}/connect which proxies to
 * DELETE /v0/assistant/{assistant_id}/connect in Orchestra.
 */
export const disconnectAssistantAccount = async (apiKey: string) => {
  return async (assistantId: string): Promise<ResponseProps> => {
    'use server';

    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/assistant/${assistantId}/connect`,
        {
          method: 'DELETE',
          headers: { apiKey: apiKey },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return { detail: data.detail || `Failed to disconnect: ${response.statusText}` };
      }

      return { info: data.info || 'Account disconnected successfully.' };
    } catch (error) {
      return {
        detail: error instanceof Error ? error.message : 'Unknown error disconnecting account.',
      };
    }
  };
};

/**
 * Fetch the granted suite features for an assistant.
 *
 * Calls GET /api/assistant/{assistantId}/granted-features which proxies to
 * GET /v0/assistant/{assistant_id}/granted-features in Orchestra.
 */
export const getGrantedFeatures = async (apiKey: string) => {
  return async (assistantId: string): Promise<GrantedFeaturesResponse | ResponseProps> => {
    'use server';

    try {
      const response = await fetch(
        `${process.env.NEXTAUTH_URL}/api/assistant/${assistantId}/granted-features`,
        {
          method: 'GET',
          headers: { apiKey: apiKey },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        return {
          detail: data.detail || `Failed to fetch granted features: ${response.statusText}`,
        };
      }

      const info = data.info ?? data;
      return snakeToCamelObject<GrantedFeaturesResponse>(info);
    } catch (error) {
      return {
        detail: error instanceof Error ? error.message : 'Unknown error fetching granted features.',
      };
    }
  };
};

/**
 * Fetch contact costs directly from Orchestra admin API.
 *
 * Calls GET /v0/admin/billing/contact-costs via OrchestraAdminClient.
 *
 * Returns a keyed map of costs per contact type.
 */
export const fetchContactCosts = async () => {
  return async (): Promise<ContactCosts | ResponseProps> => {
    'use server';

    try {
      const response = await OrchestraAdminClient.get('/billing/contact-costs');
      const data = response.data;

      if (Array.isArray(data)) {
        return buildCostsFromRows(data as AssistantContactCost[]);
      }

      console.warn('[contact.ts fetchContactCosts] Unexpected response format');
      return { detail: 'Unexpected response format when fetching contact costs' };
    } catch (error) {
      console.error('[contact.ts fetchContactCosts] Error:', error);
      if (error instanceof AxiosError && error.response?.data?.detail) {
        return { detail: error.response.data.detail };
      }
      return {
        detail: error instanceof Error ? error.message : 'Unknown error fetching contact costs',
      };
    }
  };
};

/**
 * Build a ContactCosts map from an array of AssistantContactCost rows.
 *
 * For each contact type, picks the default row (provider=null, countryCode=null)
 * or falls back to the first row matching that type.
 */
function buildCostsFromRows(rows: AssistantContactCost[]): ContactCosts {
  const costs: ContactCosts = {
    phone: { monthlyCost: 0, oneTimeCost: 0 },
    email: { monthlyCost: 0, oneTimeCost: 0 },
    whatsapp: { monthlyCost: 0, oneTimeCost: 0 },
    discord: { monthlyCost: 0, oneTimeCost: 0 },
  };

  for (const type of ['phone', 'email', 'whatsapp', 'discord'] as const) {
    const typeRows = rows.filter((r) => r.contactType === type);
    if (typeRows.length === 0) continue;

    const defaultRow =
      typeRows.find((r) => r.provider === null && r.countryCode === null) || typeRows[0];

    costs[type] = {
      monthlyCost: defaultRow.monthlyCost,
      oneTimeCost: defaultRow.oneTimeCost,
    };
  }

  return costs;
}
