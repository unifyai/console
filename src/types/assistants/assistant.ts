// src/types/team/assistant.ts
export interface Assistant {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  avatarUrl: string;
  // Profile fields
  age: number | null;
  region: string | null;
  about: string;
  skills: string;
  linkedinUrl?: string;
}