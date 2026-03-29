'use client';

import * as React from 'react';
import { UseFormReturn, FormProvider, Controller, useWatch } from 'react-hook-form';
import { Input } from '@/components/UI/input';
import { Textarea } from '@/components/UI/textarea';
import { Label } from '@/components/UI/label';
import { AssistantPhotoViewer } from './AssistantHirePhotoPreview';
import {
  AssistantFormData,
  AssistantActions,
  VoiceOption,
  Voice,
} from '@/types/assistants/assistant';
import { VoiceCustomization } from './AssistantHireVoiceCustomization';
import { PhotoCustomization } from './AssistantHirePhotoCustomization';
import { Volume2, User, Info, Image as ImageIcon, Settings, Laptop } from 'lucide-react';
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
import voicePresetsConstant from '@/constants/assistants/voice_presets.js';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/UI/accordion';
import { allCountryNames } from '@/constants/assistants/countries';
import { cn } from '@/lib/utils';
import { getLangCodeForNationality } from '@/utils/assistants/voice-utils';
import { FaUbuntu, FaWindows } from 'react-icons/fa';
import { generateTimezoneOptions } from '@/utils/assistants/timezone-utils';

const staticSkillsText = `The bio doesn't influence the assistant's abilities. All assistants come with the same foundational skills and can specialize in whichever area you want them to.`;

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
}

