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
} from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
import { Gender, SupportedLanguage } from '@cartesia/cartesia-js/api';
import voicePresetsConstant from '@/constants/assistants/voice_presets.js';
import {
  getCoordinatorFixedVoice,
  getDefaultVoiceForProvider,
} from '@/utils/assistants/voice-utils';
import { PRIMARY_VOICE_PROVIDER } from '@/constants/assistants/settings';
import { ChatMessage } from '@/types/assistants/chat';
import { v4 as uuidv4 } from 'uuid';
import { generatePostHireGreeting } from '@/lib/assistants/preHireChat';
import { fetchMediaSignedUrls } from '@/lib/client/assistant';
import { isGcsPhoto } from '@/utils/assistants/gcs-utils';

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
  // Ref to prevent double submissions (avoids stale closure issues)
  const isSubmittingRef = React.useRef(false);
  // Ref to track preset selection operations and ignore stale video downloads
  const presetOperationIdRef = React.useRef(0);
  // Ref to ignore stale signed-URL refreshes when rapidly switching assistants
  const editMediaRefreshRequestIdRef = React.useRef(0);

  const defaultVoice = getDefaultVoiceForProvider();
  const coordinatorFixedVoice = getCoordinatorFixedVoice();

  const [editingAssistant, setEditingAssistant] = React.useState<Assistant | null>(null);

  const formMethods = useForm<AssistantFormData>({
    mode: 'onSubmit',
    defaultValues: {
      // Profile fields
      firstName: '',
      surname: '',
      jobTitle: null,
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
  const [isCheckingBalance] = React.useState(false);
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
      ? voiceId === currentPreset.voiceIds[PRIMARY_VOICE_PROVIDER]
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

      setValue('setup', 'remote');
      setValue('currentPreset', preset);
      setValue('firstName', preset.firstName, { shouldValidate: true });
      setValue('surname', preset.surname, { shouldValidate: true });
      setValue('jobTitle', preset.jobTitle ?? null, { shouldValidate: true });
      setValue('age', preset.age, { shouldValidate: true });
      setValue('nationality', preset.nationality ?? 'United States', {
        shouldValidate: true,
      });
      setValue('about', preset.about ?? '', { shouldValidate: true });
      setValue('profilePhotoUrl', null);
      setValue('photoPreviewUrl', null);
      setValue('photoFile', null);
      setValue('videoFile', null);
      setValue('videoSourceVoiceId', null);
      assistantActions.photo
        .downloadPresetPhoto(preset.firstName, preset.surname)
        .then((res) => {
          if (presetOperationIdRef.current !== thisOperationId) return;
          if (res.signedUrl) {
            setValue('photoPreviewUrl', res.signedUrl);
            if (res.gcsUrl) {
              setValue('profilePhotoUrl', res.gcsUrl);
              const currentOriginal = getValues('presetOriginalValues');
              if (currentOriginal) {
                setValue('presetOriginalValues', {
                  ...currentOriginal,
                  profilePhotoUrl: res.gcsUrl,
                });
              }
            }
          }
        })
        .catch(() => {
          if (presetOperationIdRef.current !== thisOperationId) return;
        });
      setValue(
        'timezone',
        preset.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
      );

      const providerSpecificVoiceId = defaultVoice.voiceId;
      const selectedPresetVoiceDetails = {
        ...(defaultVoice as VoiceOption),
        isUserVoiceInOrchestra: false,
        isPreset: true,
      };

      setValue('voiceId', selectedPresetVoiceDetails.voiceId);
      setValue('voiceName', selectedPresetVoiceDetails.name);
      setValue('voiceDescription', selectedPresetVoiceDetails.description);
      setValue('voiceLanguage', selectedPresetVoiceDetails.language as SupportedLanguage);
      setValue('voiceGender', selectedPresetVoiceDetails.gender as Gender);
      setValue('voiceProvider', selectedPresetVoiceDetails.provider || PRIMARY_VOICE_PROVIDER);

      const voiceAlreadyExists = registeredVoices.some(
        (v) => v.voiceId === selectedPresetVoiceDetails.voiceId && v.isUserVoiceInOrchestra
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
        .downloadPresetVideo(preset.firstName, preset.surname, PRIMARY_VOICE_PROVIDER)
        .then((res) => {
          // Ignore stale video downloads from previous preset selections
          if (presetOperationIdRef.current !== thisOperationId) {
            return;
          }
          if (res.signedUrl) {
            setValue('videoPreviewUrl', res.signedUrl);
            setValue('videoSourceVoiceId', providerSpecificVoiceId);
            if (res.gcsUrl) {
              setValue('profileVideoUrl', res.gcsUrl);
            }
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
      getValues,
      handleMediaRemove,
      clearErrors,
      defaultVoice,
      assistantActions.photo,
      registeredVoices,
    ]
  );

  const resetFormAndHints = React.useCallback(
    (values?: AssistantFormData) => {
      reset({
        // Profile fields
        firstName: values?.firstName || '',
        surname: values?.surname || '',
        jobTitle: values?.jobTitle ?? null,
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
      const thisRequestId = editMediaRefreshRequestIdRef.current + 1;
      editMediaRefreshRequestIdRef.current = thisRequestId;

      setEditingAssistant(assistant);

      const assistantVoiceDetails = registeredVoices.find(
        (v) => v.voiceId === assistant.voiceId && v.provider === assistant.voiceProvider
      );
      const coordinatorVoiceExists = registeredVoices.some(
        (v) =>
          v.voiceId === coordinatorFixedVoice.voiceId &&
          v.provider === coordinatorFixedVoice.provider
      );
      const profilePhotoPath = assistant.profilePhoto ?? null;
      const profileVideoPath = assistant.profileVideo ?? null;
      const photoRefreshPath = profilePhotoPath ?? assistant.signedProfilePhotoUrl ?? null;
      const videoRefreshPath = profileVideoPath ?? assistant.signedProfileVideoUrl ?? null;
      const shouldRefreshPhotoPreview = isGcsPhoto(photoRefreshPath);
      const shouldRefreshVideoPreview = isGcsPhoto(videoRefreshPath);
      const initialPhotoPreviewUrl =
        assistant.signedProfilePhotoUrl || (shouldRefreshPhotoPreview ? null : photoRefreshPath);
      const initialVideoPreviewUrl =
        assistant.signedProfileVideoUrl || (shouldRefreshVideoPreview ? null : videoRefreshPath);

      reset({
        ...getValues(),

        // Profile
        firstName: assistant.isCoordinator ? 'Marty' : assistant.firstName,
        surname: assistant.isCoordinator ? '' : assistant.surname,
        jobTitle: assistant.jobTitle ?? null,
        age: assistant.age,
        nationality: assistant.nationality,
        about: assistant.about || '',
        timezone: assistant.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',

        // Media
        photoPreviewUrl: initialPhotoPreviewUrl,
        videoPreviewUrl: initialVideoPreviewUrl,
        profilePhotoUrl: profilePhotoPath ?? photoRefreshPath,
        profileVideoUrl: profileVideoPath ?? videoRefreshPath,
        photoFile: null,
        videoFile: null,

        // Voice
        voiceId: assistant.isCoordinator
          ? coordinatorFixedVoice.voiceId
          : assistant.voiceId || undefined,
        voiceName: assistant.isCoordinator
          ? coordinatorFixedVoice.name
          : assistantVoiceDetails?.name,
        voiceDescription: assistant.isCoordinator
          ? coordinatorFixedVoice.description
          : assistantVoiceDetails?.description,
        voiceGender: assistant.isCoordinator
          ? (coordinatorFixedVoice.gender as Gender)
          : assistantVoiceDetails?.gender,
        voiceLanguage: assistant.isCoordinator
          ? (coordinatorFixedVoice.language as SupportedLanguage)
          : assistantVoiceDetails?.language,
        voiceProvider:
          (assistant.isCoordinator
            ? coordinatorFixedVoice.provider
            : assistant.voiceProvider || assistantVoiceDetails?.provider) || PRIMARY_VOICE_PROVIDER,
        voiceExists: assistant.isCoordinator ? coordinatorVoiceExists : !!assistantVoiceDetails,

        // Setup
        setup: assistant.isUserDesktop ? 'local' : 'remote',
        operatingSystem: (assistant.desktopMode as DesktopMode | null) || 'ubuntu',
      });
      setShowInsufficientFundsHint(false);

      const gcsMediaPaths: string[] = [
        ...(shouldRefreshPhotoPreview && photoRefreshPath ? [photoRefreshPath] : []),
        ...(shouldRefreshVideoPreview && videoRefreshPath ? [videoRefreshPath] : []),
      ];

      if (gcsMediaPaths.length === 0) {
        return;
      }

      void (async () => {
        const signedUrlMap = await fetchMediaSignedUrls(gcsMediaPaths);
        if (editMediaRefreshRequestIdRef.current !== thisRequestId) {
          return;
        }

        if (shouldRefreshPhotoPreview && photoRefreshPath) {
          const refreshedPhotoPreviewUrl = signedUrlMap[photoRefreshPath];
          if (refreshedPhotoPreviewUrl) {
            setValue('photoPreviewUrl', refreshedPhotoPreviewUrl);
          } else if (!initialPhotoPreviewUrl) {
            setValue('photoPreviewUrl', null);
          }
        }
        if (shouldRefreshVideoPreview && videoRefreshPath) {
          const refreshedVideoPreviewUrl = signedUrlMap[videoRefreshPath];
          if (refreshedVideoPreviewUrl) {
            setValue('videoPreviewUrl', refreshedVideoPreviewUrl);
          } else if (!initialVideoPreviewUrl) {
            setValue('videoPreviewUrl', null);
          }
        }
      })();
    },
    [reset, getValues, registeredVoices, setValue, coordinatorFixedVoice]
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

    try {
      data.firstName = String(data.firstName ?? '').trim();
      data.surname = String(data.surname ?? '').trim();

      // Input validity checks (same as creation path)
      if (!data.firstName) {
        setError('firstName', {
          type: 'manual',
          message: 'Missing assistant first name.',
        });
        throw new Error('Missing assistant first name.');
      }
      const ageNumber = typeof data.age === 'string' ? parseInt(data.age, 10) : data.age;
      if (
        data.age != null &&
        (isNaN(ageNumber as number) || (ageNumber as number) < 18 || (ageNumber as number) > 70)
      ) {
        setError('age', {
          type: 'manual',
          message: 'Age must be between 18 and 70.',
        });
        throw new Error('Invalid age provided.');
      }
      if (!data.nationality) {
        setError('nationality', {
          type: 'manual',
          message: 'Missing assistant nationality.',
        });
        throw new Error('Missing assistant nationality.');
      }

      const fixedCoordinatorVoice = editingAssistant.isCoordinator ? coordinatorFixedVoice : null;
      const nextVoiceId = fixedCoordinatorVoice?.voiceId ?? data.voiceId;
      const nextVoiceProvider =
        fixedCoordinatorVoice?.provider ?? data.voiceProvider ?? PRIMARY_VOICE_PROVIDER;
      const nextVoiceName = fixedCoordinatorVoice?.name ?? data.voiceName!;
      const nextVoiceDescription =
        fixedCoordinatorVoice?.description ?? data.voiceDescription ?? data.voiceName!;
      const nextVoiceGender = (fixedCoordinatorVoice?.gender ?? data.voiceGender!) as Gender;
      const nextVoiceLanguage = (fixedCoordinatorVoice?.language ??
        data.voiceLanguage!) as SupportedLanguage;
      const nextVoiceExists =
        fixedCoordinatorVoice !== null
          ? registeredVoices.some(
              (v) =>
                v.voiceId === fixedCoordinatorVoice.voiceId &&
                v.provider === fixedCoordinatorVoice.provider
            )
          : data.voiceExists;

      // Construct payload with only changed fields
      // Note: Contact details (email, phone, whatsapp) are managed via AssistantContactManager
      const payload: Partial<AssistantUpdatePayload> = {};

      if (!editingAssistant.isCoordinator) {
        if (data.firstName !== editingAssistant.firstName) payload.firstName = data.firstName;
        if (data.surname !== editingAssistant.surname) payload.surname = data.surname;
      }
      // Normalize empty string to null so an emptied input clears the value
      // server-side (the backend trims/normalizes too, but be explicit).
      const normalizedJobTitle = data.jobTitle?.trim() ? data.jobTitle.trim() : null;
      if (normalizedJobTitle !== (editingAssistant.jobTitle ?? null)) {
        payload.jobTitle = normalizedJobTitle;
      }
      if (data.age !== editingAssistant.age) payload.age = data.age ?? undefined;
      if (data.nationality !== editingAssistant.nationality) payload.nationality = data.nationality;
      if (data.about !== editingAssistant.about) payload.about = data.about;
      if (data.timezone !== editingAssistant.timezone) payload.timezone = data.timezone;
      // Orchestra requires both voice_id and voice_provider together — always
      // send them as a pair when either one has changed.
      const voiceIdChanged = nextVoiceId !== editingAssistant.voiceId;
      const voiceProviderChanged = nextVoiceProvider !== editingAssistant.voiceProvider;
      const voiceChanged = fixedCoordinatorVoice !== null || voiceIdChanged || voiceProviderChanged;
      if (voiceChanged) {
        payload.voiceId = nextVoiceId;
        payload.voiceProvider = nextVoiceProvider;
      }
      // Note: isUserDesktop and desktopMode are set at creation time only and cannot be updated

      // Image/Video upload logic — include assistant_id so files are stored
      // under the correct assistant-centric GCS path.
      const editAssistantId = String(editingAssistant.agentId);
      if (data.photoFile) {
        const formData = new FormData();
        formData.append('file', data.photoFile);
        formData.append('assistant_id', editAssistantId);
        const photoUploadResult = await assistantActions.photo.uploadPhoto(formData);
        if ((photoUploadResult as ResponseProps).detail)
          throw new Error(`Photo upload failed: ${(photoUploadResult as ResponseProps).detail}`);
        payload.profilePhoto = (photoUploadResult as PhotoUploadResponse).gcsUrl;
      }
      if (data.videoFile) {
        const formData = new FormData();
        formData.append('file', data.videoFile);
        formData.append('assistant_id', editAssistantId);
        const videoUploadResult = await assistantActions.photo.uploadVideo(formData);
        if ((videoUploadResult as ResponseProps).detail)
          throw new Error(`Video upload failed: ${(videoUploadResult as ResponseProps).detail}`);
        payload.profileVideo = (videoUploadResult as PhotoUploadResponse).gcsUrl;
      }

      if (voiceChanged && nextVoiceId && !nextVoiceExists) {
        const provider = nextVoiceProvider || defaultVoice.provider || PRIMARY_VOICE_PROVIDER;
        const isPresetVoice = voicePresetsConstant.some(
          (voice) => voice.voiceId === nextVoiceId && voice.provider === provider
        );
        const voiceCreationResponse = await assistantActions.voice.register(
          nextVoiceId,
          provider,
          nextVoiceName,
          nextVoiceDescription,
          nextVoiceGender,
          nextVoiceLanguage,
          isPresetVoice
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
          console.error(
            `[useAssistantForm] Failed to update assistant ${editingAssistant.agentId}:`,
            (updateResult as ResponseProps).detail
          );
          throw new Error('Failed to update assistant.');
        }
        toast.success(`Assistant ${data.firstName} updated!`);
      } else {
        toast.info('No changes to save.');
      }

      if (onUpdateSuccess) onUpdateSuccess(payload);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to update assistant.');
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

    try {
      data.firstName = String(data.firstName ?? '').trim();
      data.surname = String(data.surname ?? '').trim();

      // Input validity checks
      if (!data.firstName) {
        setError('firstName', {
          type: 'manual',
          message: 'Missing assistant first name.',
        });
        throw new Error('Missing assistant first name.');
      }
      const ageNumber = typeof data.age === 'string' ? parseInt(data.age, 10) : data.age;
      if (
        data.age != null &&
        (isNaN(ageNumber as number) || (ageNumber as number) < 18 || (ageNumber as number) > 70)
      ) {
        setError('age', {
          type: 'manual',
          message: 'Age must be between 18 and 70.',
        });
        throw new Error('Invalid age provided.');
      }
      if (!data.nationality) {
        setError('nationality', {
          type: 'manual',
          message: 'Missing assistant nationality.',
        });
        throw new Error('Missing assistant nationality.');
      }

      if (!data.voiceId || !data.voiceName || !data.voiceGender || !data.voiceLanguage) {
        setError('voiceId', {
          type: 'manual',
          message: 'Voice selection is required.',
        });
        throw new Error('No voice selected.');
      }

      const assistantDisplayName = [data.firstName, data.surname].filter(Boolean).join(' ');

      // Generate initial greeting if no pre-hire chat exists
      let finalChatHistory = chatHistory;
      if (!chatHistory || chatHistory.length === 0) {
        try {
          const greetingResult = await generatePostHireGreeting(
            assistantDisplayName,
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

      // Register voice if needed
      const voiceProviderVal =
        data?.voiceProvider || defaultVoice.provider || PRIMARY_VOICE_PROVIDER;
      if (!data.voiceExists && data.voiceId) {
        const voiceCreationResponse = await assistantActions.voice.register(
          data.voiceId,
          voiceProviderVal,
          data.voiceName!,
          data.voiceDescription || data.voiceName!,
          data.voiceGender!,
          data.voiceLanguage!,
          voicePresetsConstant.map((v) => v.voiceId).includes(data.voiceId)
        );
        if (
          'detail' in voiceCreationResponse &&
          !voiceCreationResponse.detail?.includes('already exists')
        ) {
          throw new Error(
            `Error registering voice: ${(voiceCreationResponse as ResponseProps).detail}`
          );
        }
      }

      // For presets, use the preset URLs directly.
      // For custom file uploads, pass null — we upload after getting the assistant_id.
      let finalImageUrlToSend: string | null = data.profilePhotoUrl || null;
      let finalVideoUrlToSend: string | null = data.profileVideoUrl || null;

      if (data.isPresetPristine) {
        finalImageUrlToSend = data.profilePhotoUrl ?? null;
        finalVideoUrlToSend = data.profileVideoUrl ?? null;
      } else {
        // Custom uploads will happen after assistant creation, so pass null
        if (data.photoFile) finalImageUrlToSend = null;
        if (data.videoFile) finalVideoUrlToSend = null;
      }

      const isUserDesktop = data.setup === 'local';
      const desktopModePayload = data.operatingSystem as DesktopMode;
      const formattedPreHireChat = finalChatHistory?.map(({ role, content }) => ({
        role,
        msg: content,
      }));

      // Create assistant first to get the assistant_id
      const normalizedJobTitle = data.jobTitle?.trim() ? data.jobTitle.trim() : null;
      const assistantCreationResult = await assistantActions.assistant.create(
        data.firstName,
        data.surname,
        normalizedJobTitle,
        ageNumber,
        data.nationality,
        data.timezone,
        finalImageUrlToSend,
        finalVideoUrlToSend,
        data.about,
        data.voiceId,
        voiceProviderVal,
        isUserDesktop,
        desktopModePayload,
        formattedPreHireChat
      );

      if (!('assistant' in assistantCreationResult) || !assistantCreationResult.assistant) {
        const errorDetail =
          (assistantCreationResult as ResponseProps).detail ||
          'Failed to hire assistant (unknown error)';
        throw new Error(errorDetail);
      }

      const createdAssistant = assistantCreationResult.assistant;
      const assistantId = String(createdAssistant.agentId);

      // Upload custom photo/video with assistant_id so files are stored
      // under the correct assistant-centric GCS path ({assistant_id}/{media_type}/{filename}).
      const mediaUpdate: Partial<AssistantUpdatePayload> = {};

      if (data.photoFile) {
        const photoFormData = new FormData();
        photoFormData.append('file', data.photoFile);
        photoFormData.append('assistant_id', assistantId);
        const photoUploadResult = await assistantActions.photo.uploadPhoto(photoFormData);
        if ((photoUploadResult as ResponseProps).detail)
          throw new Error(`Photo upload failed: ${(photoUploadResult as ResponseProps).detail}`);
        mediaUpdate.profilePhoto = (photoUploadResult as PhotoUploadResponse).gcsUrl;
      }

      if (data.videoFile) {
        const videoFormData = new FormData();
        videoFormData.append('file', data.videoFile);
        videoFormData.append('assistant_id', assistantId);
        const videoUploadResult = await assistantActions.photo.uploadVideo(videoFormData);
        if ((videoUploadResult as ResponseProps).detail)
          throw new Error(`Video upload failed: ${(videoUploadResult as ResponseProps).detail}`);
        mediaUpdate.profileVideo = (videoUploadResult as PhotoUploadResponse).gcsUrl;
      }

      // Update assistant with the uploaded media URLs
      if (Object.keys(mediaUpdate).length > 0) {
        const updateResult = await assistantActions.assistant.update(assistantId, mediaUpdate);
        if ((updateResult as ResponseProps).detail) {
          console.error(
            `Failed to update assistant media: ${(updateResult as ResponseProps).detail}`
          );
        }
      }

      const assistantForSuccess: Assistant = {
        ...createdAssistant,
        isCoordinator: createdAssistant.isCoordinator ?? false,
        ...(finalImageUrlToSend ? { profilePhoto: finalImageUrlToSend } : {}),
        ...(finalVideoUrlToSend ? { profileVideo: finalVideoUrlToSend } : {}),
        ...(mediaUpdate.profilePhoto ? { profilePhoto: mediaUpdate.profilePhoto } : {}),
        ...(mediaUpdate.profileVideo ? { profileVideo: mediaUpdate.profileVideo } : {}),
      };

      toast.success(`Assistant ${assistantDisplayName} hired!`);
      resetFormAndHints();
      if (onHireSuccess) onHireSuccess(assistantForSuccess, data, finalChatHistory);
    } catch (error: any) {
      const isRHFError = !!(
        formMethods.formState.errors.age ||
        formMethods.formState.errors.voiceId ||
        formMethods.formState.errors.firstName ||
        formMethods.formState.errors.surname ||
        formMethods.formState.errors.about
      );

      if (!isRHFError) {
        toast.error(`An error occurred during the hiring process. Please try again.`);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const RHFSubmitHandler = (chatHistory?: ChatMessage[]) =>
    reactHookFormHandleSubmit((data) => submitAssistantData(data, chatHistory));

  const initiateHireSequence = async (chatHistory?: ChatMessage[]) => {
    if (isSubmitting) {
      return;
    }

    const isValid = await trigger();
    if (!isValid) {
      return;
    }

    setShowInsufficientFundsHint(false);

    await RHFSubmitHandler(chatHistory)();
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
