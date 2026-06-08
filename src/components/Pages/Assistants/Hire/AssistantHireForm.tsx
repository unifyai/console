'use client';

import * as React from 'react';
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
import { Volume2, Settings, Laptop, Shuffle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/UI/button';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/UI/accordion';
import { cn } from '@/lib/utils';
import { FaUbuntu, FaWindows } from 'react-icons/fa';
import { generateTimezoneOptions } from '@/utils/assistants/timezone-utils';
import { TeammateCreature } from '@/components/Brand';
import { getCreatureMetrics, type CreatureEyes } from '@/components/Brand/TeammateCreature';
import { roleColorVars, type BrandRole, type CreatureShape } from '@/components/Brand/shapes';

const staticSkillsText = `The bio doesn't influence the martian's abilities. All martians come with the same foundational skills and can specialize in whichever area you want them to.`;
const MARTIAN_PREVIEW_SIZE = 192;
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

function getSpeakingEyes(baseEyes: CreatureEyes, frame: number): CreatureEyes {
  const sequenceByBaseEyes: Record<CreatureEyes, CreatureEyes[]> = {
    up: ['up', 'square', 'down', 'square'],
    down: ['down', 'square', 'up', 'square'],
    square: ['square', 'up', 'square', 'down'],
  };

  return sequenceByBaseEyes[baseEyes][frame % sequenceByBaseEyes[baseEyes].length];
}

function SpaceshipIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g transform="rotate(-12 12 12)">
        <path
          d="M8.1 10.3C8.8 7.9 10.2 6.5 12 6.5s3.2 1.4 3.9 3.8"
          stroke="var(--muted-foreground)"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
        />
        <path
          d="M3 13.1c2.2-1.6 5.4-2.5 9-2.5s6.8.9 9 2.5c-1.2 2.4-4.7 3.9-9 3.9s-7.8-1.5-9-3.9Z"
          fill="var(--muted-foreground)"
        />
      </g>
    </svg>
  );
}

function MartianOutlineIcon({ className }: { className?: string }) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      fill="none"
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M7 5h10v3h3v5h-3v6h-4v-4h-2v4H7v-6H4V8h3V5Z"
        stroke="var(--muted-foreground)"
        strokeLinejoin="round"
        strokeWidth={1.8}
      />
    </svg>
  );
}

function AccordionIconSlot({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center">{children}</span>
  );
}

const InfoSquareButton = React.forwardRef<
  HTMLButtonElement,
  React.ComponentPropsWithoutRef<'button'>
