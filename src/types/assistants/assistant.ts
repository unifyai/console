import { ResponseProps } from "../common";
import { SupportedLanguage, Gender as CartesiaGender, Gender } from "@cartesia/cartesia-js/api"; // LocalizeTargetLanguage removed, Literal added (if needed from API spec)
import { AssistantHiringApprovalResponse, HiringProfileData } from "../user";
import { ChatMessage, UnifyMessage } from "./chat";
import { SecretActions } from "./secret";
import { ConnectionDetails } from "./call";

export type VoiceProvider = "elevenlabs" | "cartesia" | "openai"

export type UserLocalDesktop  = "ubuntu"  | "windows" | "macos";

// Type for the pre_hire_chat payload
export interface PreHireChatMessage {
  role: "user" | "assistant";
  msg: string;
}

// Assistant profile types
export interface Assistant {
  agent_id: string;
  first_name: string;
  surname: string;
  profile_photo: string | null;
  profile_video: string | null;
  age: number | null;
  region: string | null;
  about: string | null;
  country: string | null; // Country code for phone number provisioning e.g. "US", "GB"
  timezone: string | null;
  gender?: 'male' | 'female';
  // Voice fields
  voice_id: string | null; // Provider Voice ID
  voice_provider: VoiceProvider | null;
  voice_mode: "sts" | "tts";
  // Contact fields
  email: string | null;
  phone: string | null;
  assistant_whatsapp_number: string | null;
  user_phone: string | null;
  user_whatsapp_number: string | null;
  // Advanced fields
  user_local_desktop?: UserLocalDesktop | null;
  desktop_url?: string | null;
  // Contract fields
  weekly_limit: number | null;
  max_parallel: number | null;
  // Meta fields
  created_at: string;
  updated_at: string;
  // Client-side generated signed URL for GCS photos
  signedProfilePhotoUrl?: string;
  signedProfileVideoUrl?: string;
}

export interface AssistantStatus {
    running: boolean;
    uptime_seconds: number;
    process_id: number | null;
    assistant_id: string;
    shutdown_reason: string | null;
    inactivity_timeout_minutes: number;
    message: string | null;
}

export type AssistantPreset =
  Omit<Assistant, 'agent_id' | 'created_at' | 'updated_at' | 'signedProfilePhotoUrl' | 'signedProfileVideoUrl' | 'email' | 'phone' | 'user_phone' | 'user_whatsapp_number' | 'assistant_whatsapp_number' | 'weekly_limit' | 'max_parallel' | 'voice_id' | 'voice_provider'>
  & {
      gender?: 'male' | 'female';
      country: string;
      voice_ids: {
          cartesia?: string | null;
          elevenlabs?: string | null;
          openai?: string | null;
      };
      language?: string | null;
    };

export interface SocialAccount {
  platform: string;
  identifier: string;
  isVerified: boolean;

  // UI state for verification flow
  isVerifying: boolean;
  verificationCodeSent: string | null;
  verificationSentAt: Date | null;
  verificationAttempts: number;
  verificationError: string | null;
  isInitial?: boolean;
}

export type AssistantFormData =
  Omit<Assistant, 'agent_id' | 'created_at' | 'updated_at' | 'signedProfilePhotoUrl' | 'signedProfileVideoUrl' | 'profile_photo' | 'profile_video' | 'phone' | 'assistant_whatsapp_number' | 'user_whatsapp_number' | 'weekly_limit' | 'max_parallel' | 'gender' | 'voice_id' | 'voice_provider' | 'email'>
  & {
      email?: string | null;
      isEmailAdded?: boolean;
      emailManuallyEdited?: boolean;
      profile_photo_url?: string | null; // GCS URL for photo
      profile_video_url?: string | null; // GCS URL for video
      photoFile?: File | null;
      videoFile?: File | null;
      photoPreviewUrl?: string | null;
      videoPreviewUrl?: string | null;
      video_source_voice_id?: string | null;
      user_phone?: string | null;
      user_phone_isVerified?: boolean;
      user_phone_isVerifying?: boolean;
      user_phone_verificationCodeSent?: string | null;
      user_phone_verificationSentAt?: Date | null;
      user_phone_verificationAttempts?: number;
      user_phone_verificationError?: string | null;
      user_whatsapp_number?: string | null;
      country?: string;
      timezone?: string | null;
      voice_id?: string;
      voice_name?: string;
      voice_description?: string;
      voice_gender?: CartesiaGender;
      voice_language?: SupportedLanguage | "multi";
      voice_exists?: boolean;
      voice_provider?: VoiceProvider;
      isPresetPristine?: boolean;
      presetOriginalValues?: Pick<AssistantFormData, 'first_name' | 'surname' | 'age' | 'region' | 'voice_id' | 'profile_photo_url' | 'country'> | null;
      currentPreset?: AssistantPreset | null;
      social_accounts?: SocialAccount[];
      setup?: 'remote' | 'local';
      isPhoneNumberAdded?: boolean;
      operating_system?: 'ubuntu' | 'windows' | 'macos';
      design_include_bio?: boolean;
      fast_mode?: boolean;
    };

