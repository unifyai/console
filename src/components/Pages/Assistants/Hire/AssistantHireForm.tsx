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
import { Gender, SupportedLanguage } from '@cartesia/cartesia-js/api';
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
  droidAntennaOptions,
  droidBodyOptions,
  droidColorOptions,
  droidOutfitOptions,
  type DroidBody,
  type DroidOutfit,
} from '@/components/Brand/droidAppearance';
import { roleColorVars, type BrandRole } from '@/components/Brand/shapes';
import GoogleIcon from '@/public/icons/google-icon.png';
import MicrosoftIcon from '@/public/icons/microsoft-icon.png';
import type { OAuthProvider } from '@/types/assistants/contact';
import { DroidCallAvatar } from '@/components/Pages/Assistants/Communication/DroidCallAvatar';
import { useDroidAudioElementLipsync } from '@/utils/assistants/droid-lipsync';
import { getDroidBodyForm, getRotatingBotViewBox } from '@droid/brand/components';

const staticSkillsText = `The bio doesn't influence the droid's abilities. All droids come with the same foundational skills and can specialize in whichever area you want them to.`;
const DROID_PREVIEW_SIZE = 120;
const DROID_PREVIEW_REST_SIZE = 152;
const DROID_PREVIEW_REST_SCALE = DROID_PREVIEW_REST_SIZE / DROID_PREVIEW_SIZE;
const DROID_PREVIEW_STAGE_HEIGHT = 192;
const DROID_PREVIEW_SCALE_BODY = 'standard' satisfies DroidBody;
const DROID_PREVIEW_LAYOUT_ANTENNA = 'bigball' satisfies CreatureAntenna;
const DROID_PREVIEW_ANTENNA_CONTROL_REFERENCE = 'ball' satisfies CreatureAntenna;
const DROID_PREVIEW_OUTFIT_REGION_RATIO = 0.66;
const DROID_PREVIEW_BODY_CONTROL_TOP = 72;
const APPEARANCE_HOVER_CONTROL_CLASS = 'transition-opacity duration-150';
const DROID_PREVIEW_LAYOUT_TRANSITION_CLASS = 'transition-all duration-300 ease-out';
const COLOR_SWATCH_TRANSITION = { type: 'spring', stiffness: 720, damping: 42, mass: 0.65 };

const appearanceAntennaOptions = droidAntennaOptions;
const appearanceBodyOptions = droidBodyOptions;
const appearanceColorOptions = droidColorOptions;
const appearanceOutfitOptions = droidOutfitOptions;
const DEFAULT_COORDINATOR_APPEARANCE = {
  eyes: 'up',
  antenna: 'ball',
  body: 'standard',
  color: 'green',
  outfit: 'none',
} as const satisfies {
  eyes: CreatureEyes;
  antenna: CreatureAntenna;
  body: DroidBody;
  color: BrandRole;
  outfit: DroidOutfit;
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
  return Math.max(0, Math.min(DROID_PREVIEW_STAGE_HEIGHT - 32, top));
}

