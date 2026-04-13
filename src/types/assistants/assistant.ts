import { ResponseProps } from '../common';
import { SupportedLanguage, Gender as CartesiaGender, Gender } from '@cartesia/cartesia-js/api'; // LocalizeTargetLanguage removed, Literal added (if needed from API spec)
import { ChatMessage, UnifyMessage, AttachmentUploadResponse } from './chat';
import { SecretActions } from './secret';
import { ConnectionDetails } from './call';
import { ContactCosts, AssistantContactCreatePayload, ContactType } from './contact';

export type VoiceProvider = 'elevenlabs' | 'cartesia' | 'openai';

export type UserLocalDesktop = 'ubuntu' | 'windows' | 'macos';
export type DesktopMode = 'ubuntu' | 'windows' | 'macos';
export type AssistantHiringSufficientFunds = { sufficient: boolean };

export interface UserDesktop {
  id: number;
  name: string;
  os: string;
  assignedToAssistantId: number | null;
}

// Type for the pre_hire_chat payload
export interface PreHireChatMessage {
  role: 'user' | 'assistant';
  msg: string;
}

// Assistant profile types
export interface Assistant {
  agentId: string;
  userId: string; // ID of the user who created/owns the assistant - used for permission checks
  organizationId: number | null; // Organization ID if org assistant, null for personal - reserved for future use
  userFirstName?: string | null; // Owner's first name
  userLastName?: string | null; // Owner's last name
  userImage?: string | null; // Owner's profile image URL
  firstName: string;
  surname: string;
  profilePhoto: string | null;
  profileVideo: string | null;
  age: number | null;
  nationality: string | null;
  about: string | null;
  phoneCountry: string | null; // Country code for phone number provisioning e.g. "US", "GB"
  timezone: string | null;
  gender?: 'male' | 'female';
  // Voice fields
  voiceId: string | null; // Provider Voice ID
  voiceProvider: VoiceProvider | null;
  // Contact fields (flat — populated from AssistantContact rows by the backend)
  email: string | null;
  phone: string | null;
  assistantWhatsappNumber: string | null;
  assistantDiscordBotId: string | null;
  userPhone: string | null;
  userWhatsappNumber: string | null;
  userDiscordId: string | null;
  // Advanced fields
  isUserDesktop?: boolean;
  desktopMode?: DesktopMode | null;
  desktopUrl?: string | null;
  userDesktopMode?: DesktopMode | null;
  userDesktopUrl?: string | null;
  userDesktopFilesysSync?: boolean | null;
  userDesktopId?: number | null;
  // Contract fields
  weeklyLimit: number | null;
  maxParallel: number | null;
  // Meta fields
  createdAt: string;
  updatedAt: string;
  // Client-side generated signed URL for GCS photos
  signedProfilePhotoUrl?: string;
  signedProfileVideoUrl?: string;
  // Demo fields
  demoId?: string | null;
  // Deployment environment
  deployEnv?: 'preview' | null;
}

export interface AssistantStatus {
  running: boolean;
  jobName: string | null;
}

export type AssistantPreset = Omit<
  Assistant,
  | 'agentId'
  | 'userId'
  | 'organizationId'
  | 'createdAt'
  | 'updatedAt'
  | 'signedProfilePhotoUrl'
  | 'signedProfileVideoUrl'
  | 'email'
  | 'phone'
  | 'userPhone'
  | 'userWhatsappNumber'
  | 'userDiscordId'
  | 'assistantWhatsappNumber'
  | 'assistantDiscordBotId'
  | 'weeklyLimit'
  | 'maxParallel'
  | 'voiceId'
  | 'voiceProvider'
  | 'timezone'
  | 'profileVideo'
  | 'phoneCountry'