export interface PhotoUploadResponse {
    gcs_url: string;
}

export interface PhotoGenerateRequest {
    prompt: string;
    aspect_ratio?: string;
    output_format?: string;
    output_quality?: number;
    safety_tolerance?: number;
    prompt_upsampling?: boolean;
}

export interface PhotoEditRequest {
    prompt: string;
    input_image: string;
    aspect_ratio?: string;
    output_format?: string;
    safety_tolerance?: number;
}

export interface PhotoCreationResponse {
    url: string;
}

export interface ReplicatePredictionResponse {
    id: string;
    model: string;
    version: string;
    input?: Record<string, any>;
    output?: any; // This will be an array with the video URL on success
    logs?: string;
    error?: any;
    status: 'starting' | 'processing' | 'succeeded' | 'failed' | 'canceled';
    created_at: string;
    completed_at?: string;
    urls?: {
        get?: string;
        cancel?: string;
    };
}
 


export interface AssistantUpdatePayload {
    about?: string | null;
    weekly_limit?: number | null;
    max_parallel?: number | null;
    user_phone?: string | null;
    phone?: string | null;
    email?: string | null;
    user_whatsapp_number?: string | null;
    voice_id?: string | null;
    voice_provider?: VoiceProvider | null;
    voice_mode?: "sts" | "tts";
    country?: string | null;
    timezone?: string | null;
    profile_photo?: string | null;
    profile_video?: string | null;
    user_local_desktop?: UserLocalDesktop | null;
}


// Assistant voice types
export interface Voice {
  voice_id: string;
  name: string;
  description: string;
  gender: Gender;
  language: SupportedLanguage | "multi";
  provider: "cartesia" | "elevenlabs" | "openai";
  is_preset?: boolean;
}

export type VoiceOption = Voice & {
    isUserVoiceInOrchestra?: boolean;
};

export interface GenerateSpeechPayload {
    text: string;
    provider: "cartesia" | "elevenlabs" | "openai";
    voice_id: string;
    model_id?: string;
    output_format: "mp3" | "wav" | "flac" | "pcm_s16le" | "pcm_mulaw";
    cartesia_language?: SupportedLanguage;
    cartesia_sample_rate?: number;
    cartesia_bit_rate?: number;
    elevenlabs_optimize_streaming_latency?: number;
    elevenlabs_voice_settings_similarity_boost?: number;
}

export interface AvailablePhoneCountry {
    code: string;
    name: string;
    flag: string;
}

export interface AvailableSocialPlatform {
    name: string;
    cost: number;
}

export interface VoiceDesignGeneratePreviewsRequest {
    voice_description?: string | null;
    bio?: string | null;
    text?: string;
    auto_generate_text?: boolean;
    model_id?: "eleven_multilingual_ttv_v2" | "eleven_ttv_v3";
}

export interface VoiceDesignPreviewItem {
    audio_base_64: string;
    generated_voice_id: string;
    media_type: string;
    duration_secs?: number;
}

export interface VoiceDesignGeneratePreviewsAPIResponse {
    previews: VoiceDesignPreviewItem[];
    text: string;
}

export interface VoiceDesignCreateFromPreviewRequest {
    generated_voice_id: string;
    voice_name: string;
    voice_description: string;
    labels?: { [key: string]: string };
    language?: SupportedLanguage;
    gender?: CartesiaGender | 'other';
    audio_base_64?: string | null;
    media_type?: string | null;
}