function getDroidPreviewScale(): number {
  const referenceViewBox = getRotatingBotViewBox(
    getDroidBodyForm(DROID_PREVIEW_SCALE_BODY),
    undefined,
    undefined,
    undefined,
    DROID_PREVIEW_LAYOUT_ANTENNA
  );
  return DROID_PREVIEW_SIZE / referenceViewBox.w;
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

function HireDroidAvatar({
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
  body: DroidBody;
  color: BrandRole;
  baseEyes: CreatureEyes;
  outfit: DroidOutfit;
  label: string;
}) {
  const voicePreviewLipsyncFrame = useDroidAudioElementLipsync(previewAudioElement, {
    enabled: isVoicePreviewPlaying && !!previewAudioElement,
  });

  const form = getDroidBodyForm(body);
  const layoutViewBox = getRotatingBotViewBox(
    form,
    undefined,
    undefined,
    undefined,
    DROID_PREVIEW_LAYOUT_ANTENNA
  );
  const selectedViewBox = getRotatingBotViewBox(form, undefined, undefined, undefined, antenna);
  const scale = getDroidPreviewScale();

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
          <DroidCallAvatar
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
  workspaceProvider?: OAuthProvider | null;
  onWorkspaceProviderSelect?: (provider: OAuthProvider) => void;
  skipWorkspaceSetup?: boolean;
  onSkipWorkspaceSetupChange?: (skip: boolean) => void;
  showWorkspaceWarning?: boolean;
  lockIdentityFields?: boolean;
  lockAppearanceControls?: boolean;
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
  workspaceProvider,
  onWorkspaceProviderSelect,
  skipWorkspaceSetup = false,
  onSkipWorkspaceSetupChange,
  showWorkspaceWarning = false,
  lockIdentityFields = false,
  lockAppearanceControls = false,
  userHasChangedPreset = false,
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
  const [droidAntenna, setDroidAntenna] = React.useState<CreatureAntenna>('ball');
  const [droidBody, setDroidBody] = React.useState<DroidBody>('standard');
  const [droidColor, setDroidColor] = React.useState<BrandRole>('green');
  const [droidOutfit, setDroidOutfit] = React.useState<DroidOutfit>('none');

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
      setDroidBody(parsed.body);
      setDroidColor(parsed.color);
      setDroidAntenna(parsed.antenna);
      setDroidOutfit(parsed.outfit);
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
  const operatingSystem = useWatch({ control, name: 'operatingSystem' });
  const firstName = useWatch({ control, name: 'firstName' });
  const timezoneOptions = React.useMemo(() => generateTimezoneOptions(), []);
  const defaultVoice = React.useMemo(() => getDefaultVoiceForProvider(), []);
  const isEditMode = mode === 'edit';
  const selectedDroidEyes = DEFAULT_COORDINATOR_APPEARANCE.eyes;
  const selectedDroidAntenna = lockAppearanceControls
    ? DEFAULT_COORDINATOR_APPEARANCE.antenna
    : droidAntenna;
  const selectedDroidBody = lockAppearanceControls
    ? DEFAULT_COORDINATOR_APPEARANCE.body
    : droidBody;
  const selectedDroidColor = lockAppearanceControls
    ? DEFAULT_COORDINATOR_APPEARANCE.color
    : droidColor;
  const selectedDroidOutfit = lockAppearanceControls
    ? DEFAULT_COORDINATOR_APPEARANCE.outfit
    : droidOutfit;
  const appearanceControlVisibilityClass = isAppearanceControlsVisible
    ? 'pointer-events-auto opacity-100'
    : 'pointer-events-none opacity-0';
  const isAppearanceEditing = !lockAppearanceControls && isAppearanceControlsVisible;
  const droidPreviewScale = isAppearanceEditing ? 1 : DROID_PREVIEW_REST_SCALE;

  // Persist the live creature as the avatar by syncing it into `profilePhotoUrl`
  // as an `appearance://` sentinel. We defer to a real image only when the user
  // uploaded one or explicitly picked a preset persona's photo. This keeps the
  // saved value current regardless of how the dialog triggers submission.
  const creatureSentinel = buildCreatureSentinel({
    body: selectedDroidBody,
    color: selectedDroidColor,
    eyes: selectedDroidEyes,
    antenna: selectedDroidAntenna,
    outfit: selectedDroidOutfit,
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

  const colorIndex = appearanceColorOptions.indexOf(selectedDroidColor);
  const previousColor =
    appearanceColorOptions[
      (colorIndex - 1 + appearanceColorOptions.length) % appearanceColorOptions.length
    ];
  const nextColor = appearanceColorOptions[(colorIndex + 1) % appearanceColorOptions.length];
  const outfitIndex = appearanceOutfitOptions.indexOf(selectedDroidOutfit);
  const previousOutfit =
    appearanceOutfitOptions[
      (outfitIndex - 1 + appearanceOutfitOptions.length) % appearanceOutfitOptions.length
    ];
  const nextOutfit = appearanceOutfitOptions[(outfitIndex + 1) % appearanceOutfitOptions.length];
  const workspaceAssistantName =
    typeof firstName === 'string' && firstName.trim().length > 0 ? firstName.trim() : 'this droid';
  const isWorkspaceWarning = mode === 'hire' && showWorkspaceWarning;
  const droidControlTop = React.useMemo(() => {
    const form = getDroidBodyForm(selectedDroidBody);
    const layoutViewBox = getRotatingBotViewBox(
      form,
      undefined,
      undefined,
      undefined,
      DROID_PREVIEW_LAYOUT_ANTENNA
    );
    const antennaControlViewBox = getRotatingBotViewBox(
      form,
      undefined,
      undefined,
      undefined,
      DROID_PREVIEW_ANTENNA_CONTROL_REFERENCE
    );
    const bodyViewBox = getRotatingBotViewBox(form, undefined, undefined, undefined, 'none');
    const scale = getDroidPreviewScale();
    const layoutTop = (DROID_PREVIEW_STAGE_HEIGHT - layoutViewBox.h * scale) / 2;
    const bodyTop = layoutTop + (bodyViewBox.minY - layoutViewBox.minY) * scale;
    const antennaControlTop = layoutTop + (antennaControlViewBox.minY - layoutViewBox.minY) * scale;

    return {
      antenna: clampPreviewControlTop(antennaControlTop + 18),
      body: DROID_PREVIEW_BODY_CONTROL_TOP,
      outfit: clampPreviewControlTop(
        bodyTop + bodyViewBox.h * scale * DROID_PREVIEW_OUTFIT_REGION_RATIO - 16
      ),
    };
  }, [selectedDroidBody]);

  const randomizeDroidAppearance = React.useCallback(() => {
    if (lockAppearanceControls) return;

    setDroidAntenna((current) => pickOption(appearanceAntennaOptions, current));
    setDroidBody((current) => pickOption(appearanceBodyOptions, current));
    setDroidColor((current) => pickOption(appearanceColorOptions, current));
    setDroidOutfit((current) => pickOption(appearanceOutfitOptions, current));
  }, [lockAppearanceControls]);

  const randomizeProfileAndAppearance = React.useCallback(() => {
    onRandomizeProfile?.();
    randomizeDroidAppearance();
  }, [onRandomizeProfile, randomizeDroidAppearance]);

  const handlePlaySelectedVoicePreviewChange = React.useCallback(
    (playPreviewForSelectedVoice: (() => void) | null) => {
      playSelectedVoicePreviewRef.current = playPreviewForSelectedVoice;
    },
    []
  );
  const playSelectedVoicePreview = React.useCallback(() => {
    playSelectedVoicePreviewRef.current?.();
  }, []);

  // Reset OS to 'ubuntu' when switching from local to remote if 'macos' is selected (macos is only available for local)
  React.useEffect(() => {
    if (setup === 'remote' && operatingSystem === 'macos') {
      setValue('operatingSystem', 'ubuntu');
    }
  }, [setup, operatingSystem, setValue]);

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
                  {onRandomizeProfile && (
                    <div className="flex justify-start">
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              aria-label="Randomize droid profile"
                              type="button"
                              variant="outline"
                              size="sm"
                              className="h-8 gap-1.5"
                              disabled={isSubmitting}
                              onClick={randomizeProfileAndAppearance}
                            >
                              <Shuffle className="h-3.5 w-3.5" />
                              Randomize
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Randomize name, role, and bio</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  )}

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
                            title={lockIdentityFields ? "Marty's name is fixed" : undefined}
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
                            title={lockIdentityFields ? "Marty's name is fixed" : undefined}
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
                                    Optional short label to remember what this droid is for (e.g.
                                    &quot;Growth marketing&quot;, &quot;QA engineer&quot;). Shown in
                                    the droids list hover card.
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
                            DROID_PREVIEW_LAYOUT_TRANSITION_CLASS,
                            isAppearanceEditing ? 'gap-3' : 'gap-0'
                          )}
                        >
                          <div
                            className={cn(
                              'relative flex max-w-full items-center justify-center overflow-visible',
                              DROID_PREVIEW_LAYOUT_TRANSITION_CLASS,
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
                                      setDroidAntenna((current) =>
                                        cycleOption(appearanceAntennaOptions, current, -1)
                                      )
                                    }
                                    style={{ top: droidControlTop.antenna }}
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
                                      setDroidAntenna((current) =>
                                        cycleOption(appearanceAntennaOptions, current, 1)
                                      )
                                    }
                                    style={{ top: droidControlTop.antenna }}
                                  >
                                    <ChevronRight className="!h-6 !w-6" />
                                  </Button>
                                </AppearanceControlTooltip>

                                <AppearanceControlTooltip label="Outfit" side="left">
                                  <Button
                                    aria-label="Previous droid outfit"
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
                                      setDroidOutfit((current) =>
                                        cycleOption(appearanceOutfitOptions, current, -1)
                                      )
                                    }
                                    style={{ top: droidControlTop.outfit }}
                                  >
                                    <ChevronLeft className="!h-6 !w-6" />
                                  </Button>
                                </AppearanceControlTooltip>
                                <AppearanceControlTooltip label="Outfit" side="right">
                                  <Button
                                    aria-label="Next droid outfit"
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
                                      setDroidOutfit((current) =>
                                        cycleOption(appearanceOutfitOptions, current, 1)
                                      )
                                    }
                                    style={{ top: droidControlTop.outfit }}
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
                                      setDroidBody((current) =>
                                        cycleOption(appearanceBodyOptions, current, -1)
                                      )
                                    }
                                    style={{ top: droidControlTop.body }}
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
                                      setDroidBody((current) =>
                                        cycleOption(appearanceBodyOptions, current, 1)
                                      )
                                    }
                                    style={{ top: droidControlTop.body }}
                                  >
                                    <ChevronRight className="!h-6 !w-6" />
                                  </Button>
                                </AppearanceControlTooltip>
                              </>
                            )}

                            {lockAppearanceControls ? (
                              <span className="flex h-full w-40 items-center justify-center sm:w-52 md:w-40">
                                <span
                                  className="block h-full w-full transition-transform duration-300 ease-out"
                                  style={{ transform: `scale(${DROID_PREVIEW_REST_SCALE})` }}
                                >
                                  <HireDroidAvatar
                                    isVoicePreviewPlaying={isVoicePreviewPlaying}
                                    previewAudioElement={previewAudioElement}
                                    antenna={selectedDroidAntenna}
                                    body={selectedDroidBody}
                                    color={selectedDroidColor}
                                    baseEyes={selectedDroidEyes}
                                    outfit={selectedDroidOutfit}
                                    label="Marty avatar"
                                  />
                                </span>
                              </span>
                            ) : (
                              <button
                                aria-label="Preview selected voice"
                                className={cn(
                                  'relative z-0 flex h-full items-center justify-center bg-transparent p-0 outline-none focus-visible:ring-2 focus-visible:ring-ring',
                                  DROID_PREVIEW_LAYOUT_TRANSITION_CLASS,
                                  isAppearanceEditing ? 'w-40 sm:w-52 md:w-40' : 'w-56 sm:w-64'
                                )}
                                disabled={isSubmitting}
                                onClick={playSelectedVoicePreview}
                                type="button"
                              >
                                <span
                                  className="block h-full w-full transition-transform duration-300 ease-out"
                                  style={{ transform: `scale(${droidPreviewScale})` }}
                                >
                                  <HireDroidAvatar
                                    isVoicePreviewPlaying={isVoicePreviewPlaying}
                                    previewAudioElement={previewAudioElement}
                                    antenna={selectedDroidAntenna}
                                    body={selectedDroidBody}
                                    color={selectedDroidColor}
                                    baseEyes={selectedDroidEyes}
                                    outfit={selectedDroidOutfit}
                                    label="Droid avatar"
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
                                    aria-label="Previous droid color"
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 bg-transparent hover:bg-transparent"
                                    disabled={isSubmitting}
                                    onClick={() =>
                                      setDroidColor((current) =>
                                        cycleOption(appearanceColorOptions, current, -1)
                                      )
                                    }
                                  >
                                    <ChevronLeft className="!h-6 !w-6" />
                                  </Button>
                                </AppearanceControlTooltip>
                                <div
                                  aria-label={`Current droid color: ${selectedDroidColor}`}
                                  className="flex items-center gap-1.5 px-1 py-1"
                                  role="img"
                                >
                                  <AnimatePresence initial={false} mode="popLayout">
                                    {[previousColor, selectedDroidColor, nextColor].map((color) => (
                                      <motion.span
                                        aria-hidden="true"
                                        className={cn(
                                          'rounded-control block border border-border',
                                          color === selectedDroidColor
                                            ? 'h-5 w-5'
                                            : 'h-3.5 w-3.5 opacity-65'
                                        )}
                                        exit={{ opacity: 0, scale: 0.8 }}
                                        initial={{ opacity: 0, scale: 0.8 }}
                                        animate={{
                                          opacity: color === selectedDroidColor ? 1 : 0.65,
                                          scale: 1,
                                        }}
                                        key={color}
                                        layout
                                        style={{ backgroundColor: roleColorVars[color] }}
                                        transition={COLOR_SWATCH_TRANSITION}
                                      />
                                    ))}
                                  </AnimatePresence>
                                </div>
                                <AppearanceControlTooltip label="Color" side="right">
                                  <Button
                                    aria-label="Next droid color"
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 bg-transparent hover:bg-transparent"
                                    disabled={isSubmitting}
                                    onClick={() =>
                                      setDroidColor((current) =>
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
                                  aria-label="Randomize droid appearance"
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="h-8 gap-1.5"
                                  disabled={isSubmitting}
                                  onClick={randomizeDroidAppearance}
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

              <div
                className={cn(
                  'mt-6 grid gap-5 md:items-start',
                  lockIdentityFields
                    ? 'md:grid-cols-2'
                    : 'md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)]'
                )}
              >
                {!lockIdentityFields && (
                  <section className="min-w-0" data-testid="assistant-voice-section">
                    <SectionHeader>
                      <SectionIconSlot>
                        <Volume2 className="h-4 w-4" />
                      </SectionIconSlot>
                      <span className="text-body">Voice</span>
                    </SectionHeader>
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
                )}

                <div
                  className={cn(
                    'min-w-0 space-y-5',
                    lockIdentityFields && 'grid grid-cols-2 gap-5 space-y-0 md:col-span-2'
                  )}
                >
                  <section className="min-w-0">
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
                                    It&apos;s advised to create a workspace for your new droid{' '}
                                    <strong className="font-bold">now</strong>, so they can get
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
                                account. Only Marty should have access to your personal account.
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
                                ? 'border-primary ring-1 ring-primary'
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
                                ? 'border-primary ring-1 ring-primary'
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

                  <section className="min-w-0">
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
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Controller
                          name="setup"
                          control={control}
                          render={({ field }) => {
                            const computerControls = (
                              <div
                                aria-disabled={isEditMode}
                                className={cn('space-y-2', isEditMode && 'cursor-not-allowed')}
                              >
                                <div
                                  className={cn(
                                    'flex h-28 flex-col justify-center space-y-3 rounded-md border p-3',
                                    isEditMode ? 'cursor-not-allowed opacity-60' : 'cursor-pointer',
                                    field.value === 'remote' && 'border-primary'
                                  )}
                                  onClick={() => !isEditMode && field.onChange('remote')}
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
                                      className={cn(
                                        'text-body font-normal',
                                        !isEditMode && 'cursor-pointer'
                                      )}
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
                                            className={cn(
                                              'flex items-center space-x-2',
                                              isEditMode ? 'cursor-not-allowed' : 'cursor-pointer'
                                            )}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (!isEditMode) osField.onChange('ubuntu');
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
                                              className={cn(
                                                'text-body font-normal',
                                                !isEditMode && 'cursor-pointer'
                                              )}
                                            >
                                              Ubuntu
                                            </Label>
                                          </div>
                                          <div
                                            className={cn(
                                              'flex items-center space-x-2',
                                              isEditMode ? 'cursor-not-allowed' : 'cursor-pointer'
                                            )}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (!isEditMode) osField.onChange('windows');
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
                                              className={cn(
                                                'text-body font-normal',
                                                !isEditMode && 'cursor-pointer'
                                              )}
                                            >
                                              Windows
                                            </Label>
                                          </div>
                                        </div>
                                      )}
                                    />
                                  )}
                                </div>
                              </div>
                            );

                            if (!isEditMode) return computerControls;

                            return (
                              <TooltipProvider delayDuration={100}>
                                <Tooltip>
                                  <TooltipTrigger asChild>{computerControls}</TooltipTrigger>
                                  <TooltipContent
                                    side="top"
                                    align="start"
                                    className="text-caption max-w-xs"
                                  >
                                    <p>Computer can only be configured during onboarding.</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            );
                          }}
                        />
                      </div>
                    </div>
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
