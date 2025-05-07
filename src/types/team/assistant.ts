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

export type AssistantPreset =
  Omit<Assistant, 'agent_id' | 'created_at' | 'updated_at' | 'signedProfilePhotoUrl' | 'email' | 'phone' | 'weekly_limit' | 'max_parallel'>

export type AssistantFormData =
  Omit<Assistant, 'agent_id' | 'created_at' | 'updated_at' | 'signedProfilePhotoUrl' | 'profile_photo' | 'email' | 'phone' | 'weekly_limit' | 'max_parallel'>
  & {imageFile?: File | null; imagePreview?: string | null;};


export interface AssistantActions {
  "assistant": {
    list: () => Promise<Assistant[] | ResponseProps>;
    create: (first_name: string, surname: string, age: number | null, region: string | null, profile_photo: string | null, about: string | null) => Promise<ResponseProps>;
    update: (assistantId: string, about: string | null, phone: string | null, email: string | null) => Promise<ResponseProps>;
    delete: (assistantId: string) => Promise<ResponseProps>;
  },
  "photo": {    
    upload: (contentType: string, fileSize: number) => Promise<{ signedUrl: string, filePath: string, bucketName: string } | ResponseProps>;
    download: (filePathOrUrl: string) => Promise<{signedUrl?: string; detail?: string;}>;
    delete: (filePathOrUrl: string) => Promise<ResponseProps>;
  }
}