>(({ className, ...props }, ref) => (
  <button
    ref={ref}
    type="button"
    aria-label="More information"
    className={cn(
      'text-caption rounded-control inline-flex h-4 w-4 shrink-0 scale-90 cursor-help items-center justify-center border border-muted-foreground text-muted-foreground',
      className
    )}
    {...props}
  >
    <span aria-hidden="true" className="flex h-2.5 w-1 flex-col items-center justify-between">
      <span className="rounded-control h-0.5 w-0.5 bg-current" />
      <span className="rounded-control h-[7px] w-0.5 bg-current" />
    </span>
  </button>
));
InfoSquareButton.displayName = 'InfoSquareButton';

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
  const timezoneOptions = React.useMemo(() => generateTimezoneOptions(), []);
  const defaultVoice = React.useMemo(() => getDefaultVoiceForProvider(), []);
  const isEditMode = mode === 'edit';
  const appearanceControlVisibilityClass = isAppearanceControlsVisible
    ? 'pointer-events-auto opacity-100'
    : 'pointer-events-none opacity-0';

  const colorIndex = appearanceColorOptions.indexOf(martianColor);
  const previousColor =
    appearanceColorOptions[
      (colorIndex - 1 + appearanceColorOptions.length) % appearanceColorOptions.length
    ];
  const nextColor = appearanceColorOptions[(colorIndex + 1) % appearanceColorOptions.length];
  const displayedMartianEyes = isVoicePreviewPlaying
    ? getSpeakingEyes(speakingEyeBaseRef.current, speakingEyeFrame)
    : martianEyes;
  const eyeArrowTop = React.useMemo(() => {
    const metrics = getCreatureMetrics(martianShape);
    const scale = Math.min(
      MARTIAN_PREVIEW_SIZE / metrics.width,
      MARTIAN_PREVIEW_SIZE / metrics.height
    );
    const renderedHeight = metrics.height * scale;
    const renderedTop = (MARTIAN_PREVIEW_SIZE - renderedHeight) / 2;

    return renderedTop + metrics.eyeY * scale - 18;
  }, [martianShape]);

  const randomizeMartianAppearance = React.useCallback(() => {
    setMartianEyes((current) => pickOption(appearanceEyeOptions, current));
    setMartianShape((current) => pickOption(appearanceShapeOptions, current));
    setMartianColor((current) => pickOption(appearanceColorOptions, current));
  }, []);

  const handlePreviewSpeechLevelChange = React.useCallback((level: number) => {
    const martian = martianSpeechRef.current;
    if (!martian) return;

    const speechLevel = Math.max(0, Math.min(1, level));
    martian.style.setProperty('--martian-speech-level', speechLevel.toFixed(3));
    martian.style.transform = `translateY(${-speechLevel * 3}px) scale(${1 + speechLevel * 0.004})`;
  }, []);

  React.useEffect(() => {
    if (!isVoicePreviewPlaying) {
      setSpeakingEyeFrame(0);
      speakingEyeBaseRef.current = martianEyes;
      return;
    }

    speakingEyeBaseRef.current = martianEyes;
    setSpeakingEyeFrame(0);
    const eyeTimer = window.setInterval(() => {
      setSpeakingEyeFrame((current) => (current + 1) % 4);
    }, 2000);

    return () => window.clearInterval(eyeTimer);
  }, [isVoicePreviewPlaying, martianEyes]);

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
          <fieldset disabled={isSubmitting} className="group px-4 py-2">
            <Accordion type="multiple" defaultValue={['photo', 'voice']} className="w-full">
              {/* Profile Section */}
              <AccordionItem value="profile" aria-label="profile trigger">
                <AccordionTrigger className="text-title">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AccordionIconSlot>
                      <SpaceshipIcon className="h-[18px] w-[18px]" />
                    </AccordionIconSlot>
                    <span className="text-body">Profile</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="space-y-2">
                    {onRandomizeProfile && (
                      <div className="flex justify-start pb-1">
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
                                onClick={onRandomizeProfile}
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
                    <div className="grid flex-1 grid-cols-2 gap-x-4 gap-y-1">
                      <div className="col-span-2 sm:col-span-1">
                        <Label htmlFor="firstName">First Name</Label>
                        <Input
                          id="firstName"
                          {...register('firstName', {
                            required: 'First name is required',
                          })}
                        />
                        {errors.firstName && (
                          <p className="text-body text-strong mt-1 text-destructive">
                            {errors.firstName.message}
                          </p>
                        )}
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <Label htmlFor="surname">Last Name</Label>
                        <Input
                          id="surname"
                          {...register('surname', {
                            required: 'Last name is required',
                          })}
                        />
                        {errors.surname && (
                          <p className="text-body text-strong mt-1 text-destructive">
                            {errors.surname.message}
                          </p>
                        )}
                      </div>
                      <div className="col-span-2 flex flex-col space-y-2 pt-1">
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
                          <p className="text-body text-strong mt-1 text-destructive">
                            {errors.jobTitle.message}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="pt-1">
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
                            <SelectTrigger id="timezone">
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
                        <p className="text-body text-strong mt-1 text-destructive">
                          {errors.timezone.message}
                        </p>
                      )}
                    </div>
                    <div className="flex w-full flex-col space-y-2 pt-1">
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
                </AccordionContent>
              </AccordionItem>

              {/* Photo Section */}
              <AccordionItem
                value="photo"
                aria-label="photo trigger"
                onMouseEnter={() => setIsAppearanceControlsVisible(true)}
                onMouseLeave={() => setIsAppearanceControlsVisible(false)}
              >
                <AccordionTrigger className="text-title">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AccordionIconSlot>
                      <MartianOutlineIcon className="h-4 w-4" />
                    </AccordionIconSlot>
                    <span className="text-body">Appearance</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="flex justify-center py-1">
                    <div className="flex w-full max-w-sm flex-col items-center gap-1">
                      <div className="relative flex h-48 w-72 max-w-full items-center justify-center overflow-visible">
                        <Button
                          aria-label="Previous eye style"
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'absolute left-5 h-9 w-9 bg-transparent hover:bg-transparent',
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
                          <ChevronLeft className="!h-7 !w-7" />
                        </Button>
                        <Button
                          aria-label="Next eye style"
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'absolute right-5 h-9 w-9 bg-transparent hover:bg-transparent',
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
                          <ChevronRight className="!h-7 !w-7" />
                        </Button>

                        <Button
                          aria-label="Previous body shape"
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'absolute left-1 top-[55%] h-9 w-9 bg-transparent hover:bg-transparent',
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
                          <ChevronLeft className="!h-7 !w-7" />
                        </Button>
                        <Button
                          aria-label="Next body shape"
                          type="button"
                          variant="ghost"
                          size="icon"
                          className={cn(
                            'absolute right-1 top-[55%] h-9 w-9 bg-transparent hover:bg-transparent',
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
                          <ChevronRight className="!h-7 !w-7" />
                        </Button>

                        <button
                          aria-label="Randomize martian appearance"
                          className="flex h-full w-52 items-center justify-center bg-transparent p-0 outline-none transition-transform hover:scale-[1.02] focus-visible:ring-2 focus-visible:ring-ring"
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
                              color={martianColor}
                              eyes={displayedMartianEyes}
                              label="Martian avatar"
                              shape={martianShape}
                            />
                          </span>
                        </button>
                      </div>

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
                          className="h-9 w-9 bg-transparent hover:bg-transparent"
                          disabled={isSubmitting}
                          onClick={() =>
                            setMartianColor((current) =>
                              cycleOption(appearanceColorOptions, current, -1)
                            )
                          }
                        >
                          <ChevronLeft className="!h-7 !w-7" />
                        </Button>
                        <div
                          aria-label={`Current martian color: ${martianColor}`}
                          className="flex items-center gap-1.5 px-1 py-1"
                          role="img"
                        >
                          {[previousColor, martianColor, nextColor].map((color) => (
                            <span
                              aria-hidden="true"
                              className={cn(
                                'rounded-control block border border-border',
                                color === martianColor ? 'h-5 w-5' : 'h-3.5 w-3.5 opacity-65'
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
                          className="h-9 w-9 bg-transparent hover:bg-transparent"
                          disabled={isSubmitting}
                          onClick={() =>
                            setMartianColor((current) =>
                              cycleOption(appearanceColorOptions, current, 1)
                            )
                          }
                        >
                          <ChevronRight className="!h-7 !w-7" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Voice Section */}
              <AccordionItem value="voice" aria-label="voice trigger">
                <AccordionTrigger className="text-title">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AccordionIconSlot>
                      <Volume2 className="h-4 w-4" />
                    </AccordionIconSlot>
                    <span className="text-body">Voice</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
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
                </AccordionContent>
              </AccordionItem>

              <AccordionItem value="advanced" className="border-b-0" aria-label="advanced trigger">
                <AccordionTrigger className="text-title">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <AccordionIconSlot>
                      <Settings className="h-4 w-4" />
                    </AccordionIconSlot>
                    <span className="text-body">Advanced</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 pl-2">
                        <Laptop className="mb-1 h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="operatingSystem" className="text-muted-foreground">
                          Martian&apos;s Setup
                        </Label>
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
                                {isEditMode
                                  ? 'Desktop mode cannot be changed after the martian is created.'
                                  : 'Choose to run the martian on a remote virtual machine (default) or connect it to a local desktop.'}
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      </div>
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
                                    'rounded-control flex h-3.5 w-3.5 items-center justify-center border border-muted-foreground',
                                    field.value === 'remote' && 'border-primary'
                                  )}
                                >
                                  {field.value === 'remote' && (
                                    <div className="rounded-control h-1.5 w-1.5 bg-primary" />
                                  )}
                                </div>
                                <Label
                                  htmlFor="setup-remote"
                                  className={cn(
                                    'text-label font-normal',
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
                                            'rounded-control flex h-3.5 w-3.5 items-center justify-center border border-muted-foreground',
                                            osField.value === 'ubuntu' && 'border-primary'
                                          )}
                                        >
                                          {osField.value === 'ubuntu' && (
                                            <div className="rounded-control h-1.5 w-1.5 bg-primary" />
                                          )}
                                        </div>
                                        <FaUbuntu className="h-4 w-4" />
                                        <Label
                                          htmlFor="os-remote-ubuntu"
                                          className={cn(
                                            'text-label font-normal',
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
                                            'rounded-control flex h-3.5 w-3.5 items-center justify-center border border-muted-foreground',
                                            osField.value === 'windows' && 'border-primary'
                                          )}
                                        >
                                          {osField.value === 'windows' && (
                                            <div className="rounded-control h-1.5 w-1.5 bg-primary" />
                                          )}
                                        </div>
                                        <FaWindows className="h-4 w-4" />
                                        <Label
                                          htmlFor="os-remote-windows"
                                          className={cn(
                                            'text-label font-normal',
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
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </fieldset>
        </ScrollArea>
      </form>
    </FormProvider>
  );
}
