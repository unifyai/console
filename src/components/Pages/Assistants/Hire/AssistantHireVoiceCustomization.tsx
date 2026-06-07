'use client';

import * as React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/UI/tabs';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Textarea } from '@/components/UI/textarea';
import { Label } from '@/components/UI/label';
import { toast } from 'sonner';
import {
  AssistantActions,
  VoiceOption,
  VoiceDesignPreviewItem,
  AssistantFormData,
} from '@/types/assistants/assistant';
import {
  Trash2,
  UploadCloud,
  Loader2,
  Info,
  CheckCircle2,
  Play,
  Wand2,
  MicVocal,
  PauseCircle,
  PlayCircle,
  Mic,
  Square,
  Clapperboard,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/UI/tooltip';
import { VoiceListItemSkeleton } from './AssistantHireVoiceItemSkeleton';
import { Checkbox } from '@/components/UI/checkbox';
import { useFormContext, Controller } from 'react-hook-form';
import { useVoiceCreator } from '@/hooks/Assistants/useVoiceCreator';
import { useTTSPreview } from '@/hooks/Assistants/useTTSPreview';
import { BillableActionGuard } from '@/components/Billing/BillableActionGuard';
import {
  PRIMARY_VOICE_PROVIDER,
  DESIGN_VOICE_DESC_MIN_LENGTH,
  DESIGN_VOICE_DESC_MAX_LENGTH,
  DESIGN_SAMPLE_TEXT_MIN_LENGTH,
  DESIGN_SAMPLE_TEXT_MAX_LENGTH,
} from '@/constants/assistants/settings';

export type ActiveCreatorTab = 'select' | 'clone' | 'design';

interface VoiceCustomizationProps {
  assistantActions: AssistantActions;
  onVoiceSelected: (selectedVoice: VoiceOption | null) => void;
  initialVoiceId?: string | null;
  disabled?: boolean;
  onProcessingStateChange?: (isProcessing: boolean) => void;
  allDisplayableVoices: VoiceOption[];
  isLoadingUserVoices: boolean;
  fetchUserVoices: () => void;
  handleDeleteVoice: (voice: VoiceOption) => Promise<void>;
  /** Callback to open the Stripe side panel for payment setup */
  onAddPaymentMethod?: () => void;
  /** Active voice tab – controlled from the parent, matching photo-tabs pattern */
  activeTab: ActiveCreatorTab;
  /** Setter for the active voice tab */
  setActiveTab: (tab: ActiveCreatorTab) => void;
}

export function VoiceCustomization({
  assistantActions,
  onVoiceSelected,
  initialVoiceId = null,
  disabled = false,
  onProcessingStateChange,
  allDisplayableVoices,
  isLoadingUserVoices,
  fetchUserVoices,
  handleDeleteVoice,
  onAddPaymentMethod,
  activeTab: activeMainTab,
  setActiveTab: setActiveMainTab,
}: VoiceCustomizationProps) {
  const [selectedVoiceId, setSelectedVoiceId] = React.useState<string | null>(initialVoiceId);

  const { control, watch } = useFormContext<AssistantFormData>();
  const designIncludeBio = watch('designIncludeBio');
  const bioText = watch('about');
  const videoSourceVoiceId = watch('videoSourceVoiceId');

  // Microphone recording state
  const [recordingStatus, setRecordingStatus] = React.useState<'idle' | 'recording'>('idle');
  const [recordTime, setRecordTime] = React.useState(0);
  const recordTimerRef = React.useRef<NodeJS.Timeout | null>(null);
  const mediaRecorderRef = React.useRef<MediaRecorder | null>(null);
  const audioChunksRef = React.useRef<Blob[]>([]);
  const audioStreamRef = React.useRef<MediaStream | null>(null);

  const selectedVoice = React.useMemo(
    () => allDisplayableVoices.find((v) => v.voiceId === selectedVoiceId),
    [allDisplayableVoices, selectedVoiceId]
  );

  const otherVoices = React.useMemo(
    () => allDisplayableVoices.filter((v) => v.voiceId !== selectedVoiceId),
    [allDisplayableVoices, selectedVoiceId]
  );

  const handleVoiceCreatedAndSelectedByHook = React.useCallback(
    (newVoice: VoiceOption) => {
      onVoiceSelected(newVoice);
      setSelectedVoiceId(newVoice.voiceId);
      setActiveMainTab('select');
    },
    [onVoiceSelected, setActiveMainTab, setSelectedVoiceId]
  );

  const {
    createMode,
    setCreateMode,
    cloneFile,
    setCloneFile,
    cloneFileName,
    setCloneFileName,
    cloneName,
    setCloneName,
    cloneDescription,
    setCloneDescription,
    designVoiceDescription,
    setDesignVoiceDescription,
    designSampleText,
    setDesignSampleText,
    designPreviews,
    selectedPreviewId,
    setSelectedPreviewId,
    isGeneratingPreviews,
    handleGenerateDesignPreviews,
    designFinalVoiceName,
    setDesignFinalVoiceName,
    isProcessingCreate,
    handleCreateAndSelect,
    resetCreateForm,
  } = useVoiceCreator(assistantActions.voice, handleVoiceCreatedAndSelectedByHook, fetchUserVoices);

  // Effect to inform parent about processing state changes
  React.useEffect(() => {
    if (onProcessingStateChange) {
      onProcessingStateChange(isProcessingCreate || isGeneratingPreviews);
    }
  }, [isProcessingCreate, isGeneratingPreviews, onProcessingStateChange]);

  const { playPreview, isPlayingPreviewForVoiceId } = useTTSPreview({
    generateSpeechAction: assistantActions.voice.generate,
  });

  const handleSelectVoiceDisplay = React.useCallback(
    (voice: VoiceOption | null) => {
      setSelectedVoiceId(voice?.voiceId ?? null);
      onVoiceSelected(voice);
    },
    [onVoiceSelected]
  );

  // Sync selectedVoiceId when the parent changes initialVoiceId
  React.useEffect(() => {
    setSelectedVoiceId(initialVoiceId);
  }, [initialVoiceId]);

  // Update createMode in useVoiceCreator hook when tab changes
  React.useEffect(() => {
    if (activeMainTab === 'clone') {
      setCreateMode('clone');
    } else if (activeMainTab === 'design') {
      setCreateMode('design');
    }
  }, [activeMainTab, setCreateMode]);

  const cleanupRecording = React.useCallback(() => {
    if (audioStreamRef.current) {
      audioStreamRef.current.getTracks().forEach((track) => track.stop());
      audioStreamRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    setRecordTime(0);
    setRecordingStatus('idle');
  }, []);

  const handleStartRecording = async () => {
    if (recordingStatus === 'recording' || disabled || isProcessingCreate || isGeneratingPreviews)
      return;

    if (cloneFile) {
      handleClearCloneFile();
    }

    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        audioStreamRef.current = stream;
        mediaRecorderRef.current = new MediaRecorder(stream);
        audioChunksRef.current = [];

        mediaRecorderRef.current.ondataavailable = (event) => {
          audioChunksRef.current.push(event.data);
        };

        mediaRecorderRef.current.onstop = () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
          if (audioBlob.size > 0) {
            const audioFile = new File([audioBlob], `recording-${Date.now()}.webm`, {
              type: 'audio/webm',
            });
            setCloneFile(audioFile);
            setCloneFileName(audioFile.name);
          }
          cleanupRecording();
        };

        mediaRecorderRef.current.start();
        setRecordingStatus('recording');
        setRecordTime(0);
        recordTimerRef.current = setInterval(() => {
          setRecordTime((prev) => prev + 1);
        }, 1000);
      } catch (err) {
        console.error('Error accessing microphone:', err);
        toast.error('Microphone access denied or not available.');
        cleanupRecording();
      }
    } else {
      toast.error('Microphone recording is not supported by your browser.');
    }
  };

  const handleStopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
  };

  const handleClearCloneFile = React.useCallback(() => {
    setCloneFile(null);
    setCloneFileName(null);
    cleanupRecording();
  }, [setCloneFile, setCloneFileName, cleanupRecording]);

  React.useEffect(() => {
    return () => {
      cleanupRecording();
    };
  }, [cleanupRecording]);

  const [playTooltipVoiceId, setPlayTooltipVoiceId] = React.useState<string | null>(null);

  const VoiceListItem = React.memo(({ voice }: { voice: VoiceOption }) => {
    const isSelected = selectedVoiceId === voice.voiceId;
    const itemIsDisabled = disabled || isProcessingCreate || isGeneratingPreviews;
    const showPlayTooltip = playTooltipVoiceId === voice.voiceId;
    return (
      <div
        role="option"
        aria-selected={isSelected}
        aria-label={`Select voice ${voice.name}`}
        data-testid={`voice-option-${voice.voiceId}`}
        className={cn(
          'flex cursor-pointer items-center gap-2 rounded-md border p-2',
          isSelected
            ? 'border-primary bg-primary text-primary-foreground'
            : 'hover:border-muted-foreground/30 border-transparent hover:bg-muted',
          itemIsDisabled && 'cursor-not-allowed opacity-60 hover:bg-transparent'
        )}
        onClick={() => {
          if (itemIsDisabled) return;
          handleSelectVoiceDisplay(voice);
          setPlayTooltipVoiceId(voice.voiceId);
          // Auto-hide after 2.5 seconds
          setTimeout(
            () => setPlayTooltipVoiceId((prev) => (prev === voice.voiceId ? null : prev)),
            2500
          );
        }}
      >
        <span className="text-body text-strong flex-1 truncate" title={voice.name}>
          {voice.name}
        </span>

        <div
          className={cn(
            'm-0 flex items-center justify-between gap-1 p-0 sm:gap-2',
            isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
          )}
        >
          <TooltipProvider delayDuration={100}>
            {videoSourceVoiceId === voice.voiceId && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Current video source"
                    className={cn(
                      'h-7 w-7 cursor-default',
                      isSelected ? 'hover:bg-primary/80' : 'hover:bg-muted-foreground/10'
                    )}
                    disabled={itemIsDisabled}
                  >
                    <Clapperboard
                      className={cn(
                        'h-4 w-4',
                        isSelected ? 'text-primary-foreground' : 'text-muted-foreground'
                      )}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top">
                  <p>Used for current video animation</p>
                </TooltipContent>
              </Tooltip>
            )}
          </TooltipProvider>

          {!voice.isPreset && voice.isUserVoiceInOrchestra && (
            <TooltipProvider delayDuration={100}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label={`Delete "${voice.name}"`}
                    className={cn(
                      'h-7 w-7',
                      isSelected
                        ? 'hover:bg-destructive/80 text-primary-foreground hover:text-primary-foreground'
                        : 'hover:bg-destructive/10 text-muted-foreground hover:text-destructive'
                    )}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteVoice(voice);
                    }}
                    disabled={itemIsDisabled}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-caption max-w-xs">
                  <p>{`Delete "${voice.name}"`}</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}

          <TooltipProvider delayDuration={0}>
            <Tooltip open={showPlayTooltip}>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  aria-label={`Preview "${voice.name}"`}
                  className={cn(
                    'h-7 w-7',
                    isSelected
                      ? 'hover:bg-primary/80 text-primary-foreground hover:text-primary-foreground'
                      : 'text-muted-foreground hover:bg-[color:var(--status-success-bg)] hover:text-[color:var(--status-success)]'
                  )}
                  onClick={(e) => {
                    e.stopPropagation();
                    setPlayTooltipVoiceId(null);
                    playPreview(voice);
                  }}
                  disabled={
                    itemIsDisabled ||
                    (isPlayingPreviewForVoiceId === voice.voiceId &&
                      isPlayingPreviewForVoiceId !== null)
                  }
                >
                  {isPlayingPreviewForVoiceId === voice.voiceId ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-caption max-w-xs">
                <p>Click to preview voice</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
      </div>
    );
  });
  VoiceListItem.displayName = 'VoiceListItem';

  const audioPreviewRefs = React.useRef<Record<string, HTMLAudioElement | null>>({});

  const playDesignPreviewAudio = (
    event: React.MouseEvent<HTMLButtonElement>,
    preview: VoiceDesignPreviewItem
  ) => {
    event.stopPropagation(); // Prevent event bubbling
    event.preventDefault(); // Prevent default button action if any

    const audioId = `design-preview-${preview.generatedVoiceId}`;
    let audio = audioPreviewRefs.current[audioId];
    if (!audio) {
      audio = new Audio();
      audioPreviewRefs.current[audioId] = audio;
      audio.onended = () => {
        // Only deselect if this audio was the one playing
        if (selectedPreviewId === preview.generatedVoiceId) {
          setSelectedPreviewId(null);
        }
      };
    }

    // If clicking the currently selected and playing preview, stop it.
    if (selectedPreviewId === preview.generatedVoiceId && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
      // Keep it selected, user might want to replay or finalize.
      // To deselect, they can click another or it ends.
    } else {
      // Play new or replay paused/ended
      Object.values(audioPreviewRefs.current).forEach((audElem) => {
        if (audElem !== audio) audElem?.pause(); // Pause others
      });
      audio.src = `data:${preview.mediaType};base64,${preview.audioBase64}`;
      audio.play().catch((e) => {
        toast.error('Failed to play preview audio.');
        console.error('Preview play error:', e);
        if (selectedPreviewId === preview.generatedVoiceId) {
          setSelectedPreviewId(null); // Deselect on error
        }
      });
      setSelectedPreviewId(preview.generatedVoiceId);
    }
  };

  // Helper to get character count class
  const getCharCountClass = (
    currentLength: number,
    min: number,
    max: number,
    isOptionalAndEmpty?: boolean
  ) => {
    if (isOptionalAndEmpty && currentLength === 0) return 'text-muted-foreground'; // Optional and empty is fine
    if (currentLength < min || currentLength > max) return 'text-destructive';
    return 'text-muted-foreground';
  };

  // Drag and Drop Handlers for Clone File
  const [isDraggingOverClone, setIsDraggingOverClone] = React.useState(false);
  const handleDragEnterClone = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isProcessingCreate || isGeneratingPreviews) return;
    setIsDraggingOverClone(true);
  };
  const handleDragLeaveClone = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOverClone(false);
  };
  const handleDragOverClone = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault(); // Necessary to allow drop
    e.stopPropagation();
    if (disabled || isProcessingCreate || isGeneratingPreviews) return;
    setIsDraggingOverClone(true); // Keep active if dragging over
  };
  const handleDropClone = (e: React.DragEvent<HTMLLabelElement>) => {
    e.preventDefault();
    e.stopPropagation();
    if (disabled || isProcessingCreate || isGeneratingPreviews) return;
    setIsDraggingOverClone(false);

    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      // Basic validation for audio type (can be more specific)
      if (file.type.startsWith('audio/')) {
        setCloneFile(file);
        setCloneFileName(file.name);
      } else {
        toast.error('Invalid file type. Please drop an audio file (.wav, .mp3).');
      }
      e.dataTransfer.clearData();
    }
  };

  // Hanlde clone audio preview
  const [isPlayingClonePreview, setIsPlayingClonePreview] = React.useState(false);
  const cloneAudioRef = React.useRef<HTMLAudioElement | null>(null);
  const [cloneAudioObjectURL, setCloneAudioObjectURL] = React.useState<string | null>(null);
  // Effect to manage clone audio object URL
  React.useEffect(() => {
    if (cloneFile) {
      const objectUrl = URL.createObjectURL(cloneFile);
      setCloneAudioObjectURL(objectUrl);
      if (!cloneAudioRef.current) {
        cloneAudioRef.current = new Audio();
        cloneAudioRef.current.onended = () => {
          setIsPlayingClonePreview(false);
        };
        cloneAudioRef.current.onerror = (e) => {
          toast.error('Error playing clone audio preview.');
          console.error('Clone audio playback error event:', e);
          setIsPlayingClonePreview(false);
        };
      }
      cloneAudioRef.current.src = objectUrl;

      return () => {
        URL.revokeObjectURL(objectUrl);
        setCloneAudioObjectURL(null); // Clear state as well
        if (cloneAudioRef.current) {
          cloneAudioRef.current.pause();
          cloneAudioRef.current.removeAttribute('src');
        }
        setIsPlayingClonePreview(false);
      };
    } else {
      if (cloneAudioRef.current && !cloneAudioRef.current.paused) {
        cloneAudioRef.current.pause();
      }
      if (cloneAudioObjectURL) {
        // If there was an old URL, revoke it
        URL.revokeObjectURL(cloneAudioObjectURL);
      }
      setCloneAudioObjectURL(null);
      setIsPlayingClonePreview(false);
    }
  }, [cloneFile, cloneAudioObjectURL]);
  React.useEffect(() => {
    const audioEl = cloneAudioRef.current; // Capture current value for cleanup
    const currentObjectUrl = cloneAudioObjectURL; // Capture current value
    return () => {
      if (audioEl) {
        audioEl.pause();
        if (currentObjectUrl) URL.revokeObjectURL(currentObjectUrl);
      }
    };
  }, [cloneAudioObjectURL]);
  const handleTogglePlayClonePreview = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!cloneAudioRef.current || !cloneAudioObjectURL) {
      toast.error('No audio file selected or ready for preview.');
      return;
    }
    if (cloneAudioRef.current.src !== cloneAudioObjectURL) {
      cloneAudioRef.current.src = cloneAudioObjectURL;
    }
    if (isPlayingClonePreview) {
      cloneAudioRef.current.pause();
      setIsPlayingClonePreview(false);
    } else {
      cloneAudioRef.current.currentTime = 0;
      cloneAudioRef.current
        .play()
        .then(() => {
          setIsPlayingClonePreview(true);
        })
        .catch((err) => {
          toast.error('Could not play audio.');
          console.error('[PlayToggle] Error playing clone preview:', err);
          setIsPlayingClonePreview(false);
        });
    }
  };

  return (
    <div
      className={cn(
        '',
        (disabled || isProcessingCreate || isGeneratingPreviews) && 'cursor-not-allowed opacity-70'
      )}
    >
      <div className="h-[276px] rounded-md border">
        <ScrollArea className="h-full w-full">
          {isLoadingUserVoices ? (
            <div className="space-y-1 p-2">
              {[...Array(5)].map((_, i) => (
                <VoiceListItemSkeleton key={`voice-skeleton-${i}`} />
              ))}
            </div>
          ) : (
            <div>
              {selectedVoice && (
                <div className="sticky top-0 z-10 border-b bg-background p-2">
                  <VoiceListItem voice={selectedVoice} />
                </div>
              )}
              <div className="space-y-1 p-2">
                {otherVoices.length === 0 && !selectedVoice ? (
                  <div className="flex flex-col items-center justify-center pt-10">
                    <p className="text-body text-center text-muted-foreground">
                      No voices available.
                    </p>
                  </div>
                ) : (
                  otherVoices.map((v) => (
                    <VoiceListItem key={(v.isPreset ? 'p-' : 'u-') + v.voiceId} voice={v} />
                  ))
                )}
              </div>
            </div>
          )}
        </ScrollArea>
      </div>
    </div>
  );
}
