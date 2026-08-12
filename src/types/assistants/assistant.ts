import { ResponseProps } from '../common';
import type { SharedTeamSummary } from '@/types/teams/sharedTeam';
import { SupportedLanguage, Gender as CartesiaGender, Gender } from '@/types/assistants/cartesia';
import { ChatMessage, UnifyMessage, UnifyMessageReaction, AttachmentUploadResponse } from './chat';
import { SecretActions } from './secret';
import type { SlackInstallActions } from '../slack/install';
import type { MsTeamsBotInstallActions } from '../ms-teams-bot/install';
import { ConnectionDetails } from './call';
import {
  ContactCosts,
  AssistantContactCreatePayload,
  ContactType,
  OAuthProvider,
  GrantedFeaturesResponse,
} from './contact';
import type {
  WorkspaceFileNode,
  WorkspaceFilePolicy,
  WorkspaceFileDecision,
} from './workspace-files';

export type VoiceProvider = 'elevenlabs' | 'cartesia' | 'openai';

export type CallOpeningMode = 'speak' | 'opener' | 'simulated' | 'silent' | 'recorded';

export interface CallOpeningConfig {
  mode: CallOpeningMode;
  /** Exact words spoken verbatim to open the call in `opener` mode. */
  openerText?: string;
  /** Utterance injected as already-spoken context (never voiced) in `simulated` mode. */
  simulatedUtterance?: string;
  /** Name of a Unity-bundled audio asset spoken as a recorded opening turn. */
  recordingAsset?: string;
  /** Transcript paired with a recorded opening; Unity may provide it for bundled assets. */
  transcript?: string;
  source?: string;
}

export interface AssistantCallConnectOptions {
  suppressRinging?: boolean;
  openingConfig?: CallOpeningConfig;
  /** Stable browser-call attempt id used to ignore stale Unity/LiveKit lifecycle events. */
  callSessionId?: string;
  waitForAssistantReady?: boolean;
  startMuted?: boolean;
}

export type UserLocalDesktop = 'ubuntu' | 'windows' | 'macos';
export type DesktopMode = 'ubuntu' | 'windows' | 'macos';
export type ManagedDesktopStatus = 'active' | 'grace_period' | 'disabled';
export type HireOperatingSystem = 'none' | 'ubuntu' | 'windows';
export type AssistantHiringSufficientFunds = { sufficient: boolean };
export type ContactIdentityRoot =
  | {
      targetScope: 'personal';
      targetTeamId: null;
      selfContactId: number;
      bossContactId: number;
    }
  | {
      targetScope: 'team';
      targetTeamId: number;
      selfContactId: number;
      bossContactId: number;
    };

