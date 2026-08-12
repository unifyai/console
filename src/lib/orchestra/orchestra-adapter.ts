import { Adapter, AdapterUser, AdapterAccount, VerificationToken } from 'next-auth/adapters';
import { OrchestraAdminClient } from './orchestra-client';
import { signupProvenanceFromContext } from '@/lib/server/signupProvenance';

export function OrchestraAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, 'id'>): Promise<AdapterUser> {
      // This is the OAuth signup path, and next-auth hands the adapter
      // only the user — so the origin comes from the request context
      // this call is already running inside.
      const response = await OrchestraAdminClient.post<AdapterUser>('/user', {
        email: user.email,
        name: user.name,
        lastName: user.lastName ?? null,
        image: user.image,
        ...(await signupProvenanceFromContext()),
      });
      return response.data;
    },
    async getUser(id: string): Promise<AdapterUser | null> {
      const response = await OrchestraAdminClient.get<AdapterUser>(`/user`, {
        params: { userId: id },
      });
      return response.data;
    },
    async getUserByEmail(email: string): Promise<AdapterUser | null> {
      const response = await OrchestraAdminClient.get<AdapterUser>('/user/by-email', {
        params: { email: email },
      });
      return response.data;
    },
    async getUserByAccount({
      providerAccountId,
      provider,
    }: {
      providerAccountId: string;
      provider: string;
    }): Promise<AdapterUser | null> {
      const response = await OrchestraAdminClient.get<AdapterUser>('/user/by-account', {
        params: { providerAccountId: providerAccountId, provider: provider },
      });
      return response.data;
    },
    async updateUser(user: Partial<AdapterUser>): Promise<AdapterUser> {
      const response = await OrchestraAdminClient.put<AdapterUser>(`/user/${user.id}`, user);
      return response.data;
    },
    async deleteUser(userId: string): Promise<void> {
      await OrchestraAdminClient.delete('/user', { params: { userId: userId } });
    },
    async linkAccount(account: AdapterAccount): Promise<void> {
      // Transform NextAuth's camelCase fields to orchestra's snake_case
      const { providerAccountId, userId, ...rest } = account;
      await OrchestraAdminClient.post('/auth/account', {
        ...rest,
        providerAccountId: providerAccountId,
        userId: userId,
      });
    },
    async unlinkAccount({
      providerAccountId,
      provider,
    }: {
      providerAccountId: string;
      provider: string;
    }): Promise<void> {
      await OrchestraAdminClient.delete('/auth/account', {
        params: { providerAccountId: providerAccountId, provider },
      });
    },
  };
}

export default OrchestraAdapter;
