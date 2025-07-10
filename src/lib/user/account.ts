import { getOrchestraUserClient } from '@/lib/orchestra/orchestra-client';
import { 
  UpdateAccountTypeRequest, 
  UpdateBusinessInfoRequest, 
  UserBusinessStatusResponse, 
  UpdateOnboardingStatusRequest,
  OnboardingStatusResponse,
  UpdateOnboardingStatusResponse
} from '@/types/user';

export async function updateUserAccountType(apiKey: string, data: UpdateAccountTypeRequest) {
  const orchestraClient = await getOrchestraUserClient(apiKey);
  const response = await orchestraClient.put('/user/account-type', data);
  return response.data;
}

export async function updateBusinessInfo(apiKey: string, data: UpdateBusinessInfoRequest) {
  const orchestraClient = await getOrchestraUserClient(apiKey);
  const response = await orchestraClient.patch('/user/business-info', data);
  return response.data;
}

export async function updateOnboardingStatus(apiKey: string, data: UpdateOnboardingStatusRequest): Promise<UpdateOnboardingStatusResponse> {
  const orchestraClient = await getOrchestraUserClient(apiKey);
  const response = await orchestraClient.put('/user/onboarding-status', data);
  return response.data;
}

export async function getUserBusinessStatus(apiKey: string): Promise<UserBusinessStatusResponse> {
  const orchestraClient = await getOrchestraUserClient(apiKey);
  const response = await orchestraClient.get('/user/business-status');
  return response.data;
}

export async function getOnboardingStatus(apiKey: string): Promise<OnboardingStatusResponse> {
  const orchestraClient = await getOrchestraUserClient(apiKey);
  const response = await orchestraClient.get('/user/onboarding-status');
  return response.data;
} 