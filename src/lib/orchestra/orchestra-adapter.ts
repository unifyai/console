import { Adapter, AdapterUser, AdapterAccount, VerificationToken } from "next-auth/adapters";
import {OrchestraAdminClient} from "./orchestra-client";

export function OrchestraAdapter(): Adapter {
  return {
    async createUser(user: Omit<AdapterUser, "id">): Promise<AdapterUser> {
      const response = await OrchestraAdminClient.post<AdapterUser>("/auth-user", user);
      return response.data;
    },
    async getUser(id: string): Promise<AdapterUser | null> {
      const response = await OrchestraAdminClient.get<AdapterUser>(`/auth-user`, { params: { user_id: id } });
      return response.data;
    },
    async getUserByEmail(email: string): Promise<AdapterUser | null> {
      const response = await OrchestraAdminClient.get<AdapterUser>("/auth-user/by-email", { params: { email: email } });
      return response.data;
    },
    async getUserByAccount({
      providerAccountId,
      provider,
    }: {
      providerAccountId: string;
      provider: string;
    }): Promise<AdapterUser | null> {
      const response = await OrchestraAdminClient.get<AdapterUser>("/auth-user/by-account", {
        params: { provider_account_id: providerAccountId, provider: provider },
      });
      return response.data;
    },
    async updateUser(user: Partial<AdapterUser>): Promise<AdapterUser> {
      const response = await OrchestraAdminClient.put<AdapterUser>(`/auth-user/${user.id}`, user);
      return response.data;
    },
    async deleteUser(userId: string): Promise<void> {
      await OrchestraAdminClient.delete("/auth-user", { params: { user_id: userId } });
    },
    async linkAccount(account: AdapterAccount): Promise<void> {
      await OrchestraAdminClient.post("/account", account);
    },
    async unlinkAccount({
      providerAccountId,
      provider,
    }: {
      providerAccountId: string;
      provider: string;
    }): Promise<void> {
      await OrchestraAdminClient.delete("/account", {
        params: { providerAccountId, provider },
      });
    },
  };
}

export default OrchestraAdapter;
