import * as React from 'react';
import { useForm } from 'react-hook-form';
import {
  AssistantFormData,
  AssistantActions,
  Assistant,
  AssistantPreset,
  PhotoUploadResponse,
  VoiceOption,
  AssistantUpdatePayload,
  DesktopMode,
  AssistantHiringSufficientFunds,
} from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
import { Gender, SupportedLanguage } from '@cartesia/cartesia-js/api';
import voicePresetsConstant from '@/constants/assistants/voice_presets.js';
import { getDefaultVoiceForProvider } from '@/utils/assistants/voice-utils';
import { ASSISTANT_ONBOARDING_FEE, PRIMARY_VOICE_PROVIDER } from '@/constants/assistants/settings';
import { ChatMessage } from '@/types/assistants/chat';
import { v4 as uuidv4 } from 'uuid';
import { generatePostHireGreeting } from '@/lib/assistants/preHireChat';

export function useAssistantForm(
  assistantActions: AssistantActions,
  registeredVoices: VoiceOption[],
  onHireSuccess?: (
    newAssistant: Assistant,
    formData: AssistantFormData,
    chatHistory?: ChatMessage[]
  ) => void,
  onUpdateSuccess?: (updatedPayload: Partial<AssistantUpdatePayload>) => void,
  isDialogOpen?: boolean
) {
  const toastIdRef = React.useRef<string | number | undefined>(undefined);
  // Ref to prevent double submissions (avoids stale closure issues)
  const isSubmittingRef = React.useRef(false);
  // Ref to track preset selection operations and ignore stale video downloads
  const presetOperationIdRef = React.useRef(0);

  const defaultVoice = getDefaultVoiceForProvider();

  const [editingAssistant, setEditingAssistant] = React.useState<Assistant | null>(null);

  const formMethods = useForm<AssistantFormData>({
    mode: 'onSubmit',
    defaultValues: {
      // Profile fields
      firstName: '',
      surname: '',
      age: null,
      nationality: 'United States',
      about: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',

      // Media fields
      photoFile: null,
      videoFile: null,
      profilePhotoUrl: null,
      profileVideoUrl: null,
      photoPreviewUrl: null,
      videoPreviewUrl: null,
      videoSourceVoiceId: null,

      // Voice fields
      voiceId: defaultVoice.voiceId,
      voiceName: defaultVoice.name,
      voiceLanguage: defaultVoice.language as SupportedLanguage,
      voiceDescription: defaultVoice.description,
      voiceGender: defaultVoice.gender as Gender,
      voiceProvider: defaultVoice.provider || PRIMARY_VOICE_PROVIDER,
      voiceExists: false,

      // Preset fields
      isPresetPristine: false,
      presetOriginalValues: null,
      currentPreset: null,

      // Setup fields
      setup: 'remote',
      operatingSystem: 'ubuntu',

      // UI state fields
      designIncludeBio: false,
      fastMode: false,
    },
  });

  const {
    setValue,
    getValues,
    setError,
    clearErrors,
    handleSubmit: reactHookFormHandleSubmit,
    reset,
    trigger,
    watch,
  } = formMethods;

  /* -------------------------
        General form utilities
    ------------------------- */
  const [isCheckingBalance, setIsCheckingBalance] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showInsufficientFundsHint, setShowInsufficientFundsHint] = React.useState(false);

  // Keep ref in sync with state to avoid stale closures
  React.useEffect(() => {
    isSubmittingRef.current = isSubmitting;
  }, [isSubmitting]);

  const watchedFields = watch([
    'firstName',
    'surname',
    'age',
    'nationality',
    'about',
    'voiceId',
    'photoFile',
    'profilePhotoUrl',
    'presetOriginalValues',
  ]);
  React.useEffect(() => {
    const [
      firstName,
      surname,
      age,
      nationality,
      about,
      voiceId,
      photoFile,
      profilePhotoUrl,
      originalValues,
    ] = watchedFields;

    if (photoFile) {
      if (getValues('isPresetPristine')) {
        setValue('isPresetPristine', false);
      }
      return;
    }

    if (!originalValues) {
      if (getValues('isPresetPristine')) {
        setValue('isPresetPristine', false);
      }
      return;
    }

    const currentPreset = getValues('currentPreset');
    const isVoicePristine = currentPreset
      ? voiceId === currentPreset.voiceIds.openai ||
        voiceId === currentPreset.voiceIds[PRIMARY_VOICE_PROVIDER]
      : voiceId === originalValues.voiceId;

    let isPristine =
      firstName === originalValues.firstName &&
      surname === originalValues.surname &&
      age === originalValues.age &&
      (nationality ?? '') === (originalValues.nationality ?? '') &&
      isVoicePristine &&
      (profilePhotoUrl === originalValues.profilePhotoUrl ||
        (!profilePhotoUrl && !originalValues.profilePhotoUrl));

    if (getValues('isPresetPristine') && !isPristine) {
      setValue('isPresetPristine', false);
    }
  }, [watchedFields, getValues, setValue]);

  const handleMediaRemove = React.useCallback(() => {
    const photoPreview = getValues('photoPreviewUrl');
    if (photoPreview?.startsWith('blob:')) URL.revokeObjectURL(photoPreview);
    const videoPreview = getValues('videoPreviewUrl');
    if (videoPreview?.startsWith('blob:')) URL.revokeObjectURL(videoPreview);

    setValue('photoFile', null);
    setValue('videoFile', null);
    setValue('videoSourceVoiceId', null);
    setValue('photoPreviewUrl', null);
    setValue('videoPreviewUrl', null);
    setValue('profilePhotoUrl', null);
    setValue('profileVideoUrl', null);
    setValue('isPresetPristine', false);
  }, [getValues, setValue]);

  const onNewMediaReady = React.useCallback(
    (file: File | null, mediaType: 'photo' | 'video', metadata?: { voiceId?: string }) => {
      if (mediaType === 'photo') {
        const currentPhotoPreview = getValues('photoPreviewUrl');
        if (currentPhotoPreview?.startsWith('blob:')) URL.revokeObjectURL(currentPhotoPreview);
        const currentVideoPreview = getValues('videoPreviewUrl');
        if (currentVideoPreview?.startsWith('blob:')) URL.revokeObjectURL(currentVideoPreview);

        setValue('photoFile', file);
        setValue('photoPreviewUrl', file ? URL.createObjectURL(file) : null);
        setValue('videoFile', null);
        setValue('videoSourceVoiceId', null);
        setValue('videoPreviewUrl', null);
        setValue('profileVideoUrl', null);
      } else {
        // video
        const currentVideoPreview = getValues('videoPreviewUrl');
        if (currentVideoPreview?.startsWith('blob:')) URL.revokeObjectURL(currentVideoPreview);
        setValue('videoFile', file);
        setValue('videoSourceVoiceId', metadata?.voiceId || null);
        setValue('videoPreviewUrl', file ? URL.createObjectURL(file) : null);
      }
      setValue('isPresetPristine', false);
    },
    [getValues, setValue]
  );

  const selectPreset = React.useCallback(
    (preset: AssistantPreset) => {
      // Increment operation ID to track this specific preset selection
      presetOperationIdRef.current += 1;
      const thisOperationId = presetOperationIdRef.current;

      handleMediaRemove();
      const isFastMode = getValues('fastMode');

      setValue('setup', 'remote');
      setValue('currentPreset', preset);
      setValue('firstName', preset.firstName, { shouldValidate: true });
      setValue('surname', preset.surname, { shouldValidate: true });
      setValue('age', preset.age, { shouldValidate: true });
      setValue('nationality', preset.nationality ?? 'United States', { shouldValidate: true });
      setValue('about', preset.about ?? '', { shouldValidate: true });
      setValue('profilePhotoUrl', preset.profilePhoto);
      setValue('photoPreviewUrl', preset.profilePhoto);
      setValue('photoFile', null);
      setValue('videoFile', null);
      setValue('videoSourceVoiceId', null);
      setValue(
        'timezone',
        preset.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      );

      // Determine the voiceId based on fast_mode or PRIMARY_VOICE_PROVIDER
      const preferredProvider = isFastMode ? 'openai' : PRIMARY_VOICE_PROVIDER;
      const fallbackProvider = isFastMode ? PRIMARY_VOICE_PROVIDER : 'openai';

      const providerSpecificVoiceId =
        preset.voiceIds[preferredProvider] ?? preset.voiceIds[fallbackProvider] ?? null;
      const finalProvider =
        providerSpecificVoiceId === preset.voiceIds[fallbackProvider]
          ? fallbackProvider
          : preferredProvider;

      // Find the full voice details from voicePresetsConstant using the providerSpecificVoiceId
      let selectedPresetVoiceDetails: VoiceOption | undefined = (
        voicePresetsConstant as VoiceOption[]
      ).find((vp) => vp.voiceId === providerSpecificVoiceId && vp.provider === finalProvider);

      if (!selectedPresetVoiceDetails && providerSpecificVoiceId) {
        selectedPresetVoiceDetails = {
          voiceId: providerSpecificVoiceId,
          name: 'Preset Voice',
          description: 'Preset voice',
          gender: preset.gender === 'male' ? 'male' : 'female',
          language: 'en',
          provider: finalProvider,
          isPreset: true,
          isUserVoiceInOrchestra: false,
        };
      } else if (!selectedPresetVoiceDetails) {
        selectedPresetVoiceDetails = defaultVoice as VoiceOption;
        if (selectedPresetVoiceDetails) {
          selectedPresetVoiceDetails.isUserVoiceInOrchestra = false;
          selectedPresetVoiceDetails.isPreset = true;
        }
      }

      setValue('voiceId', selectedPresetVoiceDetails.voiceId);
      setValue('voiceName', selectedPresetVoiceDetails.name);
      setValue('voiceDescription', selectedPresetVoiceDetails.description);
      setValue('voiceLanguage', selectedPresetVoiceDetails.language as SupportedLanguage);
      setValue('voiceGender', selectedPresetVoiceDetails.gender as Gender);
      setValue('voiceProvider', selectedPresetVoiceDetails.provider || PRIMARY_VOICE_PROVIDER);

      const voiceAlreadyExists = registeredVoices.some(
        (v) => v.voiceId === providerSpecificVoiceId && v.isUserVoiceInOrchestra
      );
      setValue('voiceExists', voiceAlreadyExists);

      setValue('isPresetPristine', true);
      const originalValues = {
        firstName: preset.firstName,
        surname: preset.surname,
        age: preset.age,
        nationality: preset.nationality ?? '',
        voiceId: selectedPresetVoiceDetails.voiceId,
        profilePhotoUrl: preset.profilePhoto,
      };
      setValue('presetOriginalValues', originalValues);
      setValue('videoPreviewUrl', null);
      assistantActions.photo
        .downloadPresetVideo(preset.firstName, preset.surname, finalProvider)
        .then((res) => {
          // Ignore stale video downloads from previous preset selections
          if (presetOperationIdRef.current !== thisOperationId) {
            return;
          }
          if (res.signedUrl) {
            setValue('videoPreviewUrl', res.signedUrl);
            setValue('videoSourceVoiceId', providerSpecificVoiceId);
            setValue(
              'profileVideoUrl',
              `gs://${process.env.NEXT_PUBLIC_ORCHESTRA_GCP_ASSISTANT_IMAGES_BUCKET_NAME}/preset_assistants/${preset.firstName}_${preset.surname}_${finalProvider.toLowerCase()}.mp4`
            );
          } else {
            setValue('isPresetPristine', false);
          }
        })
        .catch((err) => {
          // Ignore stale errors from previous preset selections
          if (presetOperationIdRef.current !== thisOperationId) {
            return;
          }
          setValue('isPresetPristine', false);
          setValue('videoPreviewUrl', null);
        });

      clearErrors();
      setShowInsufficientFundsHint(false);
    },
    [
      setValue,
      handleMediaRemove,
      clearErrors,
      defaultVoice,
      assistantActions.photo,
      getValues,
      registeredVoices,
    ]
  );

  const resetFormAndHints = React.useCallback(
    (values?: AssistantFormData) => {
      reset({
        // Profile fields
        firstName: values?.firstName || '',
        surname: values?.surname || '',
        age: values?.age || null,
        nationality: values?.nationality || 'United States',
        about: values?.about || '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',

        // Media fields
        photoFile: null,
        videoFile: null,
        profilePhotoUrl: null,
        profileVideoUrl: null,
        photoPreviewUrl: null,
        videoPreviewUrl: null,
        videoSourceVoiceId: null,

        // Voice fields
        voiceId: values?.voiceId || defaultVoice.voiceId,
        voiceName: values?.voiceName || defaultVoice.name,
        voiceLanguage: values?.voiceLanguage || (defaultVoice.language as SupportedLanguage),
        voiceDescription: values?.voiceDescription || defaultVoice.description,
        voiceGender: values?.voiceGender || (defaultVoice.gender as Gender),
        voiceExists: values?.voiceExists || false,
        voiceProvider: values?.voiceProvider || defaultVoice.provider || PRIMARY_VOICE_PROVIDER,

        // Preset fields
        isPresetPristine: false,
        presetOriginalValues: null,
        currentPreset: null,

        // Setup fields
        setup: 'remote',
        operatingSystem: 'ubuntu',

        // UI state fields
        designIncludeBio: false,
        fastMode: false,
      });
      setShowInsufficientFundsHint(false);
    },
    [reset, defaultVoice]
  );

  /* ----------------------------
        Editing existing assistant
       ---------------------------- */
  const loadAssistantForEdit = React.useCallback(
    (assistant: Assistant) => {
      setEditingAssistant(assistant);

      const assistantVoiceDetails = registeredVoices.find(
        (v) => v.voiceId === assistant.voiceId && v.provider === assistant.voiceProvider
      );

      reset({
        ...getValues(),

        // Profile
        firstName: assistant.firstName,
        surname: assistant.surname,
        age: assistant.age,
        nationality: assistant.nationality,
        about: assistant.about || '',
        timezone: assistant.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',

        // Media
        photoPreviewUrl: assistant.signedProfilePhotoUrl || assistant.profilePhoto,
        videoPreviewUrl: assistant.signedProfileVideoUrl || assistant.profileVideo,
        profilePhotoUrl: assistant.profilePhoto,
        profileVideoUrl: assistant.profileVideo,
        photoFile: null,
        videoFile: null,

        // Voice
        voiceId: assistant.voiceId || undefined,
        voiceName: assistantVoiceDetails?.name,
        voiceDescription: assistantVoiceDetails?.description,
        voiceGender: assistantVoiceDetails?.gender,
        voiceLanguage: assistantVoiceDetails?.language,
        voiceProvider:
          assistant.voiceProvider || assistantVoiceDetails?.provider || PRIMARY_VOICE_PROVIDER,
        voiceExists: !!assistantVoiceDetails,

        // Setup
        setup: assistant.isUserDesktop ? 'local' : 'remote',
        operatingSystem: (assistant.desktopMode as DesktopMode | null) || 'ubuntu',
      });
      setShowInsufficientFundsHint(false);
    },
    [reset, getValues, registeredVoices]
  );

  const initiateUpdateSequence = reactHookFormHandleSubmit(async (data: AssistantFormData) => {
    // Prevent double submission using ref to avoid stale closure
    if (isSubmittingRef.current) {
      return;
    }
    if (!editingAssistant) {
      toast.error('No assistant selected for editing.');
      return;
    }
    setIsSubmitting(true);
    clearErrors();

    toastIdRef.current = toast.loading('Updating assistant...', { id: toastIdRef.current });

    try {
      // Construct payload with only changed fields
      // Note: Contact details (email, phone, whatsapp) are managed via AssistantContactManager
      const payload: Partial<AssistantUpdatePayload> = {};

      if (data.about !== editingAssistant.about) payload.about = data.about;
      if (data.timezone !== editingAssistant.timezone) payload.timezone = data.timezone;
      if (data.voiceId !== editingAssistant.voiceId) payload.voiceId = data.voiceId;
      if (data.voiceProvider !== editingAssistant.voiceProvider)
        payload.voiceProvider = data.voiceProvider;
      const newVoiceMode = data.fastMode ? 'sts' : 'tts';
      if (newVoiceMode !== editingAssistant.voiceMode) payload.voiceMode = newVoiceMode;

      // Note: isUserDesktop and desktopMode are set at creation time only and cannot be updated

      // Image/Video upload logic
      if (data.photoFile) {
        const formData = new FormData();
        formData.append('file', data.photoFile);
        const photoUploadResult = await assistantActions.photo.upload(formData);
        if ((photoUploadResult as ResponseProps).detail)
          throw new Error(`Photo upload failed: ${(photoUploadResult as ResponseProps).detail}`);
        payload.profilePhoto = (photoUploadResult as PhotoUploadResponse).gcsUrl;
      }
      if (data.videoFile) {
        const formData = new FormData();
        formData.append('file', data.videoFile);
        const videoUploadResult = await assistantActions.photo.uploadVideo(formData);
        if ((videoUploadResult as ResponseProps).detail)
          throw new Error(`Video upload failed: ${(videoUploadResult as ResponseProps).detail}`);
        payload.profileVideo = (videoUploadResult as PhotoUploadResponse).gcsUrl;
      }

      if (data.voiceId && !data.voiceExists) {
        const provider = data?.voiceProvider || defaultVoice.provider || PRIMARY_VOICE_PROVIDER;
        const voiceCreationResponse = await assistantActions.voice.register(
          data.voiceId,
          provider,
          data.voiceName!,
          data.voiceDescription!,
          data.voiceGender!,
          data.voiceLanguage!,
          false
        );
        if (
          'detail' in voiceCreationResponse &&
          !voiceCreationResponse.detail.includes('already exists')
        )
          throw new Error(
            `Error registering voice: ${(voiceCreationResponse as ResponseProps).detail}`
          );
      }

      if (Object.keys(payload).length > 0) {
        const updateResult = await assistantActions.assistant.update(
          editingAssistant.agentId,
          payload
        );
        if ((updateResult as ResponseProps).detail) {
          throw new Error((updateResult as ResponseProps).detail);
        }
        toast.success(`Assistant ${data.firstName} updated!`, { id: toastIdRef.current });
      } else {
        toast.info('No changes to save.', { id: toastIdRef.current });
      }

      toastIdRef.current = undefined;
      if (onUpdateSuccess) onUpdateSuccess(payload);
    } catch (error: any) {
      // Show specific error message if available, otherwise show generic message
      const errorMessage = error?.message || 'An error occurred while updating. Please try again.';
      toast.error(errorMessage, {
        id: toastIdRef.current,
      });
      toastIdRef.current = undefined;
    } finally {
      setIsSubmitting(false);
    }
  });

  /* -------------------------
        Hiring new assistant
       ------------------------- */
  const submitAssistantData = async (data: AssistantFormData, chatHistory?: ChatMessage[]) => {
    setIsSubmitting(true);
    clearErrors();

    toastIdRef.current = toast.loading('Hiring assistant...', { id: toastIdRef.current });

    try {
      // Input validity checks
      if (!data.firstName) {
        setError('firstName', { type: 'manual', message: 'Missing assistant first name.' });
        throw new Error('Missing assistant first name.');
      }
      if (!data.surname) {
        setError('surname', { type: 'manual', message: 'Missing assistant surname.' });
        throw new Error('Missing assistant surname.');
      }
      const ageNumber = typeof data.age === 'string' ? parseInt(data.age, 10) : data.age;
      if (
        data.age != null &&
        (isNaN(ageNumber as number) || (ageNumber as number) < 18 || (ageNumber as number) > 70)
      ) {
        setError('age', { type: 'manual', message: 'Age must be between 18 and 70.' });
        throw new Error('Invalid age provided.');
      }
      if (!data.nationality) {
        setError('nationality', { type: 'manual', message: 'Missing assistant nationality.' });
        throw new Error('Missing assistant nationality.');
      }

      if (!data.voiceId || !data.voiceName || !data.voiceGender || !data.voiceLanguage) {
        setError('voiceId', { type: 'manual', message: 'Voice selection is required.' });
        throw new Error('No voice selected.');
      }

      // Generate initial greeting if no pre-hire chat exists
      let finalChatHistory = chatHistory;
      if (!chatHistory || chatHistory.length === 0) {
        try {
          // Use Server Action instead of API route - cannot be called directly via HTTP
          const greetingResult = await generatePostHireGreeting(
            `${data.firstName} ${data.surname}`,
            data.age,
            data.about,
            data.nationality
          );
          if (greetingResult.error) {
            throw new Error(greetingResult.error);
          }
          if (!greetingResult.content) throw new Error('Generated an empty greeting.');
          finalChatHistory = [
            {
              id: uuidv4(),
              role: 'assistant',
              content: greetingResult.content,
              timestamp: new Date(),
            },
          ];
        } catch (greetingError) {
          /* no-op */
        }
      }

      // Registering voices / uploading custom photos/videos
      let finalImageUrlToSend: string | null = data.profilePhotoUrl || null;
      let finalVideoUrlToSend: string | null = data.profileVideoUrl || null;

      if (data.photoFile) {
        const photoFormData = new FormData();
        photoFormData.append('file', data.photoFile);
        const photoUploadResult = await assistantActions.photo.upload(photoFormData);
        if ((photoUploadResult as ResponseProps).detail)
          throw new Error(`Photo upload failed: ${(photoUploadResult as ResponseProps).detail}`);
        finalImageUrlToSend = (photoUploadResult as PhotoUploadResponse).gcsUrl;
      }

      if (data.videoFile) {
        const videoFormData = new FormData();
        videoFormData.append('file', data.videoFile);
        const videoUploadResult = await assistantActions.photo.uploadVideo(videoFormData);
        if ((videoUploadResult as ResponseProps).detail)
          throw new Error(`Video upload failed: ${(videoUploadResult as ResponseProps).detail}`);
        finalVideoUrlToSend = (videoUploadResult as PhotoUploadResponse).gcsUrl;
      }

      if (data.isPresetPristine) {
        finalImageUrlToSend = data.profilePhotoUrl ?? null;
        finalVideoUrlToSend = data.profileVideoUrl ?? null;
      }

      const voiceProviderVal =
        data?.voiceProvider || defaultVoice.provider || PRIMARY_VOICE_PROVIDER;
      if (!data.voiceExists && data.voiceId) {
        const voiceCreationResponse = await assistantActions.voice.register(
          data.voiceId,
          voiceProviderVal,
          data.voiceName,
          data.voiceDescription || data.voiceName,
          data.voiceGender,
          data.voiceLanguage,
          voicePresetsConstant.map((v) => v.voiceId).includes(data.voiceId)
        );
        if (
          'detail' in voiceCreationResponse &&
          !voiceCreationResponse.detail.includes('already exists')
        ) {
          throw new Error(
            `Error registering voice: ${(voiceCreationResponse as ResponseProps).detail}`
          );
        }
      }

      const isUserDesktop = data.setup === 'local';
      const desktopModePayload = data.operatingSystem as DesktopMode;
      const formattedPreHireChat = finalChatHistory?.map(({ role, content }) => ({
        role,
        msg: content,
      }));
      const voiceMode = data.fastMode ? 'sts' : 'tts';

      // Loading message updated to finalizing hire
      const assistantCreationResult = await assistantActions.assistant.create(
        data.firstName,
        data.surname,
        ageNumber,
        data.nationality,
        data.timezone,
        finalImageUrlToSend,
        finalVideoUrlToSend,
        data.about,
        data.voiceId,
        voiceProviderVal,
        voiceMode,
        isUserDesktop,
        desktopModePayload,
        formattedPreHireChat
      );
      if ('assistant' in assistantCreationResult && assistantCreationResult.assistant) {
        toast.success(`Assistant ${data.firstName} ${data.surname} hired!`, {
          id: toastIdRef.current,
        });
        toastIdRef.current = undefined;
        resetFormAndHints();
        if (onHireSuccess) onHireSuccess(assistantCreationResult.assistant, data, finalChatHistory);
      } else {
        const errorDetail =
          (assistantCreationResult as ResponseProps).detail ||
          'Failed to hire assistant (unknown error)';
        throw new Error(errorDetail);
      }
    } catch (error: any) {
      const isRHFError = !!(
        formMethods.formState.errors.age ||
        formMethods.formState.errors.voiceId ||
        formMethods.formState.errors.firstName ||
        formMethods.formState.errors.surname ||
        formMethods.formState.errors.about
      );

      if (!isRHFError) {
        toast.error(`An error occurred during the hiring process. Please try again.`, {
          id: toastIdRef.current,
        });
      } else {
        if (toastIdRef.current) toast.dismiss(toastIdRef.current);
      }
      toastIdRef.current = undefined;
    } finally {
      setIsSubmitting(false);
    }
  };

  const RHFSubmitHandler = (chatHistory?: ChatMessage[]) =>
    reactHookFormHandleSubmit((data) => submitAssistantData(data, chatHistory));

  const initiateHireSequence = async (chatHistory?: ChatMessage[]) => {
    if (isSubmitting || isCheckingBalance) {
      return;
    }

    const isValid = await trigger();
    if (!isValid) {
      return;
    }

    setIsCheckingBalance(true);
    setShowInsufficientFundsHint(false);
    toastIdRef.current = toast.loading('Checking your balance...');

    try {
      const hiringFundsResponse = await assistantActions.assistant.check(ASSISTANT_ONBOARDING_FEE);

      if ('detail' in hiringFundsResponse || !hiringFundsResponse) {
        toast.error('Failed to check balance.', { id: toastIdRef.current });
        toastIdRef.current = undefined;
        setIsCheckingBalance(false);
        return;
      }

      const hasSufficientFunds = hiringFundsResponse as AssistantHiringSufficientFunds;
      if (!hasSufficientFunds.sufficient) {
        setShowInsufficientFundsHint(true);
        if (toastIdRef.current) toast.dismiss(toastIdRef.current);
        toastIdRef.current = undefined;
      } else {
        await RHFSubmitHandler(chatHistory)();
      }
    } catch (error) {
      toast.error('Error during balance check process.', { id: toastIdRef.current });
      toastIdRef.current = undefined;
    } finally {
      setIsCheckingBalance(false);
    }
  };

  return {
    formMethods,
    onNewMediaReady,
    initiateHireSequence,
    isCheckingBalance,
    showInsufficientFundsHint,
    setShowInsufficientFundsHint,
    selectPreset,
    loadAssistantForEdit,
    initiateUpdate: initiateUpdateSequence,
    isSubmitting,
    resetForm: resetFormAndHints,
  };
}
