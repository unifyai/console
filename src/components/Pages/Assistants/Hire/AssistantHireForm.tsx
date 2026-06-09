'use client';

import * as React from 'react';
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
import { TeammateCreature } from '@/components/Brand';
import { getCreatureMetrics, type CreatureEyes } from '@/components/Brand/TeammateCreature';
import { roleColorVars, type BrandRole, type CreatureShape } from '@/components/Brand/shapes';
import GoogleIcon from '@/public/icons/google-icon.png';
import MicrosoftIcon from '@/public/icons/microsoft-icon.png';
import type { OAuthProvider } from '@/types/assistants/contact';
import {
  clampMartianSpeechLevel,
  getMartianSpeechTransform,
  getSpeakingEyes,
} from '@/utils/assistants/martian-animation';

const staticSkillsText = `The bio doesn't influence the martian's abilities. All martians come with the same foundational skills and can specialize in whichever area you want them to.`;
const MARTIAN_PREVIEW_SIZE = 160;
const APPEARANCE_HOVER_CONTROL_CLASS = 'transition-opacity duration-150';

const appearanceEyeOptions = ['up', 'down', 'square'] as const satisfies readonly CreatureEyes[];
const appearanceShapeOptions = [
  'clawd',
  'notch',
  'runner',
  'wide',
  'tall',
  'sprout',
  'hopper',
  'pebble',
] as const satisfies readonly CreatureShape[];
const appearanceColorOptions = [
  'green',
  'blue',
  'orange',
  'purple',
  'yellow',
  'teal',
  'pink',
  'cyan',
] as const satisfies readonly BrandRole[];
const DEFAULT_MARTY_APPEARANCE = {
  eyes: 'up',
  shape: 'clawd',
  color: 'green',
} as const satisfies {
  eyes: CreatureEyes;
  shape: CreatureShape;
  color: BrandRole;
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

function SectionIconSlot({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">{children}</span>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 flex items-center gap-2 text-muted-foreground">{children}</div>;
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
}: HireFormProps) {
  const {
    register,
    formState: { errors },
    setValue,
    getValues,
    trigger,
    control,
  } = formMethods;

  const [voiceCustomizationTab, setVoiceCustomizationTab] = React.useState<
    'select' | 'clone' | 'design'
  >('select');
  const [martianEyes, setMartianEyes] = React.useState<CreatureEyes>('up');
  const [martianShape, setMartianShape] = React.useState<CreatureShape>('clawd');
  const [martianColor, setMartianColor] = React.useState<BrandRole>('green');
  const [isAppearanceControlsVisible, setIsAppearanceControlsVisible] = React.useState(false);
  const [isVoicePreviewPlaying, setIsVoicePreviewPlaying] = React.useState(false);
  const [speakingEyeFrame, setSpeakingEyeFrame] = React.useState(0);
  const speakingEyeBaseRef = React.useRef<CreatureEyes>(martianEyes);
  const martianSpeechRef = React.useRef<HTMLSpanElement | null>(null);
  const setup = useWatch({ control, name: 'setup' });
  const operatingSystem = useWatch({ control, name: 'operatingSystem' });
  const firstName = useWatch({ control, name: 'firstName' });
  const timezoneOptions = React.useMemo(() => generateTimezoneOptions(), []);
  const defaultVoice = React.useMemo(() => getDefaultVoiceForProvider(), []);
  const isEditMode = mode === 'edit';
  const selectedMartianEyes = lockAppearanceControls ? DEFAULT_MARTY_APPEARANCE.eyes : martianEyes;
  const selectedMartianShape = lockAppearanceControls
    ? DEFAULT_MARTY_APPEARANCE.shape
    : martianShape;
  const selectedMartianColor = lockAppearanceControls
    ? DEFAULT_MARTY_APPEARANCE.color
    : martianColor;
  const appearanceControlVisibilityClass = isAppearanceControlsVisible
    ? 'pointer-events-auto opacity-100'
    : 'pointer-events-none opacity-0';

  const colorIndex = appearanceColorOptions.indexOf(selectedMartianColor);
  const previousColor =
    appearanceColorOptions[
      (colorIndex - 1 + appearanceColorOptions.length) % appearanceColorOptions.length
    ];
  const nextColor = appearanceColorOptions[(colorIndex + 1) % appearanceColorOptions.length];
  const displayedMartianEyes = isVoicePreviewPlaying
    ? getSpeakingEyes(speakingEyeBaseRef.current, speakingEyeFrame)
    : selectedMartianEyes;
  const workspaceAssistantName =
    typeof firstName === 'string' && firstName.trim().length > 0
      ? firstName.trim()
      : 'this martian';
  const isWorkspaceWarning = mode === 'hire' && showWorkspaceWarning;
  const eyeArrowTop = React.useMemo(() => {
    const metrics = getCreatureMetrics(selectedMartianShape);
    const scale = Math.min(
      MARTIAN_PREVIEW_SIZE / metrics.width,
      MARTIAN_PREVIEW_SIZE / metrics.height
    );
    const renderedHeight = metrics.height * scale;
    const renderedTop = (MARTIAN_PREVIEW_SIZE - renderedHeight) / 2;

    return renderedTop + metrics.eyeY * scale - 18;
  }, [selectedMartianShape]);

  const randomizeMartianAppearance = React.useCallback(() => {
    if (lockAppearanceControls) return;

    setMartianEyes((current) => pickOption(appearanceEyeOptions, current));
    setMartianShape((current) => pickOption(appearanceShapeOptions, current));
    setMartianColor((current) => pickOption(appearanceColorOptions, current));
  }, [lockAppearanceControls]);

  const randomizeProfileAndAppearance = React.useCallback(() => {
    onRandomizeProfile?.();
    randomizeMartianAppearance();
  }, [onRandomizeProfile, randomizeMartianAppearance]);

  const handlePreviewSpeechLevelChange = React.useCallback((level: number) => {
    const martian = martianSpeechRef.current;
    if (!martian) return;

    const speechLevel = clampMartianSpeechLevel(level);
    martian.style.setProperty('--martian-speech-level', speechLevel.toFixed(3));
    martian.style.transform = getMartianSpeechTransform(speechLevel);
  }, []);

  React.useEffect(() => {
    if (!isVoicePreviewPlaying) {
      setSpeakingEyeFrame(0);
      speakingEyeBaseRef.current = selectedMartianEyes;
      return;
    }

    speakingEyeBaseRef.current = selectedMartianEyes;
    setSpeakingEyeFrame(0);
    const eyeTimer = window.setInterval(() => {
      setSpeakingEyeFrame((current) => (current + 1) % 4);
    }, 2000);

    return () => window.clearInterval(eyeTimer);
  }, [isVoicePreviewPlaying, selectedMartianEyes]);

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
                              aria-label="Randomize martian profile"
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
                                    Optional short label to remember what this martian is for (e.g.
                                    &quot;Growth marketing&quot;, &quot;QA engineer&quot;). Shown in
                                    the martians list hover card.
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
                        <div className="flex h-full w-full flex-col items-center justify-center gap-3">
                          <div className="relative flex h-44 w-64 max-w-full items-center justify-center overflow-visible sm:h-56 sm:w-72 md:h-40 md:w-64">
                            {!lockAppearanceControls && (
                              <>
                                <Button
                                  aria-label="Previous eye style"
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    'absolute left-0 h-8 w-8 bg-transparent hover:bg-transparent md:left-4',
                                    APPEARANCE_HOVER_CONTROL_CLASS,
                                    appearanceControlVisibilityClass
                                  )}
                                  disabled={isSubmitting}
                                  onClick={() =>
                                    setMartianEyes((current) =>
                                      cycleOption(appearanceEyeOptions, current, -1)
                                    )
                                  }
                                  style={{ top: eyeArrowTop }}
                                >
                                  <ChevronLeft className="!h-6 !w-6" />
                                </Button>
                                <Button
                                  aria-label="Next eye style"
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    'absolute right-0 h-8 w-8 bg-transparent hover:bg-transparent md:right-4',
                                    APPEARANCE_HOVER_CONTROL_CLASS,
                                    appearanceControlVisibilityClass
                                  )}
                                  disabled={isSubmitting}
                                  onClick={() =>
                                    setMartianEyes((current) =>
                                      cycleOption(appearanceEyeOptions, current, 1)
                                    )
                                  }
                                  style={{ top: eyeArrowTop }}
                                >
                                  <ChevronRight className="!h-6 !w-6" />
                                </Button>

                                <Button
                                  aria-label="Previous body shape"
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    'absolute left-0 top-[55%] h-8 w-8 bg-transparent hover:bg-transparent md:left-4',
                                    APPEARANCE_HOVER_CONTROL_CLASS,
                                    appearanceControlVisibilityClass
                                  )}
                                  disabled={isSubmitting}
                                  onClick={() =>
                                    setMartianShape((current) =>
                                      cycleOption(appearanceShapeOptions, current, -1)
                                    )
                                  }
                                >
                                  <ChevronLeft className="!h-6 !w-6" />
                                </Button>
                                <Button
                                  aria-label="Next body shape"
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  className={cn(
                                    'absolute right-0 top-[55%] h-8 w-8 bg-transparent hover:bg-transparent md:right-4',
                                    APPEARANCE_HOVER_CONTROL_CLASS,
                                    appearanceControlVisibilityClass
                                  )}
                                  disabled={isSubmitting}
                                  onClick={() =>
                                    setMartianShape((current) =>
                                      cycleOption(appearanceShapeOptions, current, 1)
                                    )
                                  }
                                >
                                  <ChevronRight className="!h-6 !w-6" />
                                </Button>
                              </>
                            )}

                            {lockAppearanceControls ? (
                              <span className="flex h-full w-40 items-center justify-center sm:w-52 md:w-40">
                                <span
                                  ref={martianSpeechRef}
                                  className="block h-full w-full transform-gpu"
                                  style={{ '--martian-speech-level': 0 } as React.CSSProperties}
                                >
                                  <TeammateCreature
                                    className="h-full w-full"
                                    color={selectedMartianColor}
                                    eyes={displayedMartianEyes}
                                    label="Marty avatar"
                                    shape={selectedMartianShape}
                                  />
                                </span>
                              </span>
                            ) : (
                              <button
                                aria-label="Randomize martian appearance"
                                className="flex h-full w-40 items-center justify-center bg-transparent p-0 outline-none transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-ring sm:w-52 md:w-40"
                                disabled={isSubmitting}
                                onClick={randomizeMartianAppearance}
                                type="button"
                              >
                                <span
                                  ref={martianSpeechRef}
                                  className="block h-full w-full transform-gpu"
                                  style={{ '--martian-speech-level': 0 } as React.CSSProperties}
                                >
                                  <TeammateCreature
                                    className="h-full w-full"
                                    color={selectedMartianColor}
                                    eyes={displayedMartianEyes}
                                    label="Martian avatar"
                                    shape={selectedMartianShape}
                                  />
                                </span>
                              </button>
                            )}
                          </div>

                          {!lockAppearanceControls && (
                            <div
                              className={cn(
                                'flex items-center gap-2',
                                APPEARANCE_HOVER_CONTROL_CLASS,
                                appearanceControlVisibilityClass
                              )}
                            >
                              <Button
                                aria-label="Previous martian color"
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 bg-transparent hover:bg-transparent"
                                disabled={isSubmitting}
                                onClick={() =>
                                  setMartianColor((current) =>
                                    cycleOption(appearanceColorOptions, current, -1)
                                  )
                                }
                              >
                                <ChevronLeft className="!h-6 !w-6" />
                              </Button>
                              <div
                                aria-label={`Current martian color: ${selectedMartianColor}`}
                                className="flex items-center gap-1.5 px-1 py-1"
                                role="img"
                              >
                                {[previousColor, selectedMartianColor, nextColor].map((color) => (
                                  <span
                                    aria-hidden="true"
                                    className={cn(
                                      'rounded-control block border border-border',
                                      color === selectedMartianColor
                                        ? 'h-5 w-5'
                                        : 'h-3.5 w-3.5 opacity-65'
                                    )}
                                    key={color}
                                    style={{ backgroundColor: roleColorVars[color] }}
                                  />
                                ))}
                              </div>
                              <Button
                                aria-label="Next martian color"
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 bg-transparent hover:bg-transparent"
                                disabled={isSubmitting}
                                onClick={() =>
                                  setMartianColor((current) =>
                                    cycleOption(appearanceColorOptions, current, 1)
                                  )
                                }
                              >
                                <ChevronRight className="!h-6 !w-6" />
                              </Button>
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

              <div className="mt-6 grid gap-5 md:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] md:items-start">
                {/* Voice Section */}
                <section className="min-w-0">
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
                      setValue('voiceProvider', selectedVoice?.provider || PRIMARY_VOICE_PROVIDER, {
                        shouldValidate: true,
                      });
                      setValue('voiceExists', selectedVoice?.isUserVoiceInOrchestra ?? false, {
                        shouldValidate: true,
                      });
                    }}
                    initialVoiceId={getValues('voiceId')}
                    disabled={isSubmitting}
                    onProcessingStateChange={onVoiceProcessingStateChange}
                    onPreviewPlayingChange={setIsVoicePreviewPlaying}
                    onPreviewSpeechLevelChange={handlePreviewSpeechLevelChange}
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

                <div className="min-w-0 space-y-5">
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
                                    It&apos;s advised to create a workspace for your new martian{' '}
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
                            disabled={isSubmitting || !onSkipWorkspaceSetupChange}
                          />
                          <span className="text-body">Skip</span>
                        </label>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => onWorkspaceProviderSelect?.('google')}
                        disabled={isSubmitting || !onWorkspaceProviderSelect}
                        className={cn(
                          'relative flex h-28 flex-col items-center justify-center rounded-md border bg-card px-3 text-center transition-colors hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
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
                      <button
                        type="button"
                        onClick={() => onWorkspaceProviderSelect?.('microsoft')}
                        disabled={isSubmitting || !onWorkspaceProviderSelect}
                        className={cn(
                          'relative flex h-28 flex-col items-center justify-center rounded-md border bg-card px-3 text-center transition-colors hover:border-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60',
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
                        <Image src={MicrosoftIcon} alt="Microsoft logo" width={32} height={32} />
                        <span className="text-body text-strong mt-3 text-foreground">
                          Microsoft 365
                        </span>
                      </button>
                    </div>
                  </section>

                  <section className="min-w-0">
                    <SectionHeader>
                      <SectionIconSlot>
                        <Laptop className="h-4 w-4" />
                      </SectionIconSlot>
                      <span className="text-body">Computer</span>
                    </SectionHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Controller
                          name="setup"
                          control={control}
                          render={({ field }) => (
                            <div
                              className={cn(
                                'space-y-2',
                                isEditMode && 'pointer-events-none opacity-60'
                              )}
                            >
                              <div
                                className={cn(
                                  'flex flex-col space-y-3 rounded-md border p-3',
                                  !isEditMode && 'cursor-pointer',
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
                                            !isEditMode && 'cursor-pointer'
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
                                            !isEditMode && 'cursor-pointer'
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
                          )}
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
