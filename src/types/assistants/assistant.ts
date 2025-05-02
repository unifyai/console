import { ResponseProps } from "../common";

export interface Assistant {
  agent_id: string;
  // Profile fields
  first_name: string;
  surname: string;
  profile_photo: string;
  age: number | null;
  region: string | null;
  about: string | null;
  // Contact fields
  email: string | null;
  phone: string | null;
  // Contract fields
  weekly_limit: number | null;
  max_parallel: number | null;
  // Meta fields
  created_at: string;
  updated_at: string;
  // Client-side generated signed URL for GCS photos
  signedProfilePhotoUrl?: string;
}

export interface AssistantActions {
  list: () => Promise<Assistant[] | ResponseProps>;
  update: (assistantId: string, about: string | null,phone: string | null,email: string | null) => Promise<ResponseProps>;
  delete: (assistantId: string) => Promise<ResponseProps>;
  downloadPhoto: (filePath: string) => Promise<{ signedUrl?: string; error?: string }>;
  deletePhoto: (filePathOrUrl: string) => Promise<{ success: boolean; message?: string }>;
}