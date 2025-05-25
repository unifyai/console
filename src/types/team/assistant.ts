import { ResponseProps } from "../common";
import { SupportedLanguage, Gender as CartesiaGender, LocalizeTargetLanguage, Gender } from "@cartesia/cartesia-js/api";

// Assistant profile types
export interface Assistant {
  agent_id: string;
  first_name: string;
  surname: string;
  profile_photo: string; 
  age: number | null;
  region: string | null;
  about: string | null;
  gender?: 'male' | 'female';
  // Voice fields
  voice_id: string | null; // Cartesia Voice ID
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
  & { gender?: 'male' | 'female'; voice_id: string };

export type AssistantFormData =
  Omit<Assistant, 'agent_id' | 'created_at' | 'updated_at' | 'signedProfilePhotoUrl' | 'profile_photo' | 'phone' | 'weekly_limit' | 'max_parallel' | 'gender' | 'voice_id'>
  & { 
      email?: string; // Added email
      emailManuallyEdited?: boolean; // To track if user edited the auto-generated email
      imageFile?: File | null;
      imagePreview?: string | null;
      voice_id?: string;
      voice_name?: string;
      voice_description?: string;
      voice_gender?: CartesiaGender;
      voice_language?: SupportedLanguage;
      voice_exists?: boolean;
    };

// Assistant voice types
export interface Voice {
  voice_id: string; // Cartesia Voice ID (PK in your 'voices' table)
  name: string; 
  description: string;
  gender: Gender; // 'female', 'male' - consistent with Cartesia
  language: SupportedLanguage; // language code e.g. 'en'
}

export type VoiceOption = Voice & {  isPreset?: boolean; isUserVoiceInOrchestra?: boolean };

export interface AssistantActions {
  "assistant": {
    list: () => Promise<Assistant[] | ResponseProps>;
    create: (first_name: string, surname: string, age: number | null, region: string | null, profile_photo: string | null, about: string | null,voice_id: string | null, email: string | null, phone: string | null) => Promise<ResponseProps & { assistant?: Assistant }>;
    update: (assistantId: string, about: string | null, phone: string | null, email: string | null, voice_id: string | null) => Promise<ResponseProps>;
    delete: (assistantId: string) => Promise<ResponseProps>;
  },
  "photo": {    
    upload: (contentType: string, fileSize: number) => Promise<{ signedUrl: string, filePath: string, bucketName: string } | ResponseProps>;
    download: (filePathOrUrl: string) => Promise<{signedUrl?: string; detail?: string;}>;
    delete: (filePathOrUrl: string) => Promise<ResponseProps>;
  },
  "voice": {
    // Orchestra DB Voice Management
    listVoicesFromOrchestra: () => Promise<Voice[] | ResponseProps>; 
    createVoiceInOrchestra: (voice_id: string, name: string, description: string, gender: CartesiaGender, language: SupportedLanguage) => Promise<(Voice & {info?: string}) | ResponseProps>;
    deleteVoiceFromOrchestra: (cartesia_voice_id: string) => Promise<ResponseProps>;
    // Cartesia Operations (via frontend proxies)
    cloneVoiceOnCartesia: (formData: FormData) => Promise<Voice | ResponseProps>; 
    localizeVoiceOnCartesia: (baseCartesiaVoiceId: string, name: string, description: string | null, targetLanguage: LocalizeTargetLanguage, originalSpeakerGender: CartesiaGender) => Promise<Voice | ResponseProps>;
    deleteVoiceFromCartesia: (cartesiaVoiceId: string) => Promise<ResponseProps>; 
  },
  "contact": {
    createEmail: (email: string) => Promise<{ email: string; user?: any; } | ResponseProps>; // Modified to take email
    createPhoneNumber: () => Promise<{ phoneNumber: string } | ResponseProps>;
    deleteEmail: (primaryEmail: string) => Promise<ResponseProps>;
    deletePhoneNumber: (phoneNumber: string) => Promise<ResponseProps>;
    listAllAssistantEmails: () => Promise<string[] | ResponseProps>; // New action
  }
}