export interface UserDesktop {
  id: number;
  name: string;
  os: string;
  /** Public tunnel URL the desktop app registered (e.g. https://abc123.tunnel.unify.ai). */
  url: string;
  /** Agent IDs of every assistant this desktop is currently linked to. */
  assignedToAssistantIds: number[];
  /**
   * Relay id of this device's raw-TCP SFTP tunnel, reported by the desktop app.
   * The SFTP tunnel is separate from the HTTP tunnel encoded in `url`, so its id
   * is tracked explicitly to deregister it on desktop deletion. Null when the
   * device never registered an SFTP tunnel.
   */
  sftpTunnelId?: string | null;
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
  /**
   * Owning team for team-owned assistants (null = user-owned). A team-owned
   * assistant's entire memory is its owning team's shared root: it has no
   * personal contexts, and `userId` records only the hiring member.
   */
  ownerTeamId?: number | null;
  isCoordinator: boolean;
  /**
   * Coordinator multiplayer mode: the twin has traded its private boss-only
   * surface for a hire-like outward identity (own name/voice/avatar and
   * dedicated contact details). One-way; always false for non-coordinators.
   */
  isMultiplayer?: boolean;
  userFirstName?: string | null; // Owner's first name
  userLastName?: string | null; // Owner's last name
  userImage?: string | null; // Owner's profile image URL
  firstName: string;
  surname: string;
  /**
   * Free-text job title / specialization (e.g. "Growth marketing",
   * "QA engineer"). Surfaced in the UI as a per-assistant subtitle so users
   * can remember at-a-glance what each assistant is for. Distinct from org
   * RBAC roles (`organization.roleName`) and chat-message roles.
   */
  jobTitle: string | null;
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
  // Default LLM fields. The model is a unillm 'model@provider' endpoint paired
  // with a reasoning-effort level; null means the platform default applies.
  defaultModel: string | null;
  defaultReasoningEffort: string | null;
  // ConversationManager slow-brain LLM; null means the platform slow-brain
  // default (independent of defaultModel).
  slowBrainModel: string | null;
  slowBrainReasoningEffort: string | null;
  // Contact fields (flat — populated from AssistantContact rows by the backend)
  email: string | null;
  emailProvider?: string | null;
  // The OAuth-connected workspace provider, derived server-side from the
  // granted-scopes secrets. Distinct from `emailProvider` (the mailbox's own
  // tenant): a Coordinator keeps a platform Google mailbox while connecting a
  // Microsoft workspace. Null when no workspace OAuth grant is present.
  workspaceProvider?: 'google' | 'microsoft' | null;
  emailProvisionedBy?: 'platform' | 'user' | null;
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
  managedDesktopStatus?: ManagedDesktopStatus | null;
  managedDesktopMonthlyCost?: number | null;
  // Per-user desktop link of the *requesting* user (the desktop they linked to
  // this assistant), resolved server-side. Null when this user has not linked
  // a machine.
  userDesktopMode?: DesktopMode | null;
  userDesktopUrl?: string | null;
  userDesktopFilesysSync?: boolean | null;
  // Contract fields
  weeklyLimit: number | null;
  maxParallel: number | null;
  /**
   * Live shared organization teams this assistant can read from and write to.
   * An empty array means the assistant is currently personal-only.
   */
  teamIds: number[];
  /** Human-readable metadata for each shared-brain team membership. */
  teamSummaries: SharedTeamSummary[];
  /**
   * Contact id representing the assistant in its own conversation data.
   */
  selfContactId: number;
  /**
   * Contact id representing the owning user in conversation data.
   */
  bossContactId: number;
  /**
   * Root-local contact ids for every readable root with a resolved identity.
   */
  contactIdentityRoots: ContactIdentityRoot[];
  // Meta fields
  createdAt: string;
  updatedAt: string;
  // Client-side generated signed URL for GCS photos
  signedProfilePhotoUrl?: string;
  signedProfileVideoUrl?: string;
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
  | 'isCoordinator'
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
  | 'teamIds'
  | 'teamSummaries'
  | 'selfContactId'
  | 'bossContactId'
  | 'contactIdentityRoots'
  | 'voiceId'
  | 'voiceProvider'
  | 'defaultModel'
  | 'defaultReasoningEffort'
  | 'slowBrainModel'
  | 'slowBrainReasoningEffort'
  | 'timezone'
  | 'profileVideo'
  | 'phoneCountry'
  | 'jobTitle'
> & {
  gender?: 'male' | 'female';
  phoneCountry?: string | null;
  timezone?: string | null;
  profileVideo?: string | null;
  jobTitle?: string | null;
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
  | 'isCoordinator'
  | 'age'
  | 'nationality'
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
  | 'teamIds'
  | 'teamSummaries'
  | 'selfContactId'
  | 'bossContactId'
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
    'firstName' | 'surname' | 'voiceId' | 'profilePhotoUrl'
  > | null;
  currentPreset?: AssistantPreset | null;

  // Setup fields. Managed Computer Use is optional at hire; users can enable
  // post-hire from the assistant profile.
  setup?: 'remote';
  operatingSystem?: HireOperatingSystem;

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
  jobTitle?: string | null;
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
  defaultModel?: string | null;
  defaultReasoningEffort?: string | null;
  slowBrainModel?: string | null;
  slowBrainReasoningEffort?: string | null;
  phoneCountry?: string | null;
  timezone?: string | null;
  profilePhoto?: string | null;
  profileVideo?: string | null;
  // Note: isUserDesktop and desktopMode are set at creation time only and cannot be updated.
  // User-desktop links are managed via the dedicated desktop link/unlink actions, not here.
}

/**
 * One selectable per-assistant LLM option, served by Orchestra's curated
 * multimodal catalog (GET /api/assistant/default-model-options) or OpenRouter
 * search (GET /api/assistant/default-model-options/search).
 */
export interface DefaultModelOption {
  /** Null means system default (leave the assistant unset). */
  model: string | null;
  reasoningEffort: string | null;
  label: string;
  /** Order-of-magnitude credits estimate for one typical actor task (display-only). */
  approxCreditsPerTask: number | null;
  /** Order-of-magnitude credits estimate for one typical slow-brain message (display-only). */
  approxCreditsPerMessage: number | null;
  /** Artificial Analysis benchmark page for the model. */
  artificialAnalysisUrl: string | null;
  /** True for curated recommendations; false for OpenRouter search hits. */
  recommended?: boolean;
  /** False when the model fails capability policy for this usage. */
  eligible?: boolean;
  /** Why the option is not selectable, when eligible is false. */
  disabledReason?: string | null;
  /** Whether reasoning_effort may be set for this model. */
  supportsReasoning?: boolean | null;
  /** Provider input price per token; set for catalog options with no task anchor. */
  inputCostPerToken?: number | null;
  /** Provider output price per token. */
  outputCostPerToken?: number | null;
  /** Maximum context window in tokens, when the catalog reports it. */
  contextLength?: number | null;
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
      jobTitle: string | null,
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
      preHireChat?: PreHireChatMessage[],
      ownerTeamId?: number | null
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
    generate: (payload: GenerateSpeechPayload) => Promise<{
      audioBase64?: string;
      contentType?: string;
      detail?: string;
      status?: number;
    }>;
    preview: (
      payload: VoiceDesignGeneratePreviewsRequest
    ) => Promise<VoiceDesignGeneratePreviewsAPIResponse | ResponseProps>;
    design: (
      payload: VoiceDesignCreateFromPreviewRequest
    ) => Promise<(Voice & { info?: string; isPreset?: boolean }) | ResponseProps>;
  };
  chat: {
    getContactId: (userEmail: string, assistant: Assistant) => Promise<number | null>;
    getTranscripts: (
      contactId: number,
      assistant: Assistant,
      before?: { beforeId?: number }
    ) => Promise<ChatMessage[] | ResponseProps>;
    message: (payload: UnifyMessage) => Promise<ResponseProps & { info?: string }>;
    reactToMessage: (payload: UnifyMessageReaction) => Promise<ResponseProps & { info?: string }>;
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
    connect: (
      assistantId: string,
      provider: OAuthProvider,
      features: string[],
      redirectAfter?: string
    ) => Promise<{ oauthUrl: string } | ResponseProps>;
    disconnect: (assistantId: string) => Promise<ResponseProps>;
    getGrantedFeatures: (assistantId: string) => Promise<GrantedFeaturesResponse | ResponseProps>;
    listAvailablePhoneCountries: () => Promise<AvailablePhoneCountry[]>;
    listAvailableSocialPlatforms: () => Promise<AvailableSocialPlatform[] | ResponseProps>;
    verifySocialAccount: (
      platform: string,
      accountIdentifier: string
    ) => Promise<{ verificationCode: string; sentAt: string } | ResponseProps>;
    fetchContactCosts: () => Promise<ContactCosts | ResponseProps>;
  };
  workspaceFiles: {
    listRoots: (
      assistantId: string,
      provider: OAuthProvider
    ) => Promise<WorkspaceFileNode[] | ResponseProps>;
    listChildren: (
      assistantId: string,
      provider: OAuthProvider,
      driveId: string,
      itemId: string
    ) => Promise<WorkspaceFileNode[] | ResponseProps>;
    getPolicy: (
      assistantId: string,
      provider: OAuthProvider
    ) => Promise<WorkspaceFilePolicy | ResponseProps>;
    updatePolicy: (
      assistantId: string,
      provider: OAuthProvider,
      defaultAllow: boolean,
      decisions: WorkspaceFileDecision[]
    ) => Promise<WorkspaceFilePolicy | ResponseProps>;
  };
  secret: SecretActions;
  /**
   * Slack workspace install management (owner-scoped). Optional — only
   * bound when Slack OAuth is configured on the deployment. The install
   * is shared across every assistant in the same owner scope, so these
   * actions operate on the workspace install, not a per-assistant row.
   */
  slack?: SlackInstallActions;
  /**
   * Microsoft Teams **bot** install bind handshake (org-scoped).
   * Optional — only bound in an organization context. Distinct from the
   * per-assistant BYOD delegated-Graph "Teams" workspace integration: the
   * bot is a single shared tenant install claimed via a bind nonce, and
   * every assistant in the bound org becomes reachable through it.
   */
  msTeamsBot?: MsTeamsBotInstallActions;
  desktop: {
    getLiveviewUrl: (
      assistantId: string,
      ownerId: string,
      organizationId: number | null,
      sessionScope?: import('@/lib/assistants/desktopSessionScope').DesktopSessionScope | null
    ) => Promise<{ liveviewUrl?: string } | ResponseProps>;
    buildLiveviewUrl: (
      rawUrl: string,
      ownerId: string,
      organizationId: number | null,
      password?: string | null
    ) => Promise<{ liveviewUrl: string }>;
    checkLiveviewHealth: (liveviewUrl: string) => Promise<boolean>;
    wakeAssistantSession: (assistantId: string) => Promise<ResponseProps>;
    sendSystemEvent: (
      assistantId: string,
      eventType: import('@/lib/assistants/desktop').SystemEventType,
      message: string,
      extraEventFields?: Record<string, unknown>
    ) => Promise<ResponseProps>;
    getApiKey: () => Promise<string>;
    listUserDesktops: () => Promise<UserDesktop[] | ResponseProps>;
    linkDesktop: (
      assistantId: string,
      desktopId: number,
      filesysSync?: boolean
    ) => Promise<ResponseProps>;
    unlinkDesktop: (assistantId: string) => Promise<ResponseProps>;
    renameUserDesktop: (desktopId: number, name: string) => Promise<UserDesktop | ResponseProps>;
    deleteUserDesktop: (
      desktopId: number,
      url?: string,
      linkedAssistantIds?: number[],
      sftpTunnelId?: string | null
    ) => Promise<ResponseProps>;
  };
  managedDesktop: {
    enable: (
      assistantId: string | number,
      desktopMode: DesktopMode
    ) => Promise<ResponseProps & { assistant?: Assistant }>;
    disable: (assistantId: string | number) => Promise<ResponseProps & { assistant?: Assistant }>;
    getStatus: (assistantId: string | number) => Promise<
      ResponseProps & {
        info?: {
          desktopMode: DesktopMode | null;
          managedDesktopStatus: 'active' | 'grace_period' | 'disabled' | null;
          monthlyCost: number | null;
        };
      }
    >;
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
      assistant: Assistant
    ) => Promise<import('@/types/assistants/dashboard').DashboardPaneData>;
    getTileContent: (assistant: Assistant, tileToken: string) => Promise<string | null>;
  };
}
