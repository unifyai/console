import { ResponseProps } from '@/types/common';
import {
  AvailablePhoneCountry,
  AvailableSocialPlatform,
  Assistant,
} from '../../types/assistants/assistant';
import { getCountryFlag, getCountryName } from '../../utils/assistants/country-utils';
import { snakeToCamelObject } from '@/utils/casing';

export const listAllAssistantEmails = async (apiKey: string) => {
  return async (): Promise<string[] | ResponseProps> => {
    'use server';
    try {
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/contact/email`, {
        method: 'GET',
        headers: { apiKey: apiKey },
      });
      const data = await response.json();
      if (!response.ok) {
        return {
          detail: data.detail || `Failed to list all assistant emails: ${response.statusText}`,
        };
      }
      // The /api/contact/email GET proxy should return { emails: string[] }
      if (data.emails && Array.isArray(data.emails)) {
        return data.emails as string[];
      }
      return {
        detail: 'Listing all assistant emails succeeded but response format was unexpected.',
      };
    } catch (error) {
      return {
        detail:
          error instanceof Error ? error.message : 'Unknown error listing all assistant emails.',
      };
    }
  };
};

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
    contactType: 'phone' | 'email' | 'whatsapp'
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
          body: JSON.stringify({ contactType: contactType }),
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
