import { ResponseProps } from "../common";
import { SupportedLanguage, Gender as CartesiaGender, LocalizeTargetLanguage, Gender } from "@cartesia/cartesia-js/api";
import { AssistantHiringApprovalResponse, HiringProfileData } from "../user";

// Assistant profile types
export interface Assistant {
  agent_id: string;
  first_name: string;
  surname: string;
  profile_photo: string | null;
  age: number | null;
  region: string | null;
  about: string | null;
  gender?: 'male' | 'female';
  // Voice fields
  voice_id: string | null; // Cartesia Voice ID
  // Contact fields
  email: string | null;
  phone: string | null;
  user_phone: string | null;
  whatsapp_sid?: string | null;
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
  Omit<Assistant, 'agent_id' | 'created_at' | 'updated_at' | 'signedProfilePhotoUrl' | 'email' | 'phone' | 'user_phone' | 'whatsapp_sid' | 'weekly_limit' | 'max_parallel'>
  & { gender?: 'male' | 'female'; voice_id: string };

export type AssistantFormData =
  Omit<Assistant, 'agent_id' | 'created_at' | 'updated_at' | 'signedProfilePhotoUrl' | 'profile_photo' | 'phone' | 'whatsapp_sid' | 'weekly_limit' | 'max_parallel' | 'gender' | 'voice_id'>
  & { 
      email?: string; 
      emailManuallyEdited?: boolean; 
      imageFile?: File | null; // For new upload
      profile_photo_gcs_url?: string | null; // To store GCS URL from backend after upload
      imagePreview?: string | null; // For local blob preview or existing URL (preset/GCS)
      user_phone?: string | null;
      voice_id?: string;
      voice_name?: string;
      voice_description?: string;
      voice_gender?: CartesiaGender;
      voice_language?: SupportedLanguage;
      voice_exists?: boolean;
    };

export interface PhotoUploadBackendResponse {
    gcs_url: string;
}

export interface AssistantUpdatePayload {
    about?: string | null;
    weekly_limit?: number | null;
    max_parallel?: number | null;
    user_phone?: string | null;
    phone?: string | null;
    email?: string | null;
    whatsapp_sid?: string | null;
    voice_id?: string | null;
}


// Assistant voice types
export interface Voice {
  voice_id: string; // Cartesia Voice ID (PK in your 'voices' table)
  name: string; 
  description: string;
  gender: Gender; // 'female', 'male' - consistent with Cartesia
  language: SupportedLanguage; // language code e.g. 'en'
  is_preset?: boolean; // Indicates if this is a Cartesia preset
}

export type VoiceOption = Voice & {  
    isUserVoiceInOrchestra?: boolean;
};

export interface AssistantActions {
  "assistant": {
    list: () => Promise<Assistant[] | ResponseProps>;
    create: (
        first_name: string, surname: string, age: number | null, region: string | null, 
        profile_photo: string | null, about: string | null, voice_id: string | null, 
        email: string, user_phone: string | null
    ) => Promise<ResponseProps & { assistant?: Assistant }>;
    update: (assistantId: string, payload: AssistantUpdatePayload) => Promise<ResponseProps>;
    delete: (assistantId: string) => Promise<ResponseProps>;
  },
  "photo": {    
    upload: (file: File) => Promise<PhotoUploadBackendResponse | ResponseProps>; 
    download: (filePathOrUrl: string) => Promise<{signedUrl?: string; detail?: string;}>;
  },
  "voice": {
    list: () => Promise<(Voice & {is_preset?: boolean})[] | ResponseProps>; 
    register: (voice_id: string, name: string, description: string, gender: CartesiaGender, language: SupportedLanguage, is_preset: boolean) => Promise<(Voice & {info?: string; is_preset?: boolean}) | ResponseProps>;
    delete: (cartesia_voice_id: string) => Promise<ResponseProps>;
    clone: (file: File, name: string, language: SupportedLanguage, description?: string) => Promise<(Voice & {info?:string; is_preset?: boolean}) | ResponseProps>; 
    localize: (baseCartesiaVoiceId: string, name: string, targetLanguage: LocalizeTargetLanguage, originalSpeakerGender: CartesiaGender, description?: string, dialect?:string) => Promise<(Voice & {info?:string; is_preset?: boolean}) | ResponseProps>;
  },
  "contact": {
    listAllAssistantEmails: () => Promise<string[] | ResponseProps>;
  },
  "approval": {
    getProfile: () => Promise<HiringProfileData | ResponseProps>
    requestAccess: () => Promise<AssistantHiringApprovalResponse>;
    claimToken: (token: string) => Promise<AssistantHiringApprovalResponse>;
  }
}