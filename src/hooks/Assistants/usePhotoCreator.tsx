'use client';

import * as React from 'react';
import { toast } from 'sonner';
import { StopCircle } from 'lucide-react';
import {
  AssistantActions,
  GenerateSpeechPayload,
  PhotoCreationResponse,
  ReplicatePredictionResponse,
  VoiceOption,
} from '@/types/assistants/assistant';
import { ResponseProps } from '@/types/common';
import { SupportedLanguage } from '@cartesia/cartesia-js/api';
import { getAudioDuration, getRandomSampleLine } from '@/utils/assistants/voice-utils';
import { Button } from '@/components/UI/button';

const ANIMATION_POLLING_INTERVAL = 5000;

// Helper to convert Base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

const fetchBalance = async (): Promise<number> => {
  try {
    const balanceData = await fetch(`/api/billing/balance`).then((res) => res.json());
    if (balanceData && typeof balanceData.fullBalance === 'number') {
      return balanceData.fullBalance;
    }
    return 0;
  } catch (error) {
    toast.error('Could not verify your credit balance.');
    return 0;
  }
};

const AnimationProgressToast = ({
  onCancel,
}: {
  onCancel: (event: React.MouseEvent<HTMLButtonElement>) => void;
}) => {
  const [dots, setDots] = React.useState('.');
  const [progress, setProgress] = React.useState(0);

  React.useEffect(() => {
    const dotsInterval = setInterval(() => {
      setDots((prev) => (prev.length >= 3 ? '.' : prev + '.'));
    }, 500);

    const progressInterval = setInterval(() => {
      setProgress((prev) => {
        const newProgress = prev + (100 - prev) / 2;
        // Stop interval when we are very close to 100 to prevent it from running indefinitely
        if (newProgress > 99) {
          clearInterval(progressInterval);
          return 99;
        }
        return newProgress;
      });
    }, ANIMATION_POLLING_INTERVAL);

    return () => {
      clearInterval(dotsInterval);
      clearInterval(progressInterval);
    };
  }, []);

  return (
    <div className="group pointer-events-auto relative flex w-full items-center justify-between space-x-4 overflow-hidden rounded-md border bg-background p-4 pr-6 text-foreground shadow-lg">
      <div className="flex flex-grow flex-col gap-1.5">
        <div className="text-title text-semibold">Animating photo{dots}</div>
        <div className="text-body opacity-90">This can take up to a minute.</div>
        <div className="relative mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="absolute left-0 top-0 h-full rounded-full bg-primary transition-all duration-1000 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
      <Button
        onClick={onCancel}
        aria-label="Cancel animation"
        variant={'warningOutline'}
        type="button"
        className="absolute right-2 top-2 border-none"
      >
        <StopCircle className="h-5 w-5 hover:text-amber-500" />
      </Button>
    </div>
  );
};