> & {
  gender?: 'male' | 'female';
  phoneCountry?: string | null;
  timezone?: string | null;
  profileVideo?: string | null;
  voiceIds: {
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

/**
 * Contact-specific form data for the AssistantContactManager.
 * This is a self-contained form type for managing assistant contact details
 * (email, phone, WhatsApp) independently from the main assistant form.
 */
export interface ContactFormData {
  // Email fields
  email: string | null;
  isEmailAdded: boolean;
  emailManuallyEdited: boolean;

  // Phone fields
  phoneCountry: string;
  isPhoneNumberAdded: boolean;
}

/**
 * Form data for creating/editing assistant profile.
 * Contact fields are managed separately via ContactFormData.
 */
export type AssistantFormData = Omit<
  Assistant,
  | 'agentId'
  | 'userId'
  | 'organizationId'
  | 'createdAt'
  | 'updatedAt'
  | 'signedProfilePhotoUrl'
  | 'signedProfileVideoUrl'
  | 'profilePhoto'
  | 'profileVideo'
  | 'phone'
  | 'assistantWhatsappNumber'
  | 'assistantDiscordBotId'
  | 'userWhatsappNumber'
  | 'userDiscordId'
  | 'userPhone'
  | 'phoneCountry'
  | 'weeklyLimit'
  | 'maxParallel'
  | 'gender'
  | 'voiceId'
  | 'voiceProvider'
  | 'email'
> & {
  // Media fields
  profilePhotoUrl?: string | null; // GCS URL for photo
  profileVideoUrl?: string | null; // GCS URL for video
  photoFile?: File | null;
  videoFile?: File | null;
  photoPreviewUrl?: string | null;
  videoPreviewUrl?: string | null;
  videoSourceVoiceId?: string | null;

  // Voice fields
  timezone?: string | null;
  voiceId?: string;
  voiceName?: string;
  voiceDescription?: string;
  voiceGender?: CartesiaGender;
  voiceLanguage?: SupportedLanguage | 'multi';
  voiceExists?: boolean;
  voiceProvider?: VoiceProvider;

  // Preset fields
  isPresetPristine?: boolean;
  presetOriginalValues?: Pick<
    AssistantFormData,
    'firstName' | 'surname' | 'age' | 'nationality' | 'voiceId' | 'profilePhotoUrl'
  > | null;
  currentPreset?: AssistantPreset | null;

  // Setup fields
  setup?: 'remote' | 'local';
  operatingSystem?: 'ubuntu' | 'windows' | 'macos';

  // UI state fields
  designIncludeBio?: boolean;
};

export interface PhotoUploadResponse {
  gcsUrl: string;
}

export interface PhotoGenerateRequest {
  prompt: string;
  aspectRatio?: string;
  outputFormat?: string;
  outputQuality?: number;
  safetyTolerance?: number;
  promptUpsampling?: boolean;
}

export interface PhotoEditRequest {
  prompt: string;
  inputImage: string;
  aspectRatio?: string;
  outputFormat?: string;
  safetyTolerance?: number;
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
  createdAt: string;
  completedAt?: string;
  urls?: {
    get?: string;
    cancel?: string;
  };
}

export interface AssistantUpdatePayload {
  firstName?: string;
  surname?: string;
  age?: number;
  nationality?: string;
  about?: string | null;
  weeklyLimit?: number | null;
  maxParallel?: number | null;
  userPhone?: string | null;
  phone?: string | null;
  email?: string | null;
  userWhatsappNumber?: string | null;
  voiceId?: string | null;
  voiceProvider?: VoiceProvider | null;
  phoneCountry?: string | null;
  timezone?: string | null;
  profilePhoto?: string | null;
  profileVideo?: string | null;
  userDesktopId?: number | null;
  // Note: isUserDesktop and desktopMode are set at creation time only and cannot be updated
}

// Assistant voice types
export interface Voice {
  voiceId: string;
  name: string;
  description: string;
  gender: Gender;
  language: SupportedLanguage | 'multi';
  provider: 'cartesia' | 'elevenlabs' | 'openai';
  isPreset?: boolean;
}

export type VoiceOption = Voice & {
  isUserVoiceInOrchestra?: boolean;
};

export interface GenerateSpeechPayload {
  text: string;
  provider: 'cartesia' | 'elevenlabs' | 'openai';
  voiceId: string;
  modelId?: string;
  outputFormat: 'mp3' | 'wav' | 'flac' | 'pcm_s16le' | 'pcm_mulaw';
  cartesiaLanguage?: SupportedLanguage;
  cartesiaSampleRate?: number;
  cartesiaBitRate?: number;
  elevenlabsOptimizeStreamingLatency?: number;
  elevenlabsVoiceSettingsSimilarityBoost?: number;
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
  voiceDescription?: string | null;
  bio?: string | null;
  text?: string;
  autoGenerateText?: boolean;
  modelId?: 'eleven_multilingual_ttv_v2' | 'eleven_ttv_v3';
}

export interface VoiceDesignPreviewItem {
  audioBase64: string;
  generatedVoiceId: string;
  mediaType: string;
  durationSecs?: number;
}

export interface VoiceDesignGeneratePreviewsAPIResponse {
  previews: VoiceDesignPreviewItem[];
  text: string;
}

export interface VoiceDesignCreateFromPreviewRequest {
  generatedVoiceId: string;
  voiceName: string;
  voiceDescription: string;
  labels?: { [key: string]: string };
  language?: SupportedLanguage;
  gender?: CartesiaGender | 'other';
  audioBase64?: string | null;
  mediaType?: string | null;
}

export interface AssistantActions {
  assistant: {
    check: (hiringFee: number) => Promise<AssistantHiringSufficientFunds | ResponseProps>;
    create: (
      firstName: string,
      surname: string,
      age: number | null,
      nationality: string | null,
      timezone: string | null,
      profilePhoto: string | null,
      profileVideo: string | null,
      about: string | null,
      voiceId: string | null,
      voiceProvider: VoiceProvider | null,
      isUserDesktop: boolean,
      desktopMode: DesktopMode | null,
      preHireChat?: PreHireChatMessage[]
    ) => Promise<ResponseProps & { assistant?: Assistant }>;
    update: (
      assistantId: string,
      payload: Partial<AssistantUpdatePayload>
    ) => Promise<ResponseProps>;
    delete: (assistantId: string) => Promise<ResponseProps>;
  };
  photo: {
    uploadPhoto: (formData: FormData) => Promise<PhotoUploadResponse | ResponseProps>;
    uploadVideo: (formData: FormData) => Promise<PhotoUploadResponse | ResponseProps>;
    downloadMedia: (filePathOrUrl: string) => Promise<{ signedUrl?: string; detail?: string }>;
    downloadPresetPhoto: (
      firstName: string,
      lastName: string
    ) => Promise<{ signedUrl?: string; gcsUrl?: string; detail?: string }>;
    downloadPresetVideo: (
      firstName: string,
      lastName: string,
      provider: string
    ) => Promise<{ signedUrl?: string; gcsUrl?: string; detail?: string }>;
    generate: (payload: PhotoGenerateRequest) => Promise<PhotoCreationResponse | ResponseProps>;
    edit: (formData: FormData) => Promise<PhotoCreationResponse | ResponseProps>;
    animate: (formData: FormData) => Promise<ReplicatePredictionResponse | ResponseProps>;
    getAnimation: (predictionId: string) => Promise<ReplicatePredictionResponse | ResponseProps>;
    cancelAnimation: (predictionId: string) => Promise<ReplicatePredictionResponse | ResponseProps>;
  };
  voice: {
    register: (
      voiceId: string,
      provider: string,
      name: string,
      description: string,
      gender: CartesiaGender,
      language: SupportedLanguage | 'multi',
      isPreset: boolean
    ) => Promise<(Voice & { info?: string; isPreset?: boolean }) | ResponseProps>;
    delete: (voiceId: string, voiceProvider: string) => Promise<ResponseProps>;
    clone: (
      formData: FormData
    ) => Promise<(Voice & { info?: string; isPreset?: boolean }) | ResponseProps>;
    generate: (
      payload: GenerateSpeechPayload
    ) => Promise<{ audioBase64?: string; contentType?: string; detail?: string; status?: number }>;
    preview: (
      payload: VoiceDesignGeneratePreviewsRequest
    ) => Promise<VoiceDesignGeneratePreviewsAPIResponse | ResponseProps>;
    design: (
      payload: VoiceDesignCreateFromPreviewRequest
    ) => Promise<(Voice & { info?: string; isPreset?: boolean }) | ResponseProps>;
  };
  chat: {
    getContactId: (
      userEmail: string,
      ownerId: string,
      assistantId: string
    ) => Promise<number | null>;
    getTranscripts: (
      contactId: number,
      ownerId: string,
      assistantId: string,
      beforeMessageId?: number
    ) => Promise<ChatMessage[] | ResponseProps>;
    message: (payload: UnifyMessage) => Promise<ResponseProps & { info?: string }>;
    getAssistantOwnerById: (
      userId: string
    ) => Promise<{ firstName: string; lastName: string } | null>;
    /** Upload an attachment and return metadata with gs_url for transcript logging */
    uploadAttachment?: (
      assistantId: string,
      file: File
    ) => Promise<AttachmentUploadResponse | ResponseProps>;
    /** Get a signed URL for a gs:// URL (for displaying historical attachments) */
    getSignedUrl?: (gsUrl: string) => Promise<{ signedUrl: string } | ResponseProps>;
  };
  contact: {
    delete: (
      assistantId: string,
      contactType: ContactType
    ) => Promise<ResponseProps & { assistant?: Assistant }>;
    create: (
      assistantId: string,
      payload: AssistantContactCreatePayload
    ) => Promise<ResponseProps & { assistant?: Assistant }>;
    listAllAssistantEmails: () => Promise<string[] | ResponseProps>;
    listAvailablePhoneCountries: () => Promise<AvailablePhoneCountry[]>;
    listAvailableSocialPlatforms: () => Promise<AvailableSocialPlatform[] | ResponseProps>;
    verifySocialAccount: (
      platform: string,
      accountIdentifier: string
    ) => Promise<{ verificationCode: string; sentAt: string } | ResponseProps>;
    fetchContactCosts: () => Promise<ContactCosts | ResponseProps>;
  };
  secret: SecretActions;
  call: {
    getConnectionDetails: (
      assistantId: string,
      assistantName: string
    ) => Promise<ConnectionDetails | ResponseProps>;
    dispatchToCall: (
      assistantId: string,
      roomName: string,
      deployEnv?: string | null
    ) => Promise<ResponseProps>;
    deleteRoom: (roomName: string) => Promise<ResponseProps>;
  };
  desktop: {
    getLiveviewUrl: (
      assistantId: string,
      ownerId: string,
      organizationId: number | null
    ) => Promise<{ liveviewUrl?: string } | ResponseProps>;
    buildLiveviewUrl: (
      rawUrl: string,
      ownerId: string,
      organizationId: number | null
    ) => Promise<{ liveviewUrl: string }>;
    checkLiveviewHealth: (liveviewUrl: string) => Promise<boolean>;
    sendSystemEvent: (
      assistantId: string,
      eventType: import('@/lib/assistants/desktop').SystemEventType,
      message: string,
      deployEnv?: string | null
    ) => Promise<ResponseProps>;
    listUserDesktops: () => Promise<UserDesktop[] | ResponseProps>;
  };
  spending: {
    setLimit: (
      assistantId: string,
      payload: import('@/types/assistants/spending').SpendingLimitRequest
    ) => Promise<
      (import('@/types/assistants/spending').SpendingLimitResponse & ResponseProps) | ResponseProps
    >;
  };
  /** Actions panel - live action events */
  actions?: import('@/types/assistants/action').AssistantActionActions;
  /** Dashboards pane - dashboard and tile data */
  dashboards?: {
    getMetadata: (
      ownerId: string,
      assistantId: string
    ) => Promise<import('@/types/assistants/dashboard').DashboardPaneData>;
    getTileContent: (
      ownerId: string,
      assistantId: string,
      tileToken: string
    ) => Promise<string | null>;
  };
}