export function HireForm({
  formMethods,
  onSubmit,
  isSubmitting,
  assistantActions,
  onPhotoProcessingStateChange,
  onVoiceProcessingStateChange,
  onNewMediaReady,
  allDisplayableVoices,
  isLoadingUserVoices,
  fetchUserVoices,
  handleDeleteVoice,
  mode = 'hire',
  onAddPaymentMethod,
  userHasChangedPreset = false,
}: HireFormProps) {
  const {
    register,
    formState: { errors },
    watch,
    setValue,
    getValues,
    trigger,
    control,
  } = formMethods;

  const [photoCustomizationTab, setPhotoCustomizationTab] = React.useState<
    'upload' | 'create' | 'edit' | 'animate'
  >('upload');
  const [voiceCustomizationTab, setVoiceCustomizationTab] = React.useState<
    'select' | 'clone' | 'design'
  >('select');
  const [showAnimatePing, setShowAnimatePing] = React.useState(false);
  const [playedVideoUrls, setPlayedVideoUrls] = React.useState(new Set<string>());
  const setup = useWatch({ control, name: 'setup' });
  const operatingSystem = useWatch({ control, name: 'operatingSystem' });
  const timezoneOptions = React.useMemo(() => generateTimezoneOptions(), []);

  // Reset OS to 'ubuntu' when switching from local to remote if 'macos' is selected (macos is only available for local)
  React.useEffect(() => {
    if (setup === 'remote' && operatingSystem === 'macos') {
      setValue('operatingSystem', 'ubuntu');
    }
  }, [setup, operatingSystem, setValue]);

  const photoPreviewUrl = watch('photoPreviewUrl');
  const videoPreviewUrl = watch('videoPreviewUrl');
  const photoFile = watch('photoFile');
  const videoFile = watch('videoFile');
  const isPresetPristine = watch('isPresetPristine');
  const firstName = watch('firstName');
  const surname = watch('surname');
  const age = watch('age');
  const rhfNationality = watch('nationality');
  const nationalityRef = React.useRef(rhfNationality);

  React.useEffect(() => {
    const isPristine = getValues('isPresetPristine');
    // Only trigger auto-selection if the nationality was changed manually, not by a preset.
    if (isPristine || nationalityRef.current === rhfNationality) {
      nationalityRef.current = rhfNationality;
      return;
    }
    nationalityRef.current = rhfNationality;

    if (allDisplayableVoices.length === 0) return;

    const preferredLanguage = getLangCodeForNationality(rhfNationality);
    if (!preferredLanguage) return;

    const currentVoiceId = getValues('voiceId');
    const currentVoice = allDisplayableVoices.find((v) => v.voiceId === currentVoiceId);

    // If current voice already matches the new nationality's language, do nothing
    if (currentVoice && currentVoice.language === preferredLanguage) return;

    // Find the best new voice: a non-preset one is preferred
    const bestNewVoice =
      allDisplayableVoices.find((v) => v.language === preferredLanguage && !v.isPreset) ||
      allDisplayableVoices.find((v) => v.language === preferredLanguage);

    if (bestNewVoice) {
      setValue('voiceId', bestNewVoice.voiceId, { shouldValidate: true });
      setValue('voiceName', bestNewVoice.name, { shouldValidate: true });
      setValue('voiceDescription', bestNewVoice.description ?? bestNewVoice.name, {
        shouldValidate: true,
      });
      setValue('voiceGender', bestNewVoice.gender, { shouldValidate: true });
      setValue('voiceLanguage', bestNewVoice.language, { shouldValidate: true });
      setValue('voiceProvider', bestNewVoice.provider || PRIMARY_VOICE_PROVIDER, {
        shouldValidate: true,
      });
      setValue('voiceExists', bestNewVoice.isUserVoiceInOrchestra ?? false, {
        shouldValidate: true,
      });
    }
  }, [rhfNationality, allDisplayableVoices, getValues, setValue]);

  const rhfVoiceId = watch('voiceId');
  const rhfVoiceLanguage = watch('voiceLanguage');
  const rhfVoiceGender = watch('voiceGender');
  const rhfVoiceName = watch('voiceName');
  const rhfVoiceDescription = watch('voiceDescription');
  const rhfIsPresetPristine = watch('isPresetPristine');
  const rhfProfileVideoUrl = watch('profileVideoUrl');
  const videoSourceVoiceId = watch('videoSourceVoiceId');
  const hasExistingEditVideo =
    mode === 'edit' && !videoFile && !!(rhfProfileVideoUrl || videoPreviewUrl);

  // --- Start of Video Playability Logic ---
  const isVideoPlayable = React.useMemo(() => {
    const hasVideo = !!videoPreviewUrl;
    if (!hasVideo) return false;

    // An existing video on an assistant being edited is always playable,
    // as it's not dependent on the currently selected form voice.
    if (hasExistingEditVideo) {
      return true;
    }

    // A preset video is playable only if the form state is still pristine.
    const isPresetVideo = rhfProfileVideoUrl?.includes('preset_assistants');

    // A preset video is playable if the form is pristine OR if the currently selected voice matches the video's original voice.
    if (isPresetVideo) {
      return isPresetPristine || rhfVoiceId === videoSourceVoiceId;
    }

    // A custom video (one the user animated themselves) is playable if the currently
    // selected voice matches the voice used to create the video.
    const hasCustomVideo = !!videoFile;
    if (hasCustomVideo) {
      return rhfVoiceId === videoSourceVoiceId;
    }

    return false; // Not a preset video and not a custom video, so not playable.
  }, [
    videoPreviewUrl,
    videoFile,
    hasExistingEditVideo,
    isPresetPristine,
    rhfVoiceId,
    rhfProfileVideoUrl,
    videoSourceVoiceId,
  ]);

  // --- End of Video Playability Logic ---

  const selectedVoiceForPhotoCustomization: VoiceOption | null = React.useMemo(() => {
    if (rhfVoiceId && rhfVoiceLanguage && rhfVoiceGender && rhfVoiceName) {
      return {
        voiceId: rhfVoiceId,
        language: rhfVoiceLanguage as SupportedLanguage,
        gender: rhfVoiceGender as Gender,
        name: rhfVoiceName,
        description: rhfVoiceDescription || '',
        provider: getValues('voiceProvider') || PRIMARY_VOICE_PROVIDER,
        isPreset: rhfIsPresetPristine,
        isUserVoiceInOrchestra: getValues('voiceExists'),
      };
    }
    return null;
  }, [
    rhfVoiceId,
    rhfVoiceLanguage,
    rhfVoiceGender,
    rhfVoiceName,
    rhfVoiceDescription,
    rhfIsPresetPristine,
    getValues,
  ]);

  const isEditMode = mode === 'edit';
  const shouldUseAnimateClickShortcut = !hasExistingEditVideo;
  const handlePhotoViewerClick = () => {
    // This handler is only called from the viewer when it's appropriate to switch to the animate tab.
    setPhotoCustomizationTab('animate');
    setShowAnimatePing(true);
    setTimeout(() => setShowAnimatePing(false), 4000);
  };

  const handleVideoAutoplayed = React.useCallback((url: string) => {
    setPlayedVideoUrls((prev) => new Set(prev).add(url));
  }, []);

  // Only autoplay when the user has explicitly selected/changed a preset,
  // not on the initial auto-select when the dialog opens.
  const shouldAutoplayVideo =
    !!videoPreviewUrl &&
    !playedVideoUrls.has(videoPreviewUrl) &&
    !isEditMode &&
    userHasChangedPreset;

  React.useEffect(() => {
    const isPristine = getValues('isPresetPristine');
    const currentPreset = getValues('currentPreset');

    if (!isPristine || !currentPreset) return;

    const voiceId = currentPreset.voiceIds[PRIMARY_VOICE_PROVIDER];

    if (!voiceId) return;

    const voiceDetails = (voicePresetsConstant as Voice[]).find(
      (v) => v.voiceId === voiceId && v.provider === PRIMARY_VOICE_PROVIDER
    );
    if (!voiceDetails) return;

    // Update voice fields
    setValue('voiceId', voiceDetails.voiceId);
    setValue('voiceName', voiceDetails.name);
    setValue('voiceDescription', voiceDetails.description);
    setValue('voiceLanguage', voiceDetails.language as SupportedLanguage);
    setValue('voiceGender', voiceDetails.gender as Gender);
    setValue('voiceProvider', voiceDetails.provider);

    const userHasVoice = allDisplayableVoices.some(
      (v) =>
        v.voiceId === voiceDetails.voiceId &&
        v.provider === voiceDetails.provider &&
        v.isUserVoiceInOrchestra
    );
    setValue('voiceExists', userHasVoice, { shouldValidate: true });
  }, [getValues, setValue, allDisplayableVoices]);

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
                    <User className="h-4 w-4" />
                    <span className="text-body">Profile</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="space-y-2">
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
                      <div className="col-span-2 sm:col-span-1">
                        <Label htmlFor="age">Age</Label>
                        <Input
                          id="age"
                          type="number"
                          {...register('age', {
                            valueAsNumber: true,
                            min: { value: 18, message: 'Age must be at least 18' },
                            max: { value: 70, message: 'Age must be 70 or less' },
                          })}
                        />
                        {errors.age && (
                          <p className="text-body text-strong mt-1 text-destructive">
                            {errors.age.message}
                          </p>
                        )}
                      </div>
                      <div className="col-span-2 sm:col-span-1">
                        <Label htmlFor="nationality">Nationality</Label>
                        <Select
                          value={rhfNationality || ''}
                          onValueChange={(value) =>
                            setValue('nationality', value, { shouldValidate: true })
                          }
                          disabled={isSubmitting}
                        >
                          <SelectTrigger
                            id="nationality"
                            {...register('nationality', { required: 'Nationality is required.' })}
                          >
                            <SelectValue placeholder="Select a nationality..." />
                          </SelectTrigger>
                          <SelectContent>
                            {allCountryNames.map((countryName) => (
                              <SelectItem key={countryName} value={countryName}>
                                {countryName}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {errors.nationality && (
                          <p className="text-body text-strong mt-1 text-destructive">
                            {errors.nationality.message}
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
                              <Info className="h-4 w-4 cursor-help text-muted-foreground" />
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
              <AccordionItem value="photo" aria-label="photo trigger">
                <AccordionTrigger className="text-title">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <ImageIcon className="h-4 w-4" />
                    <span className="text-body">Appearance</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="flex flex-col items-start gap-4 sm:flex-row">
                    <AssistantPhotoViewer
                      photoUrl={photoPreviewUrl}
                      videoUrl={isVideoPlayable ? videoPreviewUrl : null}
                      photoFile={photoFile}
                      videoFile={videoFile}
                      className="flex-shrink-0"
                      isPlayable={isVideoPlayable}
                      disabled={isSubmitting}
                      onClick={shouldUseAnimateClickShortcut ? handlePhotoViewerClick : undefined}
                      shouldAutoplay={shouldAutoplayVideo}
                      onAutoplay={handleVideoAutoplayed}
                    />
                    <PhotoCustomization
                      assistantActions={assistantActions}
                      onNewMediaReady={onNewMediaReady}
                      currentImageUrl={photoPreviewUrl ?? null}
                      currentImageFile={photoFile ?? null}
                      disabled={isSubmitting}
                      selectedVoice={selectedVoiceForPhotoCustomization}
                      firstName={firstName}
                      surname={surname}
                      age={age as number | null}
                      activeTab={photoCustomizationTab}
                      setActiveTab={setPhotoCustomizationTab}
                      showAnimatePing={showAnimatePing}
                      onProcessingStateChange={onPhotoProcessingStateChange}
                      onAddPaymentMethod={onAddPaymentMethod}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>

              {/* Voice Section */}
              <AccordionItem value="voice" aria-label="voice trigger">
                <AccordionTrigger className="text-title">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Volume2 className="h-4 w-4" />
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
                    <Settings className="h-4 w-4" />
                    <span className="text-body">Advanced</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pt-2">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Laptop className="mb-1 h-4 w-4 text-muted-foreground" />
                        <Label htmlFor="operatingSystem">Assistant&apos;s Setup</Label>
                        <TooltipProvider delayDuration={100}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Info className="h-4 w-4 cursor-help text-muted-foreground" />
                            </TooltipTrigger>
                            <TooltipContent
                              side="right"
                              align="end"
                              className="text-caption max-w-xs"
                            >
                              <p>
                                {isEditMode
                                  ? 'Desktop mode cannot be changed after the assistant is created.'
                                  : 'Choose to run the assistant on a remote virtual machine (default) or connect it to a local desktop.'}
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
                                    'flex h-4 w-4 items-center justify-center rounded-full border border-muted-foreground',
                                    field.value === 'remote' && 'border-primary'
                                  )}
                                >
                                  {field.value === 'remote' && (
                                    <div className="h-2 w-2 rounded-full bg-primary" />
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
                                            'flex h-4 w-4 items-center justify-center rounded-full border border-muted-foreground',
                                            osField.value === 'ubuntu' && 'border-primary'
                                          )}
                                        >
                                          {osField.value === 'ubuntu' && (
                                            <div className="h-2 w-2 rounded-full bg-primary" />
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
                                            'flex h-4 w-4 items-center justify-center rounded-full border border-muted-foreground',
                                            osField.value === 'windows' && 'border-primary'
                                          )}
                                        >
                                          {osField.value === 'windows' && (
                                            <div className="h-2 w-2 rounded-full bg-primary" />
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
