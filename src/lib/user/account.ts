import { createOrchestraClient } from '@/lib/orchestra/client';
import {
  UpdateAccountTypeRequest,
  UpdateBusinessInfoRequest,
  UserBusinessStatusResponse,
  UpdateOnboardingStatusRequest,
  OnboardingStatusResponse,
  UpdateOnboardingStatusResponse,
} from '@/types/user';

export async function updateUserAccountType(apiKey: string, data: UpdateAccountTypeRequest) {
  const client = createOrchestraClient(apiKey);
  // Note: The middleware handles camelCase to snake_case conversion automatically
  // We use 'as never' to bypass strict type checking since the types are in different casings
  const { data: responseData, error } = await client.PUT('/v0/user/account-type', {
    body: data as never,
  });

  if (error) {
    throw new Error(
      ((error as Record<string, unknown>)?.detail as string) || 'Failed to update account type'
    );
  }

  return responseData;
}

export async function updateBusinessInfo(apiKey: string, data: UpdateBusinessInfoRequest) {
  const client = createOrchestraClient(apiKey);
  const { data: responseData, error } = await client.PATCH('/v0/user/business-info', {
    body: data as never,
  });

  if (error) {
    throw new Error(
      ((error as Record<string, unknown>)?.detail as string) || 'Failed to update business info'
    );
  }

  return responseData;
}

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

export async function getUserBusinessStatus(apiKey: string): Promise<UserBusinessStatusResponse> {
  const client = createOrchestraClient(apiKey);
  const { data, error } = await client.GET('/v0/user/business-status');

  if (error) {
    throw new Error(
      ((error as Record<string, unknown>)?.detail as string) || 'Failed to get business status'
    );
  }

  // The middleware transforms snake_case response to camelCase
  return data as unknown as UserBusinessStatusResponse;
}

export async function getOnboardingStatus(apiKey: string): Promise<OnboardingStatusResponse> {
  const client = createOrchestraClient(apiKey);
  const { data, error } = await client.GET('/v0/user/onboarding-status');

  if (error) {
    throw new Error(
      ((error as Record<string, unknown>)?.detail as string) || 'Failed to get onboarding status'
    );
  }

  // The middleware transforms snake_case response to camelCase
  return data as unknown as OnboardingStatusResponse;
}
