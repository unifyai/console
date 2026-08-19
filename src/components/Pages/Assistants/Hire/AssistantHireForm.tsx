'use client';

import * as React from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Image from 'next/image';
import { UseFormReturn, FormProvider, Controller, useWatch } from 'react-hook-form';
import { Input } from '@/components/UI/input';
import { Textarea } from '@/components/UI/textarea';
import { Label } from '@/components/UI/label';
import {
  AssistantFormData,
  AssistantActions,
  VoiceOption,
  Voice,
} from '@/types/assistants/assistant';
import { VoiceCustomization } from './AssistantHireVoiceCustomization';
import {
  Volume2,
  Laptop,
  Shuffle,
  ChevronLeft,
  ChevronRight,
  BriefcaseBusiness,
  Check,
} from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Checkbox } from '@/components/UI/checkbox';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { useFeatures } from '@/components/Pages/Providers/EnvironmentProvider';
import { InfoSquareButton } from '@/components/UI/info-square-button';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Gender, SupportedLanguage } from '@/types/assistants/cartesia';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/UI/select';
import { PRIMARY_VOICE_PROVIDER } from '@/constants/assistants/settings';
import { getDefaultVoiceForProvider } from '@/utils/assistants/voice-utils';
import { cn } from '@/lib/utils';
import { FaUbuntu, FaWindows } from 'react-icons/fa';
import { generateTimezoneOptions } from '@/utils/assistants/timezone-utils';
import { buildCreatureSentinel, parseCreatureSentinel } from '@/components/Brand';
import { type CreatureAntenna, type CreatureEyes } from '@/components/Brand/TeammateCreature';
import { isGcsPhoto } from '@/utils/assistants/gcs-utils';
import {
  unityAntennaOptions,
  unityBodyOptions,
  unityColorOptions,
  unityOutfitOptions,
  type UnityBody,
  type UnityOutfit,
} from '@/components/Brand/unityAppearance';
import { roleColorVars, type BrandRole } from '@/components/Brand/shapes';
import GoogleIcon from '@/public/icons/google-icon.png';
import MicrosoftIcon from '@/public/icons/microsoft-icon.png';
import type { OAuthProvider } from '@/types/assistants/contact';
import { UnityCallAvatar } from '@/components/Pages/Assistants/Communication/UnityCallAvatar';
import { useUnityAudioElementLipsync } from '@/utils/assistants/unity-lipsync';
import {
  TWIN_CREATURE_APPEARANCE,
  getDroidBodyForm as getUnityBodyForm,
  getRotatingBotViewBox,
} from '@unity/brand/components';

const staticSkillsText = `The bio doesn't influence the teammate's abilities. All teammates come with the same foundational skills and can specialize in whichever area you want them to.`;
const UNIFY_PREVIEW_SIZE = 120;
const UNIFY_PREVIEW_REST_SIZE = 152;
const UNIFY_PREVIEW_REST_SCALE = UNIFY_PREVIEW_REST_SIZE / UNIFY_PREVIEW_SIZE;
const UNIFY_PREVIEW_STAGE_HEIGHT = 192;
const UNIFY_PREVIEW_SCALE_BODY = 'standard' satisfies UnityBody;
const UNIFY_PREVIEW_LAYOUT_ANTENNA = 'bigball' satisfies CreatureAntenna;
const UNIFY_PREVIEW_ANTENNA_CONTROL_REFERENCE = 'ball' satisfies CreatureAntenna;
const UNIFY_PREVIEW_OUTFIT_REGION_RATIO = 0.66;
const UNIFY_PREVIEW_BODY_CONTROL_TOP = 72;
const APPEARANCE_HOVER_CONTROL_CLASS = 'transition-opacity duration-150';
const UNIFY_PREVIEW_LAYOUT_TRANSITION_CLASS = 'transition-all duration-300 ease-out';
const COLOR_SWATCH_TRANSITION = { type: 'spring', stiffness: 720, damping: 42, mass: 0.65 };

const appearanceAntennaOptions = unityAntennaOptions;
const appearanceBodyOptions = unityBodyOptions;
const appearanceColorOptions = unityColorOptions;
const appearanceOutfitOptions = unityOutfitOptions;
const DEFAULT_COORDINATOR_APPEARANCE = {
  eyes: 'up',
  antenna: TWIN_CREATURE_APPEARANCE.antenna,
  body: 'standard',
  color: 'green',
  outfit: 'none',
} as const satisfies {
  eyes: CreatureEyes;
  antenna: CreatureAntenna;
  body: UnityBody;
  color: BrandRole;
  outfit: UnityOutfit;
};

function cycleOption<T>(items: readonly T[], current: T, direction: -1 | 1): T {
  const currentIndex = items.indexOf(current);
  const nextIndex = (currentIndex + direction + items.length) % items.length;
  return items[nextIndex];
}

function pickOption<T>(items: readonly T[], current: T): T {
  if (items.length === 1) return current;

  let next = current;
  while (next === current) {
    next = items[Math.floor(Math.random() * items.length)];
  }
  return next;
}

function clampPreviewControlTop(top: number): number {
  return Math.max(0, Math.min(UNIFY_PREVIEW_STAGE_HEIGHT - 32, top));
}

function getUnityPreviewScale(): number {
  const referenceViewBox = getRotatingBotViewBox(
    getUnityBodyForm(UNIFY_PREVIEW_SCALE_BODY),
    undefined,
    undefined,
    undefined,
    UNIFY_PREVIEW_LAYOUT_ANTENNA
  );
  return UNIFY_PREVIEW_SIZE / referenceViewBox.w;
}