export function usePhotoCreator(
  photoActions: AssistantActions['photo'],
  generateSpeechAction: AssistantActions['voice']['generate'],
  onNewMediaReady: (
    file: File | null,
    mediaType: 'photo' | 'video',
    metadata?: { voiceId?: string }
  ) => void,
  photoOperationCost: number,
  videoAnimationCost: number,
  selectedVoice: VoiceOption | null,
  firstName?: string | null,
  surname?: string | null,
  age?: number | null
) {
  const [prompt, setPrompt] = React.useState(
    'A photorealistic portrait of a friendly-looking person, studio lighting...'
  );

  const initialTtsPrompt = React.useMemo(() => {
    if (selectedVoice?.language) {
      return getRandomSampleLine(selectedVoice.language);
    }
    return 'Hi there! How can I help you today?';
  }, [selectedVoice]);

  const [ttsPrompt, setTtsPrompt] = React.useState(initialTtsPrompt);
  const [isProcessing, setIsProcessing] = React.useState(false);
  const pollIntervalRef = React.useRef<NodeJS.Timeout | null>(null);
  const toastIdRef = React.useRef<string | number | undefined>();
  const isProcessingRef = React.useRef(isProcessing);

  // Operation ID to track and ignore stale operations
  const operationIdRef = React.useRef(0);
  // Captured voice for animation (to avoid stale closure issues)
  const capturedVoiceIdRef = React.useRef<string | null>(null);

  // Track the previous voice language to update ttsPrompt only on language change
  const prevVoiceLanguageRef = React.useRef<string | undefined>(selectedVoice?.language);
  React.useEffect(() => {
    const currentLanguage = selectedVoice?.language;
    if (currentLanguage && currentLanguage !== prevVoiceLanguageRef.current) {
      setTtsPrompt(getRandomSampleLine(currentLanguage));
    }
    prevVoiceLanguageRef.current = currentLanguage;
  }, [selectedVoice?.language]);

  React.useEffect(() => {
    isProcessingRef.current = isProcessing;
  }, [isProcessing]);

  // Cleanup polling on unmount
  React.useEffect(() => {
    return () => {
      if (pollIntervalRef.current) {
        clearTimeout(pollIntervalRef.current);
      }
      if (toastIdRef.current) {
        toast.dismiss(toastIdRef.current);
      }
    };
  }, []);

  const insufficientFundsToast = (operationName: string) => {
    toast.error(`Insufficient funds for AI photo ${operationName}.`, {
      description: 'Please recharge your account to continue.',
      action: {
        label: 'Go to Billing',
        onClick: () => window.open('/billing', '_blank'),
      },
    });
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt to generate a photo.');
      return;
    }

    // Prevent concurrent operations
    if (isProcessingRef.current) {
      return;
    }

    // Increment operation ID to track this specific operation
    operationIdRef.current += 1;
    const thisOperationId = operationIdRef.current;

    setIsProcessing(true);
    const toastId = toast.loading('Checking your balance...');

    const currentBalance = await fetchBalance();

    // Check if this operation is still current
    if (operationIdRef.current !== thisOperationId) {
      toast.dismiss(toastId);
      return;
    }

    if (currentBalance < photoOperationCost) {
      insufficientFundsToast('generation');
      toast.dismiss(toastId);
      setIsProcessing(false);
      return;
    }

    toast.loading('Generating photo...', { id: toastId });

    const description = prompt;
    const finalPromptParts = [];
    if (firstName && surname) {
      finalPromptParts.push(`Name: ${firstName} ${surname}`);
    }
    if (age) {
      finalPromptParts.push(`Age: ${age}`);
    }
    finalPromptParts.push(`Description: ${description}`);
    const finalPrompt = finalPromptParts.join('\n');

    try {
      const result = await photoActions.generate({ prompt: finalPrompt });

      // Check if this operation is still current
      if (operationIdRef.current !== thisOperationId) {
        toast.dismiss(toastId);
        return;
      }

      if ((result as ResponseProps).detail) {
        throw new Error((result as ResponseProps).detail);
      }
      const newUrl = (result as PhotoCreationResponse).url;

      toast.loading('Processing generated image...', { id: toastId });
      const imageResponse = await fetch(newUrl);

      // Check again after async operation
      if (operationIdRef.current !== thisOperationId) {
        toast.dismiss(toastId);
        return;
      }

      if (!imageResponse.ok) throw new Error('Failed to download the generated image.');

      const blob = await imageResponse.blob();
      const filename = newUrl.substring(newUrl.lastIndexOf('/') + 1) || 'ai-generated-photo.jpg';
      const imageFile = new File([blob], filename, { type: blob.type });

      onNewMediaReady(imageFile, 'photo');
      toast.success('Photo generated successfully!', { id: toastId });
    } catch (error: any) {
      // Only show error if this operation is still current
      if (operationIdRef.current === thisOperationId) {
        toast.error(`Photo generation failed.`, { id: toastId });
      }
    } finally {
      // Only update state if this operation is still current
      if (operationIdRef.current === thisOperationId) {
        setIsProcessing(false);
      }
    }
  };

  const handleEdit = async (imageSource: File | string) => {
    if (!prompt.trim()) {
      toast.error('Please enter a prompt to edit the photo.');
      return;
    }
    if (!imageSource) {
      toast.error('An existing photo is required for editing.');
      return;
    }

    // Prevent concurrent operations
    if (isProcessingRef.current) {
      return;
    }

    // Increment operation ID to track this specific operation
    operationIdRef.current += 1;
    const thisOperationId = operationIdRef.current;

    setIsProcessing(true);
    const toastId = toast.loading('Checking your balance...');

    const currentBalance = await fetchBalance();

    // Check if this operation is still current
    if (operationIdRef.current !== thisOperationId) {
      toast.dismiss(toastId);
      return;
    }

    if (currentBalance < photoOperationCost) {
      insufficientFundsToast('editing');
      toast.dismiss(toastId);
      setIsProcessing(false);
      return;
    }

    toast.loading('Editing photo...', { id: toastId });

    try {
      const formData = new FormData();
      formData.append('prompt', prompt);
      formData.append('aspect_ratio', 'match_input_image');
      formData.append('output_format', 'jpg');
      formData.append('safety_tolerance', '2.0');

      if (imageSource instanceof File) {
        formData.append('input_image_file', imageSource);
      } else if (typeof imageSource === 'string') {
        if (imageSource.startsWith('blob:')) {
          throw new Error(
            'Cannot edit a local photo preview. Please use a saved or generated photo.'
          );
        }
        formData.append('input_image_url', imageSource);
      }

      const result = await photoActions.edit(formData);

      // Check if this operation is still current
      if (operationIdRef.current !== thisOperationId) {
        toast.dismiss(toastId);
        return;
      }

      if ((result as ResponseProps).detail) {
        throw new Error((result as ResponseProps).detail);
      }

      const newUrl = (result as PhotoCreationResponse).url;

      toast.loading('Processing edited image...', { id: toastId });
      const imageResponse = await fetch(newUrl);

      // Check again after async operation
      if (operationIdRef.current !== thisOperationId) {
        toast.dismiss(toastId);
        return;
      }

      if (!imageResponse.ok) throw new Error('Failed to download the edited image.');

      const blob = await imageResponse.blob();
      const filename = newUrl.substring(newUrl.lastIndexOf('/') + 1) || 'ai-edited-photo.jpg';
      const imageFile = new File([blob], filename, { type: blob.type });

      onNewMediaReady(imageFile, 'photo');
      toast.success('Photo edited successfully!', { id: toastId });
    } catch (error: any) {
      // Only show error if this operation is still current
      if (operationIdRef.current === thisOperationId) {
        toast.error(`Photo editing failed.`, { id: toastId });
      }
    } finally {
      // Only update state if this operation is still current
      if (operationIdRef.current === thisOperationId) {
        setIsProcessing(false);
      }
    }
  };

  const handleAnimate = async (imageSource: File | string) => {
    if (!ttsPrompt.trim()) {
      toast.error("Please enter text for the animation's audio.");
      return;
    }
    if (!imageSource) {
      toast.error('An existing photo is required for animation.');
      return;
    }
    if (!selectedVoice || !selectedVoice.provider || !selectedVoice.language) {
      toast.error(
        'A complete voice (with provider and language) must be selected to generate audio for animation.'
      );
      return;
    }

    // Prevent concurrent operations
    if (isProcessingRef.current) {
      return;
    }

    // Increment operation ID to track this specific operation
    operationIdRef.current += 1;
    const thisOperationId = operationIdRef.current;

    // Capture the voice ID at start time to avoid stale closure issues
    capturedVoiceIdRef.current = selectedVoice.voiceId;

    setIsProcessing(true);
    toastIdRef.current = toast.loading('Generating video speech...');

    try {
      const ttsPayload: GenerateSpeechPayload = {
        text: ttsPrompt,
        provider: selectedVoice.provider,
        voiceId: selectedVoice.voiceId,
        outputFormat: 'mp3',
        ...(selectedVoice.provider === 'cartesia' && {
          modelId: 'sonic-2',
          cartesiaLanguage: selectedVoice.language as SupportedLanguage,
        }),
        ...(selectedVoice.provider === 'elevenlabs' && { modelId: 'eleven_multilingual_v2' }),
      };

      const ttsResult = await generateSpeechAction(ttsPayload);

      // Check if this operation is still current
      if (operationIdRef.current !== thisOperationId) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = undefined;
        return;
      }

      if (ttsResult.detail || !ttsResult.audioBase64 || !ttsResult.contentType) {
        throw new Error(ttsResult.detail || 'TTS generation failed for animation.');
      }

      const audioUint8Array = base64ToUint8Array(ttsResult.audioBase64) as any;
      const audioFile = new File([audioUint8Array], 'tts_audio_for_animation.mp3', {
        type: ttsResult.contentType,
      });
      let audioDuration = 0;
      try {
        audioDuration = await getAudioDuration(audioFile);
      } catch (e) {
        /* no-op */
      }

      toast.loading('Checking your balance...', { id: toastIdRef.current });

      const currentBalance = await fetchBalance();

      // Check if this operation is still current
      if (operationIdRef.current !== thisOperationId) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = undefined;
        return;
      }

      if (currentBalance < videoAnimationCost * (audioDuration > 0 ? audioDuration : 1)) {
        insufficientFundsToast('animation');
        setIsProcessing(false);
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = undefined;
        return;
      }

      toast.loading('Starting animation job...', { id: toastIdRef.current });

      const formData = new FormData();
      formData.append('audio_file', audioFile);
      if (imageSource instanceof File) {
        formData.append('image_file', imageSource);
      } else if (typeof imageSource === 'string') {
        if (imageSource.startsWith('blob:')) {
          throw new Error(
            'Cannot animate a local photo preview. Please use a saved or generated photo.'
          );
        }
        formData.append('imageUrl', imageSource);
      }
      if (audioDuration > 0) {
        // Replicate only accepts duration of 5 or 10
        formData.append('duration', (audioDuration <= 5 ? 5 : 10).toString());
      }

      const createResult = await photoActions.animate(formData);

      // Check if this operation is still current
      if (operationIdRef.current !== thisOperationId) {
        toast.dismiss(toastIdRef.current);
        toastIdRef.current = undefined;
        return;
      }

      if ('detail' in createResult) {
        throw new Error(createResult.detail);
      }

      const prediction = createResult as ReplicatePredictionResponse;

      const stopPolling = () => {
        if (pollIntervalRef.current) {
          clearTimeout(pollIntervalRef.current);
          pollIntervalRef.current = null;
        }
      };

      const handleCancel = async (event: React.MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();
        stopPolling();
        setIsProcessing(false);

        if (toastIdRef.current) {
          toast.dismiss(toastIdRef.current);
          toastIdRef.current = undefined;
        }

        const cancelToastId = toast.loading('Canceling animation...');

        try {
          await photoActions.cancelAnimation(prediction.id);
          toast.success('Animation canceled.', { id: cancelToastId, duration: 4000 });
        } catch (e) {
          toast.error('Failed to cancel animation.', { id: cancelToastId, duration: 4000 });
        }
      };

      toast.custom(
        (t) => {
          toastIdRef.current = t;
          return <AnimationProgressToast onCancel={handleCancel} />;
        },
        {
          id: toastIdRef.current,
          duration: Infinity,
          className: 'w-full p-0 bg-transparent rounded-md border shadow-lg',
        }
      );

      const poll = async () => {
        // Check if this operation is still current
        if (!isProcessingRef.current || operationIdRef.current !== thisOperationId) {
          stopPolling();
          return;
        }

        try {
          const statusResult = await photoActions.getAnimation(prediction.id);

          // Check again after async operation
          if (operationIdRef.current !== thisOperationId) {
            stopPolling();
            return;
          }

          if ('detail' in statusResult) {
            pollIntervalRef.current = setTimeout(poll, 20000);
            return;
          }

          const currentStatus = statusResult as ReplicatePredictionResponse;

          if (currentStatus.status === 'succeeded') {
            stopPolling();

            if (toastIdRef.current)
              toast.loading('Finalizing video...', { id: toastIdRef.current });

            const output = currentStatus.output;
            let outputUrl: string | null = null;

            if (Array.isArray(output) && output.length > 0 && typeof output[0] === 'string') {
              outputUrl = output[0];
            } else if (typeof output === 'string' && output.trim() !== '') {
              outputUrl = output;
            }

            if (!outputUrl) {
              toast.error('Animation succeeded but the video URL was missing or invalid.', {
                id: toastIdRef.current,
              });
              toastIdRef.current = undefined;
              setIsProcessing(false);
              return;
            }

            const videoFetchResponse = await fetch(outputUrl);

            // Check again after fetch
            if (operationIdRef.current !== thisOperationId) {
              stopPolling();
              return;
            }

            if (!videoFetchResponse.ok) {
              toast.error('Failed to retrieve the final video.', { id: toastIdRef.current });
              toastIdRef.current = undefined;
              setIsProcessing(false);
              return;
            }

            const videoBlob = await videoFetchResponse.blob();
            const videoFilename =
              outputUrl.substring(outputUrl.lastIndexOf('/') + 1) || 'ai-animated-video.mp4';
            const newVideoFile = new File([videoBlob], videoFilename, {
              type: videoBlob.type || 'video/mp4',
            });

            // Use the captured voice ID from when animation started
            onNewMediaReady(newVideoFile, 'video', { voiceId: capturedVoiceIdRef.current! });
            if (toastIdRef.current)
              toast.success('Animation complete! Your video is now available.', {
                id: toastIdRef.current,
                duration: 4000,
              });
            setIsProcessing(false);
            toastIdRef.current = undefined;
          } else if (currentStatus.status === 'failed' || currentStatus.status === 'canceled') {
            stopPolling();
            if (toastIdRef.current) {
              if (currentStatus.status === 'failed') {
                toast.error(`Animation failed. Please try again.`, {
                  id: toastIdRef.current,
                  duration: 5000,
                });
              } else {
                toast.info('Animation was canceled.', { id: toastIdRef.current, duration: 5000 });
              }
            }
            toastIdRef.current = undefined;
            setIsProcessing(false);
          } else {
            pollIntervalRef.current = setTimeout(poll, 20000);
          }
        } catch (pollError) {
          stopPolling();
          // Only show error if this operation is still current
          if (operationIdRef.current === thisOperationId && toastIdRef.current) {
            toast.error('An error occurred while checking animation status.', {
              id: toastIdRef.current,
              duration: 5000,
            });
            toastIdRef.current = undefined;
          }
          if (operationIdRef.current === thisOperationId) {
            setIsProcessing(false);
          }
        }
      };

      pollIntervalRef.current = setTimeout(poll, ANIMATION_POLLING_INTERVAL);
    } catch (error: any) {
      // Only show error if this operation is still current
      if (operationIdRef.current === thisOperationId) {
        if (toastIdRef.current) {
          toast.error('Failed to start animation. Please try again.', { id: toastIdRef.current });
        }
        toastIdRef.current = undefined;
        setIsProcessing(false);
      }
    }
  };

  return {
    prompt,
    setPrompt,
    ttsPrompt,
    setTtsPrompt,
    isProcessing,
    handleGenerate,
    handleEdit,
    handleAnimate,
  };
}