export interface AssistantActions {
    "assistant": {
    list: () => Promise<Assistant[] | ResponseProps>;
    create: (
        first_name: string, surname: string, age: number | null, region: string | null, timezone: string | null,
        profile_photo: string | null, profile_video: string | null, about: string | null, 
        voice_id: string | null, voice_provider: VoiceProvider | null, voice_mode: "sts" | "tts",
        email: string | null, user_phone: string | null, country: string | null,
        user_whatsapp_number: string | null, user_local_desktop: UserLocalDesktop | null,
        preHireChat?: PreHireChatMessage[]
    ) => Promise<ResponseProps & { assistant?: Assistant }>;
    update: (assistantId: string, payload: Partial<AssistantUpdatePayload>) => Promise<ResponseProps>;
    delete: (assistantId: string) => Promise<ResponseProps>;
    status: (assistantId: string) => Promise<AssistantStatus | ResponseProps>;
    },
    "photo": {
    upload: (formData: FormData) => Promise<PhotoUploadResponse | ResponseProps>;
    uploadVideo: (formData: FormData) => Promise<PhotoUploadResponse | ResponseProps>;
    download: (filePathOrUrl: string) => Promise<{signedUrl?: string; detail?: string;}>;
    downloadPresetVideo: (firstName: string, lastName: string, provider: string) => Promise<{signedUrl?: string; detail?: string;}>;
    generate: (payload: PhotoGenerateRequest) => Promise<PhotoCreationResponse | ResponseProps>;
    edit: (formData: FormData) => Promise<PhotoCreationResponse | ResponseProps>;
    animate: (formData: FormData) => Promise<ReplicatePredictionResponse | ResponseProps>;
    getAnimation: (predictionId: string) => Promise<ReplicatePredictionResponse | ResponseProps>;
    cancelAnimation: (predictionId: string) => Promise<ReplicatePredictionResponse | ResponseProps>;
    },
    "voice": {
    list: () => Promise<(Voice & {is_preset?: boolean})[] | ResponseProps>;
    register: (voice_id: string, provider: string, name: string, description: string, gender: CartesiaGender, language: SupportedLanguage | "multi", is_preset: boolean) => Promise<(Voice & {info?: string; is_preset?: boolean}) | ResponseProps>;
    delete: (voice_id: string, voice_provider: string) => Promise<ResponseProps>;
    clone: (formData: FormData) => Promise<(Voice & {info?:string; is_preset?: boolean}) | ResponseProps>;
    generate: (payload: GenerateSpeechPayload) => Promise<{ audioBase64?: string; contentType?: string; detail?: string; status?: number }>;
    preview: (payload: VoiceDesignGeneratePreviewsRequest) => Promise<VoiceDesignGeneratePreviewsAPIResponse | ResponseProps>;
    design: (payload: VoiceDesignCreateFromPreviewRequest) => Promise<(Voice & {info?: string; is_preset?: boolean}) | ResponseProps>;
    },
    "chat": {
        getTranscripts: (assistantContext: string) => Promise<ChatMessage[] | ResponseProps>;
        updateTranscripts: (assistantContext: string, messages: Omit<ChatMessage, 'id'>[]) => Promise<ResponseProps>;
        message: (payload: UnifyMessage) => Promise<ResponseProps & { info?: string }>;
    },
    "contact": {
    delete: (assistantId: string, contactType: "phone" | "email" | "whatsapp") => Promise<ResponseProps & { assistant?: Assistant }>;
    listAllAssistantEmails: () => Promise<string[] | ResponseProps>;
    listAvailablePhoneCountries: () => Promise<AvailablePhoneCountry[]>;
    listAvailableSocialPlatforms: () => Promise<AvailableSocialPlatform[] | ResponseProps>;
    verifySocialAccount: (platform: string, account_identifier: string) => Promise<{ verification_code: string; sent_at: string; } | ResponseProps>;
    },
    "secret": SecretActions;
    "approval": {
    getProfile: () => Promise<HiringProfileData | ResponseProps>
    requestAccess: () => Promise<AssistantHiringApprovalResponse>;
    claimToken: (token: string) => Promise<AssistantHiringApprovalResponse>;
    },
    "call": {
      getConnectionDetails: (assistantId: string, assistantName: string) => Promise<ConnectionDetails | ResponseProps>;
      dispatchToCall: (assistantId: string, assistantName: string, roomName: string) => Promise<ResponseProps>;
    },
    "desktop": {
        getLiveviewUrl: (assistantId: string) => Promise<{ liveviewUrl?: string } | ResponseProps>;
        sendSystemEvent: (assistantId: string, eventType: 'pause_actor' | 'resume_actor', message: string) => Promise<ResponseProps>;
    }
}