function SectionIconSlot({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">{children}</span>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 flex items-center gap-2 text-muted-foreground">{children}</div>;
}

function AppearanceControlTooltip({
  label,
  side = 'top',
  children,
}: {
  label: string;
  side?: 'top' | 'right' | 'bottom' | 'left';
  children: React.ReactElement<React.ComponentProps<typeof Button>>;
}) {
  const { className, style } = children.props;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className={cn('inline-flex', className)} style={style}>
            {React.cloneElement(children, {
              className: 'h-8 w-8 bg-transparent hover:bg-transparent',
              style: undefined,
            })}
          </span>
        </TooltipTrigger>
        <TooltipContent side={side} className="text-caption">
          <p>{label}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function HireUnityAvatar({
  isVoicePreviewPlaying,
  previewAudioElement,
  antenna,
  body,
  color,
  baseEyes,
  outfit,
  label,
}: {
  isVoicePreviewPlaying: boolean;
  previewAudioElement: HTMLAudioElement | null;
  antenna: CreatureAntenna;
  body: UnityBody;
  color: BrandRole;
  baseEyes: CreatureEyes;
  outfit: UnityOutfit;
  label: string;
}) {
  const voicePreviewLipsyncFrame = useUnityAudioElementLipsync(previewAudioElement, {
    enabled: isVoicePreviewPlaying && !!previewAudioElement,
  });

  const form = getUnityBodyForm(body);
  const layoutViewBox = getRotatingBotViewBox(
    form,
    undefined,
    undefined,
    undefined,
    UNIFY_PREVIEW_LAYOUT_ANTENNA
  );
  const selectedViewBox = getRotatingBotViewBox(form, undefined, undefined, undefined, antenna);
  const scale = getUnityPreviewScale();

  return (
    <span className="relative block h-full w-full overflow-visible">
      <span
        className="absolute left-1/2 top-1/2 block"
        style={{
          width: `${layoutViewBox.w * scale}px`,
          height: `${layoutViewBox.h * scale}px`,
          transform: 'translate(-50%, -50%)',
        }}
      >
        <span
          className="absolute block"
          style={{
            left: `${(selectedViewBox.minX - layoutViewBox.minX) * scale}px`,
            top: `${(selectedViewBox.minY - layoutViewBox.minY) * scale}px`,
            width: `${selectedViewBox.w * scale}px`,
          }}
        >
          <UnityCallAvatar
            isSpeaking={voicePreviewLipsyncFrame.isActive}
            mouthShape={voicePreviewLipsyncFrame.mouthShape}
            speechLevel={voicePreviewLipsyncFrame.speechLevel}
            antenna={antenna}
            body={body}
            color={color}
            baseEyes={baseEyes}
            outfit={outfit}
            label={label}
            className="block h-auto w-full transform-gpu"
            creatureClassName="block h-auto w-full"
          />
        </span>
      </span>
    </span>
  );
}

export interface HireFormProps {
  formMethods: UseFormReturn<AssistantFormData>;
  onSubmit?: (e?: React.BaseSyntheticEvent) => Promise<void>;
  isSubmitting: boolean;
  assistantActions: AssistantActions;
  onPhotoProcessingStateChange?: (isProcessing: boolean) => void;
  onVoiceProcessingStateChange?: (isProcessing: boolean) => void;
  onNewMediaReady: (file: File | null, mediaType: 'photo' | 'video') => void;
  allDisplayableVoices: VoiceOption[];
  isLoadingUserVoices: boolean;
  fetchUserVoices: () => void;
  handleDeleteVoice: (voice: VoiceOption) => Promise<void>;
  mode?: 'hire' | 'edit';
  /** Callback to open the Stripe side panel for payment setup */
  onAddPaymentMethod?: () => void;
  /** Whether the user has explicitly selected/changed a preset (not the initial auto-select) */
  userHasChangedPreset?: boolean;
  onRandomizeProfile?: () => void;
  /** Hands the combined profile+appearance randomizer up to the dialog header. */
  onRegisterRandomize?: (randomize: () => void) => void;
  workspaceProvider?: OAuthProvider | null;
  onWorkspaceProviderSelect?: (provider: OAuthProvider) => void;
  skipWorkspaceSetup?: boolean;
  onSkipWorkspaceSetupChange?: (skip: boolean) => void;
  showWorkspaceWarning?: boolean;
  lockIdentityFields?: boolean;
  lockAppearanceControls?: boolean;
  /**
   * Teams offered as the owning team (team-first hiring). When present, the
   * selector defaults to a team and "Personal" is the explicit opt-out.
   */
  hireTeams?: Array<{ teamId: number; name: string }>;
}

export function HireForm({
  formMethods,
  onSubmit,
  isSubmitting,
  assistantActions,
  onVoiceProcessingStateChange,
  allDisplayableVoices,
  isLoadingUserVoices,
  fetchUserVoices,
  handleDeleteVoice,
  mode = 'hire',
  onAddPaymentMethod,
  onRandomizeProfile,
  onRegisterRandomize,
  workspaceProvider,
  onWorkspaceProviderSelect,
  skipWorkspaceSetup = false,
  onSkipWorkspaceSetupChange,
  showWorkspaceWarning = false,
  lockIdentityFields = false,
  lockAppearanceControls = false,
  userHasChangedPreset = false,
  hireTeams = [],
}: HireFormProps) {
  const {
    register,
    formState: { errors },
    setValue,
    getValues,
    trigger,
    control,
  } = formMethods;

  // Workspace connect needs an OAuth client configured on the deployment. Mirror
  // the workspace manager: keep each provider visible but disabled with an
  // explanatory tooltip when its client isn't configured.
  const { workspaceGoogle, workspaceMicrosoft } = useFeatures();
  const workspaceConnectAvailable = workspaceGoogle || workspaceMicrosoft;
  const workspaceUnavailableReason = "isn't configured on this deployment";

  const [voiceCustomizationTab, setVoiceCustomizationTab] = React.useState<
    'select' | 'clone' | 'design'
  >('select');
  const [unityAntenna, setUnityAntenna] = React.useState<CreatureAntenna>('ball');
  const [unityBody, setUnityBody] = React.useState<UnityBody>('standard');
  const [unityColor, setUnityColor] = React.useState<BrandRole>('green');
  const [unityOutfit, setUnityOutfit] = React.useState<UnityOutfit>('none');

  // The avatar shown in this form is the live creature. We persist it by keeping
  // `profilePhotoUrl` in sync with an `appearance://` sentinel, since hiring/edit
  // are submitted by external dialog buttons (not this form's onSubmit) so we
  // can't hook submission — the form data must already carry the sentinel.
  const watchedProfilePhotoUrl = useWatch({ control, name: 'profilePhotoUrl' });
  const watchedPhotoFile = useWatch({ control, name: 'photoFile' });
  const watchedPhotoPreviewUrl = useWatch({ control, name: 'photoPreviewUrl' });
  const watchedProfileVideoUrl = useWatch({ control, name: 'profileVideoUrl' });

  // Seed the appearance controls once from an existing sentinel (edit), so the
  // form shows the saved look instead of resetting to the default creature, then
  // mark seeding complete so the live-sync below can write back. The edit form is
  // reset synchronously before this mounts, so the saved value is already present
  // on first render (and may legitimately be null/GCS — we don't wait for it).
  const [appearanceSeeded, setAppearanceSeeded] = React.useState(false);
  React.useEffect(() => {
    if (appearanceSeeded) return;
    const parsed = parseCreatureSentinel(watchedProfilePhotoUrl);
    if (parsed) {
      setUnityBody(parsed.body);
      setUnityColor(parsed.color);
      setUnityAntenna(parsed.antenna);
      setUnityOutfit(parsed.outfit);
    }
    setAppearanceSeeded(true);
  }, [appearanceSeeded, watchedProfilePhotoUrl]);
  const [isAppearanceControlsVisible, setIsAppearanceControlsVisible] = React.useState(false);
  const [isVoicePreviewPlaying, setIsVoicePreviewPlaying] = React.useState(false);
  const [previewAudioElement, setPreviewAudioElement] = React.useState<HTMLAudioElement | null>(
    null
  );
  const playSelectedVoicePreviewRef = React.useRef<(() => void) | null>(null);
  const setup = useWatch({ control, name: 'setup' });
  const firstName = useWatch({ control, name: 'firstName' });
  const timezoneOptions = React.useMemo(() => generateTimezoneOptions(), []);
  const defaultVoice = React.useMemo(() => getDefaultVoiceForProvider(), []);
  const selectedUnityEyes = DEFAULT_COORDINATOR_APPEARANCE.eyes;
  const selectedUnityAntenna = lockAppearanceControls
    ? DEFAULT_COORDINATOR_APPEARANCE.antenna
    : unityAntenna;
  const selectedUnityBody = lockAppearanceControls
    ? DEFAULT_COORDINATOR_APPEARANCE.body
    : unityBody;
  const selectedUnityColor = lockAppearanceControls
    ? DEFAULT_COORDINATOR_APPEARANCE.color
    : unityColor;
  const selectedUnityOutfit = lockAppearanceControls
    ? DEFAULT_COORDINATOR_APPEARANCE.outfit
    : unityOutfit;
  const appearanceControlVisibilityClass = isAppearanceControlsVisible
    ? 'pointer-events-auto opacity-100'
    : 'pointer-events-none opacity-0';
  const isAppearanceEditing = !lockAppearanceControls && isAppearanceControlsVisible;
  const unityPreviewScale = isAppearanceEditing ? 1 : UNIFY_PREVIEW_REST_SCALE;

  // Persist the live creature as the avatar by syncing it into `profilePhotoUrl`
  // as an `appearance://` sentinel. We defer to a real image only when the user
  // uploaded one or explicitly picked a preset persona's photo. This keeps the
  // saved value current regardless of how the dialog triggers submission.
  const creatureSentinel = buildCreatureSentinel({
    body: selectedUnityBody,
    color: selectedUnityColor,
    eyes: selectedUnityEyes,
    antenna: selectedUnityAntenna,
    outfit: selectedUnityOutfit,
  });

  // Detect when the user actively changes the appearance controls (vs. the value
  // we seeded). This lets an edit replace an existing real photo with a creature
  // — otherwise editing the appearance of a photo-backed assistant is a no-op.
  const appearanceBaselineRef = React.useRef<string | null>(null);
  const [userEditedAppearance, setUserEditedAppearance] = React.useState(false);
  React.useEffect(() => {
    if (!appearanceSeeded) return;
    if (appearanceBaselineRef.current === null) {
      appearanceBaselineRef.current = creatureSentinel;
      return;
    }
    if (!userEditedAppearance && creatureSentinel !== appearanceBaselineRef.current) {
      setUserEditedAppearance(true);
    }
  }, [appearanceSeeded, creatureSentinel, userEditedAppearance]);

  const creatureIsAvatar =
    !lockAppearanceControls &&
    !watchedPhotoFile &&
    !userHasChangedPreset &&
    (mode === 'hire' ||
      !isGcsPhoto(watchedProfilePhotoUrl) ||
      parseCreatureSentinel(watchedProfilePhotoUrl) !== null ||
      userEditedAppearance);
  React.useEffect(() => {
    if (!appearanceSeeded || !creatureIsAvatar) return;
    if (watchedProfilePhotoUrl !== creatureSentinel) {
      setValue('profilePhotoUrl', creatureSentinel, { shouldDirty: true });
    }
    // The creature is self-contained — drop any preset-seeded preview/video so we
    // don't persist a mismatched image/clip alongside the sentinel.
    if (watchedPhotoPreviewUrl) setValue('photoPreviewUrl', null);
    if (watchedProfileVideoUrl) setValue('profileVideoUrl', null);
  }, [
    appearanceSeeded,
    creatureIsAvatar,
    creatureSentinel,
    watchedProfilePhotoUrl,
    watchedPhotoPreviewUrl,
    watchedProfileVideoUrl,
    setValue,
  ]);

  const colorIndex = appearanceColorOptions.indexOf(selectedUnityColor);
  const previousColor =
    appearanceColorOptions[
      (colorIndex - 1 + appearanceColorOptions.length) % appearanceColorOptions.length
    ];
  const nextColor = appearanceColorOptions[(colorIndex + 1) % appearanceColorOptions.length];
  const outfitIndex = appearanceOutfitOptions.indexOf(selectedUnityOutfit);
  const previousOutfit =
    appearanceOutfitOptions[
      (outfitIndex - 1 + appearanceOutfitOptions.length) % appearanceOutfitOptions.length
    ];
  const nextOutfit = appearanceOutfitOptions[(outfitIndex + 1) % appearanceOutfitOptions.length];
  const workspaceAssistantName =
    typeof firstName === 'string' && firstName.trim().length > 0
      ? firstName.trim()
      : 'this teammate';
  const isWorkspaceWarning = mode === 'hire' && showWorkspaceWarning;
  const unityControlTop = React.useMemo(() => {
    const form = getUnityBodyForm(selectedUnityBody);
    const layoutViewBox = getRotatingBotViewBox(
      form,
      undefined,
      undefined,
      undefined,
      UNIFY_PREVIEW_LAYOUT_ANTENNA
    );
    const antennaControlViewBox = getRotatingBotViewBox(
      form,
      undefined,
      undefined,
      undefined,
      UNIFY_PREVIEW_ANTENNA_CONTROL_REFERENCE
    );
    const bodyViewBox = getRotatingBotViewBox(form, undefined, undefined, undefined, 'none');
    const scale = getUnityPreviewScale();
    const layoutTop = (UNIFY_PREVIEW_STAGE_HEIGHT - layoutViewBox.h * scale) / 2;
    const bodyTop = layoutTop + (bodyViewBox.minY - layoutViewBox.minY) * scale;
    const antennaControlTop = layoutTop + (antennaControlViewBox.minY - layoutViewBox.minY) * scale;

    return {
      antenna: clampPreviewControlTop(antennaControlTop + 18),
      body: UNIFY_PREVIEW_BODY_CONTROL_TOP,
      outfit: clampPreviewControlTop(
        bodyTop + bodyViewBox.h * scale * UNIFY_PREVIEW_OUTFIT_REGION_RATIO - 16
      ),
    };
  }, [selectedUnityBody]);

  const randomizeUnityAppearance = React.useCallback(() => {
    if (lockAppearanceControls) return;

    setUnityAntenna((current) => pickOption(appearanceAntennaOptions, current));
    setUnityBody((current) => pickOption(appearanceBodyOptions, current));
    setUnityColor((current) => pickOption(appearanceColorOptions, current));
    setUnityOutfit((current) => pickOption(appearanceOutfitOptions, current));
  }, [lockAppearanceControls]);

  const randomizeProfileAndAppearance = React.useCallback(() => {
    onRandomizeProfile?.();
    randomizeUnityAppearance();
  }, [onRandomizeProfile, randomizeUnityAppearance]);

  // Surface the combined randomizer so the dialog header's Randomize control can
  // drive both the profile fields and the live appearance from outside the form.
  React.useEffect(() => {
    onRegisterRandomize?.(randomizeProfileAndAppearance);
  }, [onRegisterRandomize, randomizeProfileAndAppearance]);

  const handlePlaySelectedVoicePreviewChange = React.useCallback(
    (playPreviewForSelectedVoice: (() => void) | null) => {
      playSelectedVoicePreviewRef.current = playPreviewForSelectedVoice;
    },
    []
  );
  const playSelectedVoicePreview = React.useCallback(() => {
    playSelectedVoicePreviewRef.current?.();
  }, []);

  React.useEffect(() => {
    const isPristine = getValues('isPresetPristine');
    const currentPreset = getValues('currentPreset');

    if (!isPristine || !currentPreset) return;

    // Update voice fields
    setValue('voiceId', defaultVoice.voiceId);
    setValue('voiceName', defaultVoice.name);
    setValue('voiceDescription', defaultVoice.description);
    setValue('voiceLanguage', defaultVoice.language as SupportedLanguage);
    setValue('voiceGender', defaultVoice.gender as Gender);
    setValue('voiceProvider', defaultVoice.provider || PRIMARY_VOICE_PROVIDER);

    const userHasVoice = allDisplayableVoices.some(
      (v) =>
        v.voiceId === defaultVoice.voiceId &&
        v.provider === (defaultVoice.provider || PRIMARY_VOICE_PROVIDER) &&
        v.isUserVoiceInOrchestra
    );
    setValue('voiceExists', userHasVoice, { shouldValidate: true });
  }, [getValues, setValue, allDisplayableVoices, defaultVoice]);

  return (
    <FormProvider {...formMethods}>
      <form onSubmit={onSubmit} className="flex h-full flex-col space-y-6">
        <ScrollArea className="min-h-0 flex-1">
          <fieldset
            disabled={isSubmitting}
            className="brand-page-stencil-bg group overflow-hidden rounded-lg px-4 py-2"
          >
            <div>
              <section className="min-w-0">
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="firstName">First Name</Label>

                    <div className="grid gap-5 md:grid-cols-2 md:items-stretch">
                      <div className="space-y-3">
                        <div className="space-y-1.5">
                          <Input
                            id="firstName"
                            readOnly={lockIdentityFields}
                            aria-readonly={lockIdentityFields}
                            tabIndex={lockIdentityFields ? -1 : undefined}
                            title={lockIdentityFields ? "T-W1N's name is fixed" : undefined}
                            className={cn(
                              lockIdentityFields &&
                                'cursor-not-allowed border-muted bg-muted text-muted-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0'
                            )}
                            {...register('firstName', {
                              required: 'First name is required',
                              setValueAs: (v) => String(v ?? '').trim(),
                            })}
                          />
                          {errors.firstName && (
                            <p className="text-body text-strong text-destructive">
                              {errors.firstName.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <Label htmlFor="surname">Last Name</Label>
                          <Input
                            id="surname"
                            readOnly={lockIdentityFields}
                            aria-readonly={lockIdentityFields}
                            tabIndex={lockIdentityFields ? -1 : undefined}
                            title={lockIdentityFields ? "T-W1N's name is fixed" : undefined}
                            className={cn(
                              lockIdentityFields &&
                                'cursor-not-allowed border-muted bg-muted text-muted-foreground shadow-none focus-visible:ring-0 focus-visible:ring-offset-0'
                            )}
                            {...register('surname', {
                              setValueAs: (v) => String(v ?? '').trim(),
                            })}
                          />
                          {errors.surname && (
                            <p className="text-body text-strong text-destructive">
                              {errors.surname.message}
                            </p>
                          )}
                        </div>

                        <div className="space-y-1.5">
                          <div className="flex flex-row items-center gap-2">
                            <Label htmlFor="jobTitle">Role</Label>
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <InfoSquareButton />
                                </TooltipTrigger>
                                <TooltipContent
                                  side="right"
                                  align="end"
                                  className="text-caption max-w-xs"
                                >
                                  <p>
                                    Optional short label to remember what this teammate is for (e.g.
                                    &quot;Growth marketing&quot;, &quot;QA engineer&quot;). Shown in
                                    the teammates list hover card.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                          <Input
                            id="jobTitle"
                            placeholder="e.g. Growth marketing"
                            maxLength={120}
                            {...register('jobTitle', {
                              maxLength: {
                                value: 120,
                                message: 'Role must be 120 characters or less',
                              },
                              setValueAs: (v) => {
                                if (v === undefined || v === null) return null;
                                const trimmed = String(v).trim();
                                return trimmed.length > 0 ? trimmed : null;
                              },
                            })}
                          />
                          {errors.jobTitle && (
                            <p className="text-body text-strong text-destructive">
                              {errors.jobTitle.message}
                            </p>
                          )}
                        </div>

                        {mode === 'hire' && hireTeams.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="flex flex-row items-center gap-2">
                              <Label htmlFor="ownerTeamId">Owning team</Label>
                              <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <InfoSquareButton />
                                  </TooltipTrigger>
                                  <TooltipContent
                                    side="right"
                                    align="end"
                                    className="text-caption max-w-xs"
                                  >
                                    <p>
                                      A team-owned teammate belongs to the whole team: everyone can
                                      work with it and everything it learns is shared with the team.
                                      Choose Personal only if this teammate should report to you
                                      alone.
                                    </p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            </div>
                            <Controller
                              name="ownerTeamId"
                              control={control}
                              render={({ field }) => (
                                <Select
                                  value={field.value != null ? String(field.value) : 'personal'}
                                  onValueChange={(value) =>
                                    field.onChange(value === 'personal' ? null : Number(value))
                                  }
                                  disabled={isSubmitting}
                                >
                                  <SelectTrigger
                                    id="ownerTeamId"
                                    className="bg-card"
                                    data-testid="hire-owner-team-select"
                                  >
                                    <SelectValue placeholder="Select an owning team..." />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {hireTeams.map((team) => (
                                      <SelectItem key={team.teamId} value={String(team.teamId)}>
                                        {team.name}
                                      </SelectItem>
                                    ))}
                                    <SelectItem value="personal">Personal (only you)</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            />
                          </div>
                        )}

                        <div className="space-y-1.5">
                          <Label htmlFor="timezone">Timezone</Label>
                          <Controller
                            name="timezone"
                            control={control}
                            rules={{ required: 'Timezone is required.' }}
                            render={({ field }) => (
                              <Select
                                value={field.value || ''}
                                onValueChange={field.onChange}
                                disabled={isSubmitting}
                              >
                                <SelectTrigger id="timezone" className="bg-card">
                                  <SelectValue placeholder="Select a timezone..." />
                                </SelectTrigger>
                                <SelectContent>
                                  {timezoneOptions.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                      {option.label}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            )}
                          />
                          {errors.timezone && (
                            <p className="text-body text-strong text-destructive">
                              {errors.timezone.message}
                            </p>
                          )}
                        </div>
                      </div>

                      <div
                        className="flex min-h-64 w-full flex-col items-center justify-center rounded-lg border border-border bg-card p-4 sm:min-h-72 md:min-h-0"
                        onMouseEnter={() =>
                          !lockAppearanceControls && setIsAppearanceControlsVisible(true)
                        }
                        onMouseLeave={() => setIsAppearanceControlsVisible(false)}
                      >
                        <div
                          className={cn(
                            'flex h-full w-full flex-col items-center justify-center',
                            UNIFY_PREVIEW_LAYOUT_TRANSITION_CLASS,
                            isAppearanceEditing ? 'gap-3' : 'gap-0'
                          )}
                        >
                          <div
                            className={cn(
                              'relative flex max-w-full items-center justify-center overflow-visible',
                              UNIFY_PREVIEW_LAYOUT_TRANSITION_CLASS,
                              isAppearanceEditing ? 'h-48 w-64' : 'h-60 w-full'
                            )}
                          >
                            {!lockAppearanceControls && (
                              <>
                                <AppearanceControlTooltip label="Antenna" side="left">
                                  <Button
                                    aria-label="Previous antenna style"
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      'absolute left-0 z-20 h-8 w-8 bg-transparent hover:bg-transparent md:left-4',
                                      APPEARANCE_HOVER_CONTROL_CLASS,
                                      appearanceControlVisibilityClass
                                    )}
                                    disabled={isSubmitting}
                                    onClick={() =>
                                      setUnityAntenna((current) =>
                                        cycleOption(appearanceAntennaOptions, current, -1)
                                      )
                                    }
                                    style={{ top: unityControlTop.antenna }}
                                  >
                                    <ChevronLeft className="!h-6 !w-6" />
                                  </Button>
                                </AppearanceControlTooltip>
                                <AppearanceControlTooltip label="Antenna" side="right">
                                  <Button
                                    aria-label="Next antenna style"
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      'absolute right-0 z-20 h-8 w-8 bg-transparent hover:bg-transparent md:right-4',
                                      APPEARANCE_HOVER_CONTROL_CLASS,
                                      appearanceControlVisibilityClass
                                    )}
                                    disabled={isSubmitting}
                                    onClick={() =>
                                      setUnityAntenna((current) =>
                                        cycleOption(appearanceAntennaOptions, current, 1)
                                      )
                                    }
                                    style={{ top: unityControlTop.antenna }}
                                  >
                                    <ChevronRight className="!h-6 !w-6" />
                                  </Button>
                                </AppearanceControlTooltip>

                                <AppearanceControlTooltip label="Outfit" side="left">
                                  <Button
                                    aria-label="Previous teammate outfit"
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      'absolute left-0 z-20 h-8 w-8 bg-transparent hover:bg-transparent md:left-4',
                                      APPEARANCE_HOVER_CONTROL_CLASS,
                                      appearanceControlVisibilityClass
                                    )}
                                    disabled={isSubmitting}
                                    onClick={() =>
                                      setUnityOutfit((current) =>
                                        cycleOption(appearanceOutfitOptions, current, -1)
                                      )
                                    }
                                    style={{ top: unityControlTop.outfit }}
                                  >
                                    <ChevronLeft className="!h-6 !w-6" />
                                  </Button>
                                </AppearanceControlTooltip>
                                <AppearanceControlTooltip label="Outfit" side="right">
                                  <Button
                                    aria-label="Next teammate outfit"
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      'absolute right-0 z-20 h-8 w-8 bg-transparent hover:bg-transparent md:right-4',
                                      APPEARANCE_HOVER_CONTROL_CLASS,
                                      appearanceControlVisibilityClass
                                    )}
                                    disabled={isSubmitting}
                                    onClick={() =>
                                      setUnityOutfit((current) =>
                                        cycleOption(appearanceOutfitOptions, current, 1)
                                      )
                                    }
                                    style={{ top: unityControlTop.outfit }}
                                  >
                                    <ChevronRight className="!h-6 !w-6" />
                                  </Button>
                                </AppearanceControlTooltip>

                                <AppearanceControlTooltip label="Body" side="left">
                                  <Button
                                    aria-label="Previous body shape"
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      'absolute left-0 z-20 h-8 w-8 bg-transparent hover:bg-transparent md:left-4',
                                      APPEARANCE_HOVER_CONTROL_CLASS,
                                      appearanceControlVisibilityClass
                                    )}
                                    disabled={isSubmitting}
                                    onClick={() =>
                                      setUnityBody((current) =>
                                        cycleOption(appearanceBodyOptions, current, -1)
                                      )
                                    }
                                    style={{ top: unityControlTop.body }}
                                  >
                                    <ChevronLeft className="!h-6 !w-6" />
                                  </Button>
                                </AppearanceControlTooltip>
                                <AppearanceControlTooltip label="Body" side="right">
                                  <Button
                                    aria-label="Next body shape"
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={cn(
                                      'absolute right-0 z-20 h-8 w-8 bg-transparent hover:bg-transparent md:right-4',
                                      APPEARANCE_HOVER_CONTROL_CLASS,
                                      appearanceControlVisibilityClass
                                    )}
                                    disabled={isSubmitting}
                                    onClick={() =>
                                      setUnityBody((current) =>
                                        cycleOption(appearanceBodyOptions, current, 1)
                                      )
                                    }
                                    style={{ top: unityControlTop.body }}
                                  >
                                    <ChevronRight className="!h-6 !w-6" />
                                  </Button>
                                </AppearanceControlTooltip>
                              </>
                            )}

                            {lockAppearanceControls ? (
                              <button
                                aria-label="Preview selected voice"
                                className="relative z-0 flex h-full w-40 items-center justify-center bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring sm:w-52 md:w-40"
                                disabled={isSubmitting}
                                onClick={playSelectedVoicePreview}
                                type="button"
                              >
                                <span
                                  className="block h-full w-full transition-transform duration-300 ease-out"
                                  style={{ transform: `scale(${UNIFY_PREVIEW_REST_SCALE})` }}
                                >
                                  <HireUnityAvatar
                                    isVoicePreviewPlaying={isVoicePreviewPlaying}
                                    previewAudioElement={previewAudioElement}
                                    antenna={selectedUnityAntenna}
                                    body={selectedUnityBody}
                                    color={selectedUnityColor}
                                    baseEyes={selectedUnityEyes}
                                    outfit={selectedUnityOutfit}
                                    label="T-W1N avatar"
                                  />
                                </span>
                              </button>
                            ) : (
                              <button
                                aria-label="Preview selected voice"
                                className={cn(
                                  'relative z-0 flex h-full items-center justify-center bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                  UNIFY_PREVIEW_LAYOUT_TRANSITION_CLASS,
                                  isAppearanceEditing ? 'w-40 sm:w-52 md:w-40' : 'w-56 sm:w-64'
                                )}
                                disabled={isSubmitting}
                                onClick={playSelectedVoicePreview}
                                type="button"
                              >
                                <span
                                  className="block h-full w-full transition-transform duration-300 ease-out"
                                  style={{ transform: `scale(${unityPreviewScale})` }}
                                >
                                  <HireUnityAvatar
                                    isVoicePreviewPlaying={isVoicePreviewPlaying}
                                    previewAudioElement={previewAudioElement}
                                    antenna={selectedUnityAntenna}
                                    body={selectedUnityBody}
                                    color={selectedUnityColor}
                                    baseEyes={selectedUnityEyes}
                                    outfit={selectedUnityOutfit}
                                    label="Digital twin avatar"
                                  />
                                </span>
                              </button>
                            )}
                          </div>

                          {!lockAppearanceControls && (
                            <div
                              className={cn(
                                'flex flex-col items-center gap-1 overflow-hidden transition-all duration-300 ease-out',
                                isAppearanceEditing
                                  ? 'pointer-events-auto max-h-24 translate-y-0 opacity-100'
                                  : 'pointer-events-none max-h-0 -translate-y-1 opacity-0'
                              )}
                            >
                              <div className="flex items-center gap-2">
                                <AppearanceControlTooltip label="Color" side="left">
                                  <Button
                                    aria-label="Previous teammate color"
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 bg-transparent hover:bg-transparent"
                                    disabled={isSubmitting}
                                    onClick={() =>
                                      setUnityColor((current) =>
                                        cycleOption(appearanceColorOptions, current, -1)
                                      )
                                    }
                                  >
                                    <ChevronLeft className="!h-6 !w-6" />
                                  </Button>
                                </AppearanceControlTooltip>
                                <div
                                  aria-label="Teammate color"
                                  className="flex items-center gap-1.5 px-1 py-1"
                                  role="group"
                                >
                                  <AnimatePresence initial={false} mode="popLayout">
                                    {[previousColor, selectedUnityColor, nextColor].map(
                                      (color, index) => {
                                        const isSelected = color === selectedUnityColor;
                                        // Clicking a side swatch rotates the wheel by one step
                                        // in that direction, exactly like the matching arrow.
                                        const direction = index === 0 ? -1 : 1;
                                        return (
                                          <motion.button
                                            aria-current={isSelected ? 'true' : undefined}
                                            aria-label={
                                              isSelected
                                                ? `Current teammate color: ${color}`
                                                : `Select ${color}`
                                            }
                                            className={cn(
                                              'rounded-control block border border-border p-0',
                                              isSelected
                                                ? 'h-5 w-5 cursor-default'
                                                : 'h-3.5 w-3.5 cursor-pointer opacity-65'
                                            )}
                                            disabled={isSubmitting || isSelected}
                                            exit={{ opacity: 0, scale: 0.8 }}
                                            initial={{ opacity: 0, scale: 0.8 }}
                                            animate={{
                                              opacity: isSelected ? 1 : 0.65,
                                              scale: 1,
                                            }}
                                            key={color}
                                            layout
                                            onClick={
                                              isSelected
                                                ? undefined
                                                : () =>
                                                    setUnityColor((current) =>
                                                      cycleOption(
                                                        appearanceColorOptions,
                                                        current,
                                                        direction
                                                      )
                                                    )
                                            }
                                            style={{ backgroundColor: roleColorVars[color] }}
                                            transition={COLOR_SWATCH_TRANSITION}
                                            type="button"
                                          />
                                        );
                                      }
                                    )}
                                  </AnimatePresence>
                                </div>
                                <AppearanceControlTooltip label="Color" side="right">
                                  <Button
                                    aria-label="Next teammate color"
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 bg-transparent hover:bg-transparent"
                                    disabled={isSubmitting}
                                    onClick={() =>
                                      setUnityColor((current) =>
                                        cycleOption(appearanceColorOptions, current, 1)
                                      )
                                    }
                                  >
                                    <ChevronRight className="!h-6 !w-6" />
                                  </Button>
                                </AppearanceControlTooltip>
                              </div>

                              <div className="flex items-center justify-center">
                                <Button
                                  aria-label="Randomize teammate appearance"
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1.5"
                                  disabled={isSubmitting}
                                  onClick={randomizeUnityAppearance}
                                >
                                  <Shuffle className="h-3.5 w-3.5" />
                                  Randomize
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="flex w-full flex-col space-y-2">
                    <div className="flex flex-row items-center gap-2">
                      <Label htmlFor="about">About</Label>
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoSquareButton />
                          </TooltipTrigger>
                          <TooltipContent
                            side="right"
                            align="end"
                            className="text-caption max-w-xs"
                          >
                            <p>{staticSkillsText}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    <Textarea
                      id="about"
                      placeholder="Describe the persona's background, personality, etc..."
                      className="min-h-[100px] pr-8"
                      {...register('about', { required: 'About description is required' })}
                    />
                    {errors.about && (
                      <p className="text-body text-strong mt-1 text-destructive">
                        {errors.about.message}
                      </p>
                    )}
                  </div>
                </div>
              </section>

              <div className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] md:items-stretch">
                <section className="flex min-w-0 flex-col" data-testid="assistant-voice-section">
                  <SectionHeader>
                    <SectionIconSlot>
                      <Volume2 className="h-4 w-4" />
                    </SectionIconSlot>
                    <span className="text-body">Voice</span>
                  </SectionHeader>
                  {/* The list is taken out of flow so its length can't size the grid
                      row; it fills whatever height the Computer column settles on. */}
                  <div className="relative min-h-[276px] flex-1">
                    <div className="absolute inset-0">
                      <VoiceCustomization
                        assistantActions={assistantActions}
                        onAddPaymentMethod={onAddPaymentMethod}
                        activeTab={voiceCustomizationTab}
                        setActiveTab={setVoiceCustomizationTab}
                        onVoiceSelected={(selectedVoice) => {
                          setValue('voiceId', selectedVoice?.voiceId, {
                            shouldValidate: !!selectedVoice?.voiceId,
                          });
                          setValue('voiceName', selectedVoice?.name, {
                            shouldValidate: !!selectedVoice?.name,
                          });
                          setValue(
                            'voiceDescription',
                            selectedVoice?.description ?? selectedVoice?.name,
                            { shouldValidate: !!selectedVoice?.description }
                          );
                          setValue('voiceGender', selectedVoice?.gender, {
                            shouldValidate: !!selectedVoice?.gender,
                          });
                          setValue('voiceLanguage', selectedVoice?.language, {
                            shouldValidate: !!selectedVoice?.language,
                          });
                          setValue(
                            'voiceProvider',
                            selectedVoice?.provider || PRIMARY_VOICE_PROVIDER,
                            {
                              shouldValidate: true,
                            }
                          );
                          setValue('voiceExists', selectedVoice?.isUserVoiceInOrchestra ?? false, {
                            shouldValidate: true,
                          });
                        }}
                        initialVoiceId={getValues('voiceId')}
                        disabled={isSubmitting}
                        onProcessingStateChange={onVoiceProcessingStateChange}
                        onPreviewPlayingChange={setIsVoicePreviewPlaying}
                        onPreviewAudioElementChange={setPreviewAudioElement}
                        onPlaySelectedVoicePreviewChange={handlePlaySelectedVoicePreviewChange}
                        allDisplayableVoices={allDisplayableVoices}
                        isLoadingUserVoices={isLoadingUserVoices}
                        fetchUserVoices={fetchUserVoices}
                        handleDeleteVoice={handleDeleteVoice}
                      />
                    </div>
                  </div>
                  {errors.voiceId && (
                    <p className="text-body text-strong mt-1 text-destructive">
                      {errors.voiceId.message}
                    </p>
                  )}
                  {errors.voiceLanguage && !errors.voiceId && (
                    <p className="text-body text-strong mt-1 text-destructive">
                      {errors.voiceLanguage.message}
                    </p>
                  )}
                  {errors.voiceProvider && !errors.voiceId && (
                    <p className="text-body text-strong mt-1 text-destructive">
                      {errors.voiceProvider.message}
                    </p>
                  )}
                </section>

                <div className="flex min-w-0 flex-col gap-5">
                  <section className="min-w-0 shrink-0">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <div
                        className={cn(
                          'flex items-center gap-2 text-muted-foreground',
                          isWorkspaceWarning && 'text-destructive'
                        )}
                      >
                        <SectionIconSlot>
                          <BriefcaseBusiness className="h-4 w-4" />
                        </SectionIconSlot>
                        <span className="text-body">Workspace</span>
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <InfoSquareButton
                                aria-label={
                                  isWorkspaceWarning
                                    ? 'Workspace setup warning'
                                    : 'More information'
                                }
                                className={cn(
                                  isWorkspaceWarning &&
                                    'border-destructive text-destructive hover:text-destructive'
                                )}
                              >
                                {isWorkspaceWarning ? (
                                  <span
                                    aria-hidden="true"
                                    className="flex h-2.5 w-1 flex-col items-center justify-between"
                                  >
                                    <span className="rounded-control h-[7px] w-0.5 bg-current" />
                                    <span className="rounded-control h-0.5 w-0.5 bg-current" />
                                  </span>
                                ) : undefined}
                              </InfoSquareButton>
                            </TooltipTrigger>
                            <TooltipContent
                              side="left"
                              align="start"
                              className={cn(
                                'max-w-sm',
                                isWorkspaceWarning ? 'text-body text-destructive' : 'text-caption'
                              )}
                            >
                              {isWorkspaceWarning && (
                                <>
                                  <span className="block">
                                    It&apos;s advised to create a workspace for your new digital
                                    twin <strong className="font-bold">now</strong>, so they can get
                                    started right away. If you don&apos;t want to create one yet,
                                    click skip.
                                  </span>
                                  <span className="my-3 block">----</span>
                                </>
                              )}
                              <span className="block">
                                Create a{' '}
                                <strong
                                  className={cn(
                                    'font-bold',
                                    !isWorkspaceWarning && 'text-foreground'
                                  )}
                                >
                                  new
                                </strong>{' '}
                                Google or Microsoft account for {workspaceAssistantName}, so they
                                can join your team, gain their own unique access controls to the
                                files and applications you use via{' '}
                                <strong
                                  className={cn(
                                    'font-bold',
                                    !isWorkspaceWarning && 'text-foreground'
                                  )}
                                >
                                  their own
                                </strong>{' '}
                                new account, and can work alongside your team.
                              </span>
                              <span className="mt-2 block">
                                Do{' '}
                                <strong
                                  className={cn(
                                    'font-bold',
                                    !isWorkspaceWarning && 'text-foreground'
                                  )}
                                >
                                  not
                                </strong>{' '}
                                connect {workspaceAssistantName} to your own Google/Microsoft
                                account. Only T-W1N should have access to your personal account.
                              </span>
                              <span
                                className={cn(
                                  'mt-4 block font-bold',
                                  !isWorkspaceWarning && 'text-title text-foreground'
                                )}
                              >
                                Steps
                              </span>
                              <ol className="mt-2 list-decimal space-y-1 pl-5">
                                <li>Log out of your own account.</li>
                                <li>
                                  Create a new account for {workspaceAssistantName}, or ask your IT
                                  team to do so.
                                </li>
                                <li>
                                  Log into the new account for {workspaceAssistantName} on your
                                  machine.
                                </li>
                                <li>
                                  Click the corresponding workspace below to auto-sync for{' '}
                                  {workspaceAssistantName}.
                                </li>
                              </ol>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
                      {mode === 'hire' && (
                        <label className="flex cursor-pointer items-center gap-2 text-muted-foreground">
                          <Checkbox
                            checked={skipWorkspaceSetup}
                            onCheckedChange={(checked) =>
                              onSkipWorkspaceSetupChange?.(checked === true)
                            }
                            // Nothing to connect when no provider is configured —
                            // keep it checked so the hire flow isn't blocked.
                            disabled={
                              isSubmitting ||
                              !onSkipWorkspaceSetupChange ||
                              !workspaceConnectAvailable
                            }
                          />
                          <span className="text-body">Skip</span>
                        </label>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {(() => {
                        const googleButton = (
                          <button
                            type="button"
                            onClick={() => onWorkspaceProviderSelect?.('google')}
                            disabled={
                              isSubmitting || !onWorkspaceProviderSelect || !workspaceGoogle
                            }
                            className={cn(
                              'relative flex h-28 w-full flex-col items-center justify-center rounded-md border bg-card px-3 text-center transition-colors hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
                              workspaceProvider === 'google'
                                ? 'border-primary bg-accent-soft ring-1 ring-primary'
                                : 'border-border'
                            )}
                            aria-label={
                              mode === 'hire'
                                ? 'Select Google Workspace'
                                : 'Open Google Workspace integration'
                            }
                          >
                            {workspaceProvider === 'google' && (
                              <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Check className="h-3.5 w-3.5" />
                              </span>
                            )}
                            <Image src={GoogleIcon} alt="Google logo" width={32} height={32} />
                            <span className="text-body text-strong mt-3 text-foreground">
                              Google Workspace
                            </span>
                          </button>
                        );
                        if (workspaceGoogle) return googleButton;
                        // Disabled buttons don't emit hover, so the tooltip triggers off a span.
                        return (
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex">{googleButton}</span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>{`Google Workspace ${workspaceUnavailableReason}`}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })()}
                      {(() => {
                        const microsoftButton = (
                          <button
                            type="button"
                            onClick={() => onWorkspaceProviderSelect?.('microsoft')}
                            disabled={
                              isSubmitting || !onWorkspaceProviderSelect || !workspaceMicrosoft
                            }
                            className={cn(
                              'relative flex h-28 w-full flex-col items-center justify-center rounded-md border bg-card px-3 text-center transition-colors hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
                              workspaceProvider === 'microsoft'
                                ? 'border-primary bg-accent-soft ring-1 ring-primary'
                                : 'border-border'
                            )}
                            aria-label={
                              mode === 'hire'
                                ? 'Select Microsoft 365'
                                : 'Open Microsoft 365 integration'
                            }
                          >
                            {workspaceProvider === 'microsoft' && (
                              <span className="absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                                <Check className="h-3.5 w-3.5" />
                              </span>
                            )}
                            <Image
                              src={MicrosoftIcon}
                              alt="Microsoft logo"
                              width={32}
                              height={32}
                            />
                            <span className="text-body text-strong mt-3 text-foreground">
                              Microsoft 365
                            </span>
                          </button>
                        );
                        if (workspaceMicrosoft) return microsoftButton;
                        return (
                          <TooltipProvider delayDuration={100}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="flex">{microsoftButton}</span>
                              </TooltipTrigger>
                              <TooltipContent side="top">
                                <p>{`Microsoft 365 ${workspaceUnavailableReason}`}</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        );
                      })()}
                    </div>
                  </section>

                  <section className="min-w-0 shrink-0" data-testid="assistant-computer-section">
                    <SectionHeader>
                      <SectionIconSlot>
                        <Laptop className="h-4 w-4" />
                      </SectionIconSlot>
                      <span className="text-body">Computer</span>
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <InfoSquareButton />
                          </TooltipTrigger>
                          <TooltipContent
                            side="right"
                            align="start"
                            className="text-caption max-w-xs"
                          >
                            <p>
                              The operating system installed on {workspaceAssistantName}&apos;s
                              personal computer, which they use to complete tasks.
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </SectionHeader>
                    <Controller
                      name="setup"
                      control={control}
                      render={({ field }) => (
                        <div data-testid="computer-controls">
                          <div
                            className={cn(
                              'flex min-h-28 cursor-pointer flex-col justify-center space-y-3 rounded-md border p-3',
                              field.value === 'remote' && 'border-primary'
                            )}
                            onClick={() => field.onChange('remote')}
                          >
                            <div className="flex items-center space-x-2">
                              <div
                                className={cn(
                                  'rounded-control flex h-4 w-4 items-center justify-center border border-muted-foreground',
                                  field.value === 'remote' && 'border-primary'
                                )}
                              >
                                {field.value === 'remote' && (
                                  <div className="rounded-control h-2 w-2 bg-primary" />
                                )}
                              </div>
                              <Label
                                htmlFor="setup-remote"
                                className="text-body cursor-pointer font-normal"
                              >
                                Remote - Use a virtual machine
                              </Label>
                            </div>
                            {field.value === 'remote' && (
                              <Controller
                                name="operatingSystem"
                                control={control}
                                render={({ field: osField }) => (
                                  <div className="space-y-2 pl-6">
                                    <div
                                      className="flex cursor-pointer items-center space-x-2"
                                      data-testid="computer-os-none"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        osField.onChange('none');
                                      }}
                                    >
                                      <div
                                        className={cn(
                                          'rounded-control flex h-4 w-4 items-center justify-center border border-muted-foreground',
                                          osField.value === 'none' && 'border-primary'
                                        )}
                                      >
                                        {osField.value === 'none' && (
                                          <div className="rounded-control h-2 w-2 bg-primary" />
                                        )}
                                      </div>
                                      <Label className="text-body font-normal">
                                        None — no managed computer
                                      </Label>
                                    </div>
                                    <div
                                      className="flex cursor-pointer items-center space-x-2"
                                      data-testid="computer-os-ubuntu"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        osField.onChange('ubuntu');
                                      }}
                                    >
                                      <div
                                        className={cn(
                                          'rounded-control flex h-4 w-4 items-center justify-center border border-muted-foreground',
                                          osField.value === 'ubuntu' && 'border-primary'
                                        )}
                                      >
                                        {osField.value === 'ubuntu' && (
                                          <div className="rounded-control h-2 w-2 bg-primary" />
                                        )}
                                      </div>
                                      <FaUbuntu className="h-4 w-4" />
                                      <Label
                                        htmlFor="os-remote-ubuntu"
                                        className="text-body cursor-pointer font-normal"
                                      >
                                        Ubuntu — $50 credits/month
                                      </Label>
                                    </div>
                                    <div
                                      className="flex cursor-pointer items-center space-x-2"
                                      data-testid="computer-os-windows"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        osField.onChange('windows');
                                      }}
                                    >
                                      <div
                                        className={cn(
                                          'rounded-control flex h-4 w-4 items-center justify-center border border-muted-foreground',
                                          osField.value === 'windows' && 'border-primary'
                                        )}
                                      >
                                        {osField.value === 'windows' && (
                                          <div className="rounded-control h-2 w-2 bg-primary" />
                                        )}
                                      </div>
                                      <FaWindows className="h-4 w-4" />
                                      <Label
                                        htmlFor="os-remote-windows"
                                        className="text-body cursor-pointer font-normal"
                                      >
                                        Windows — $75 credits/month
                                      </Label>
                                    </div>
                                  </div>
                                )}
                              />
                            )}
                          </div>
                        </div>
                      )}
                    />
                  </section>
                </div>
              </div>
            </div>
          </fieldset>
        </ScrollArea>
      </form>
    </FormProvider>
  );
}
