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
  SocialAccount,
  UserLocalDesktop,
  AssistantHiringSufficientFunds,
} from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';
import { toast } from 'sonner';
import { Gender, SupportedLanguage } from '@cartesia/cartesia-js/api';
import voicePresetsConstant from '@/constants/assistants/voice_presets.js';
import { getCountryName, getCountryFlag } from '@/utils/assistants/country-utils';
import { getDefaultVoiceForProvider } from '@/utils/assistants/voice-utils';
import { AvailablePhoneCountry } from '@/types/assistants/assistant';
import {
  ASSISTANT_ONBOARDING_FEE,
  EMAIL_DOMAIN_WITH_AT,
  FALLBACK_DEFAULT_COUNTRY_CODE,
  PRIMARY_VOICE_PROVIDER,
} from '@/constants/assistants/settings';
import { ChatMessage } from '@/types/assistants/chat';
import { v4 as uuidv4 } from 'uuid';

export function useAssistantHireForm(
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

  const defaultVoice = getDefaultVoiceForProvider();

  const [availablePhoneCountries, setAvailablePhoneCountries] = React.useState<
    AvailablePhoneCountry[]
  >([]);
  const [isLoadingCountries, setIsLoadingCountries] = React.useState(true);
  const [editingAssistant, setEditingAssistant] = React.useState<Assistant | null>(null);

  const hireFormMethods = useForm<AssistantFormData>({
    mode: 'onSubmit',
    defaultValues: {
      firstName: '',
      surname: '',
      age: null,
      nationality: 'United States',
      about: '',
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
      email: null,
      isEmailAdded: false,
      emailManuallyEdited: false,
      userPhone: '',
      userPhoneIsVerified: false,
      userPhoneIsVerifying: false,
      userPhoneVerificationCodeSent: null,
      userPhoneVerificationSentAt: null,
      userPhoneVerificationAttempts: 0,
      userPhoneVerificationError: null,
      userWhatsappNumber: null,
      socialAccounts: [],
      phoneCountry: FALLBACK_DEFAULT_COUNTRY_CODE,
      photoFile: null,
      videoFile: null,
      profilePhotoUrl: null,
      profileVideoUrl: null,
      photoPreviewUrl: null,
      videoPreviewUrl: null,
      voiceId: defaultVoice.voiceId,
      voiceName: defaultVoice.name,
      voiceLanguage: defaultVoice.language as SupportedLanguage,
      voiceDescription: defaultVoice.description,
      voiceGender: defaultVoice.gender as Gender,
      voiceProvider: defaultVoice.provider || PRIMARY_VOICE_PROVIDER,
      voiceExists: false,
      isPresetPristine: false,
      presetOriginalValues: null,
      currentPreset: null,
      isPhoneNumberAdded: false,
      setup: 'remote',
      operatingSystem: 'ubuntu',
      videoSourceVoiceId: null,
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
  } = hireFormMethods;

  /* -------------------------
        General form utilities
    ------------------------- */
  React.useEffect(() => {
    async function loadCountries() {
      setIsLoadingCountries(true);
      try {
        const countries = await assistantActions.contact.listAvailablePhoneCountries();
        setAvailablePhoneCountries(countries);
        // Optionally set a default country from the fetched list if needed
        // For example, if the FALLBACK_DEFAULT_COUNTRY_CODE is not in the list, pick the first one
        if (
          countries.length > 0 &&
          !countries.find((c) => c.code === FALLBACK_DEFAULT_COUNTRY_CODE)
        ) {
          setValue('phoneCountry', countries[0].code);
        } else if (
          countries.length > 0 &&
          countries.find((c) => c.code === FALLBACK_DEFAULT_COUNTRY_CODE)
        ) {
          // Ensure the default value is set explicitly if it exists
          setValue('phoneCountry', FALLBACK_DEFAULT_COUNTRY_CODE);
        } else if (countries.length === 0) {
          throw new Error('No countries returned');
        }
      } catch (error) {
        // Fallback for error or empty list
        const usName = getCountryName('US') || 'United States';
        const usFlag = getCountryFlag('US');
        setAvailablePhoneCountries([{ code: 'US', name: usName, flag: usFlag }]);
        setValue('phoneCountry', 'US');
      } finally {
        setIsLoadingCountries(false);
      }
    }
    if (isDialogOpen) {
      loadCountries();
    }
  }, [isDialogOpen, setValue, assistantActions.contact]);

  const [isCheckingBalance, setIsCheckingBalance] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [showInsufficientFundsHint, setShowInsufficientFundsHint] = React.useState(false);
  const [fetchedAssistantEmails, setFetchedAssistantEmails] = React.useState<string[]>([]);
  const [isLoadingEmails, setIsLoadingEmails] = React.useState(false);

  React.useEffect(() => {
    if (isDialogOpen) {
      setIsLoadingEmails(true);
      assistantActions.contact
        .listAllAssistantEmails()
        .then((result) => {
          if (Array.isArray(result)) {
            setFetchedAssistantEmails(result);
          } else {
            setFetchedAssistantEmails([]);
          }
        })
        .catch((err) => {
          setFetchedAssistantEmails([]);
        })
        .finally(() => {
          setIsLoadingEmails(false);
        });
    }
  }, [assistantActions.contact, isDialogOpen]);

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
    'phoneCountry',
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
      phoneCountry,
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
      phoneCountry === originalValues.phoneCountry &&
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
      setValue('userPhone', '');
      setValue('userPhoneIsVerified', false);
      setValue('userPhoneIsVerifying', false);
      setValue('userPhoneVerificationCodeSent', null);
      setValue('userPhoneVerificationSentAt', null);
      setValue('userPhoneVerificationAttempts', 0);
      setValue('userPhoneVerificationError', null);
      setValue('socialAccounts', []);
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
        videoSourceVoiceId: providerSpecificVoiceId,
        profilePhotoUrl: preset.profilePhoto,
        phoneCountry: preset.phoneCountry || FALLBACK_DEFAULT_COUNTRY_CODE,
      };
      setValue('presetOriginalValues', originalValues);
      setValue('videoPreviewUrl', null);
      assistantActions.photo
        .downloadPresetVideo(preset.firstName, preset.surname, finalProvider)
        .then((res) => {
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
        firstName: values?.firstName || '',
        surname: values?.surname || '',
        age: values?.age || null,
        nationality: values?.nationality || 'United States',
        about: values?.about || '',
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC',
        email: null,
        isEmailAdded: false,
        emailManuallyEdited: false,
        userPhone: '',
        userPhoneIsVerified: false,
        userPhoneIsVerifying: false,
        userPhoneVerificationCodeSent: null,
        userPhoneVerificationSentAt: null,
        userPhoneVerificationAttempts: 0,
        userPhoneVerificationError: null,
        userWhatsappNumber: null,
        socialAccounts: [],
        phoneCountry: FALLBACK_DEFAULT_COUNTRY_CODE,
        photoFile: null,
        videoFile: null,
        profilePhotoUrl: null,
        profileVideoUrl: null,
        photoPreviewUrl: null,
        videoPreviewUrl: null,
        videoSourceVoiceId: null,
        voiceId: values?.voiceId || defaultVoice.voiceId,
        voiceName: values?.voiceName || defaultVoice.name,
        voiceLanguage: values?.voiceLanguage || (defaultVoice.language as SupportedLanguage),
        voiceDescription: values?.voiceDescription || defaultVoice.description,
        voiceGender: values?.voiceGender || (defaultVoice.gender as Gender),
        voiceExists: values?.voiceExists || false,
        voiceProvider: values?.voiceProvider || defaultVoice.provider || PRIMARY_VOICE_PROVIDER,
        isPresetPristine: false,
        presetOriginalValues: null,
        currentPreset: null,
        operatingSystem: 'ubuntu',
        designIncludeBio: false,
      });
      setShowInsufficientFundsHint(false);
    },
    [reset, defaultVoice]
  );

  /* ----------------------------
        Editing exsiting assistant
       ---------------------------- */
  const loadAssistantForEdit = React.useCallback(
    (assistant: Assistant) => {
      setEditingAssistant(assistant);
      const socialAccounts: SocialAccount[] = [];
      if (assistant.userWhatsappNumber) {
        socialAccounts.push({
          platform: 'whatsapp',
          identifier: assistant.userWhatsappNumber,
          isVerified: true,
          isInitial: true,
          isVerifying: false,
          verificationCodeSent: null,
          verificationSentAt: null,
          verificationAttempts: 0,
          verificationError: null,
        });
      }
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

        // Contact
        phoneCountry: assistant.phoneCountry || FALLBACK_DEFAULT_COUNTRY_CODE,
        userPhone: assistant.userPhone || '',
        userPhoneIsVerified: !!assistant.userPhone,
        socialAccounts: socialAccounts,
        isPhoneNumberAdded: !!assistant.phone,
        email: assistant.email || null,
        isEmailAdded: !!assistant.email,
        emailManuallyEdited: true, // Assume existing email was set

        // Voice
        voiceId: assistant.voiceId || undefined,
        voiceName: assistantVoiceDetails?.name,
        voiceDescription: assistantVoiceDetails?.description,
        voiceGender: assistantVoiceDetails?.gender,
        voiceLanguage: assistantVoiceDetails?.language,
        voiceProvider:
          assistant.voiceProvider || assistantVoiceDetails?.provider || PRIMARY_VOICE_PROVIDER,
        voiceExists: !!assistantVoiceDetails,

        // Advanced
        setup: assistant.userLocalDesktop ? 'local' : 'remote',
        operatingSystem: (assistant.userLocalDesktop as UserLocalDesktop | null) || 'ubuntu',
      });
      setShowInsufficientFundsHint(false);
    },
    [reset, getValues, registeredVoices]
  );

  const initiateUpdateSequence = reactHookFormHandleSubmit(async (data: AssistantFormData) => {
    if (!editingAssistant) {
      toast.error('No assistant selected for editing.');
      return;
    }
    setIsSubmitting(true);
    clearErrors();

    toastIdRef.current = toast.loading('Updating assistant...', { id: toastIdRef.current });

    try {
      // Validations
      if (data.isEmailAdded) {
        const emailValue = data.email;
        if (!emailValue || !emailValue.endsWith(EMAIL_DOMAIN_WITH_AT)) {
          setError('email', { type: 'manual', message: `Valid email is required.` });
          throw new Error(`Valid email ending with ${EMAIL_DOMAIN_WITH_AT} is required.`);
        }
      }
      if (data.isPhoneNumberAdded) {
        if (data.userPhone && !data.userPhoneIsVerified) {
          setError('userPhone', { type: 'manual', message: 'Your phone number must be verified.' });
          throw new Error('Your phone number must be verified.');
        }
      }
      if (
        data.socialAccounts &&
        data.socialAccounts.some((acc) => acc.identifier && !acc.isVerified)
      ) {
        toast.error('All added social accounts must be verified before saving.');
        throw new Error('Unverified social accounts.');
      }

      // Construct payload with only changed fields
      const payload: Partial<AssistantUpdatePayload> = {};

      if (data.about !== editingAssistant.about) payload.about = data.about;
      if (data.timezone !== editingAssistant.timezone) payload.timezone = data.timezone;
      if (data.voiceId !== editingAssistant.voiceId) payload.voiceId = data.voiceId;
      if (data.voiceProvider !== editingAssistant.voiceProvider)
        payload.voiceProvider = data.voiceProvider;
      const newVoiceMode = data.fastMode ? 'sts' : 'tts';
      if (newVoiceMode !== editingAssistant.voiceMode) payload.voiceMode = newVoiceMode;

      if (data.isEmailAdded) {
        if (data.email !== editingAssistant.email) {
          payload.email = data.email || null;
        }
      } else {
        // Email was removed
        if (editingAssistant.email !== null) {
          payload.email = null;
        }
      }

      if (data.isPhoneNumberAdded) {
        if (data.userPhone !== editingAssistant.userPhone)
          payload.userPhone = data.userPhone || null;
      }

      if (data.phoneCountry !== editingAssistant.phoneCountry) {
        payload.phoneCountry = data.phoneCountry;
      }

      const whatsappAccount = data.socialAccounts?.find(
        (acc) => acc.platform === 'whatsapp' && acc.isVerified
      );
      const userWhatsappNumber = whatsappAccount ? whatsappAccount.identifier : null;
      if (userWhatsappNumber !== editingAssistant.userWhatsappNumber)
        payload.userWhatsappNumber = userWhatsappNumber;

      const setupValue = data.setup === 'local' ? data.operatingSystem : null;
      if (setupValue !== (editingAssistant.userLocalDesktop || null)) {
        payload.userLocalDesktop = setupValue;
      }

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
      const isRHFError = !!(
        hireFormMethods.formState.errors.userPhone ||
        hireFormMethods.formState.errors.socialAccounts
      );
      if (!isRHFError)
        toast.error(`An error occurred while updating. Please try again.`, {
          id: toastIdRef.current,
        });
      else if (toastIdRef.current) toast.dismiss(toastIdRef.current);

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
          const greetingResponse = await fetch('/api/assistant/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              type: 'post-hire-greeting',
              assistantName: `${data.firstName} ${data.surname}`,
              assistantAge: data.age,
              assistantBio: data.about,
              assistantNationality: data.nationality,
              preHireChat: [],
            }),
          });
          if (!greetingResponse.ok)
            throw new Error("Failed to generate assistant's first message.");
          const { content } = await greetingResponse.json();
          if (!content) throw new Error('Generated an empty greeting.');
          finalChatHistory = [{ id: uuidv4(), role: 'assistant', content, timestamp: new Date() }];
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

      const userLocalDesktopPayload = (
        data.setup === 'local' ? data.operatingSystem : null
      ) as UserLocalDesktop | null;
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
        null,
        null,
        null,
        null,
        userLocalDesktopPayload,
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
        hireFormMethods.formState.errors.age ||
        hireFormMethods.formState.errors.email ||
        hireFormMethods.formState.errors.voiceId ||
        hireFormMethods.formState.errors.firstName ||
        hireFormMethods.formState.errors.surname ||
        hireFormMethods.formState.errors.about ||
        hireFormMethods.formState.errors.userPhone ||
        hireFormMethods.formState.errors.phoneCountry
      );

      if (!isRHFError) {
        toast.error(`an error occurred during the hiring process. Please try again.`, {
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
    if (isSubmitting || isCheckingBalance || isLoadingEmails || isLoadingCountries) {
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
    hireFormMethods,
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
    fetchedAssistantEmails,
    isLoadingEmails,
    availablePhoneCountries,
    isLoadingCountries,
  };
}
