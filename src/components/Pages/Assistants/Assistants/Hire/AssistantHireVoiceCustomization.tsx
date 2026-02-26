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
import { getLanguageFlag } from '@/utils/assistants/voice-utils';
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
        <span className="text-body">{getLanguageFlag(voice.language)}</span>
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
                      : 'text-muted-foreground hover:bg-green-600/10 hover:text-green-600'
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
      <Tabs
        value={activeMainTab}
        onValueChange={(v) => setActiveMainTab(v as ActiveCreatorTab)}
        className="w-full"
      >
        <TabsList
          className={cn(
            'grid h-9 w-full',
            PRIMARY_VOICE_PROVIDER === 'elevenlabs' ? 'grid-cols-3' : 'grid-cols-2'
          )}
        >
          <TabsTrigger
            value="select"
            disabled={disabled || isProcessingCreate || isGeneratingPreviews}
          >
            Select
          </TabsTrigger>
          <TabsTrigger
            value="clone"
            disabled={disabled || isProcessingCreate || isGeneratingPreviews}
          >
            Clone
          </TabsTrigger>
          {PRIMARY_VOICE_PROVIDER === 'elevenlabs' && (
            <TabsTrigger
              value="design"
              disabled={disabled || isProcessingCreate || isGeneratingPreviews}
            >
              Design
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="select" className="mt-0 h-[276px] rounded-md border">
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
                        No voices. Try creating or designing one.
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
        </TabsContent>

        <TabsContent value="clone" className="mt-2 h-[276px] rounded-md border">
          <ScrollArea className="h-full w-full">
            <div className="space-y-3 p-3">
              <div className="space-y-1">
                <Label htmlFor="clone-name" className="text-label">
                  Voice Name
                </Label>
                <Input
                  id="clone-name"
                  value={cloneName}
                  onChange={(e) => setCloneName(e.target.value)}
                  placeholder="e.g., My Clone"
                  className="h-8"
                  disabled={disabled || isProcessingCreate || isGeneratingPreviews}
                />
              </div>
              <div className="pt-2">
                <Label className="text-label">Audio Clip (max 5s, .wav, .mp3)</Label>
                {!cloneFile ? (
                  <div className="mt-1 grid grid-cols-2 gap-2">
                    <label
                      htmlFor="clone-file-input"
                      className={cn(
                        'flex h-24 w-full cursor-pointer appearance-none flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-background p-2 text-center transition hover:border-primary',
                        (disabled || isProcessingCreate || isGeneratingPreviews) &&
                          'cursor-not-allowed opacity-50',
                        isDraggingOverClone && 'border-primary ring-2 ring-primary ring-offset-2'
                      )}
                      onDragEnter={handleDragEnterClone}
                      onDragLeave={handleDragLeaveClone}
                      onDragOver={handleDragOverClone}
                      onDrop={handleDropClone}
                      aria-disabled={disabled || isProcessingCreate || isGeneratingPreviews}
                    >
                      <UploadCloud className="h-6 w-6 text-muted-foreground" />
                      <span className="text-body mt-1 text-muted-foreground">
                        Drop or <span className="text-link">browse</span>
                      </span>
                      <input
                        type="file"
                        id="clone-file-input"
                        accept=".wav,.mp3"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) {
                            if (f.type.startsWith('audio/')) {
                              setCloneFile(f);
                              setCloneFileName(f.name);
                            } else {
                              toast.error('Invalid file type. Please select an audio file.');
                              e.target.value = '';
                            }
                          }
                        }}
                        disabled={disabled || isProcessingCreate || isGeneratingPreviews}
                      />
                    </label>
                    <div
                      className={cn(
                        'flex h-24 w-full cursor-pointer appearance-none flex-col items-center justify-center rounded-md border-2 border-dashed border-gray-300 bg-background p-2 text-center transition',
                        recordingStatus === 'idle' && 'hover:border-primary',
                        recordingStatus === 'recording' && 'border-destructive text-destructive',
                        (disabled || isProcessingCreate || isGeneratingPreviews) &&
                          'cursor-not-allowed opacity-50'
                      )}
                      onClick={
                        recordingStatus === 'recording' ? handleStopRecording : handleStartRecording
                      }
                      aria-disabled={disabled || isProcessingCreate || isGeneratingPreviews}
                    >
                      {recordingStatus === 'recording' ? (
                        <>
                          <Square className="mb-1 h-6 w-6 text-destructive" />
                          <span className="text-body">Stop Recording</span>
                          <div className="mt-1 flex items-center gap-1.5">
                            <div className="h-2 w-2 animate-pulse rounded-full bg-destructive"></div>
                            <span className="text-caption text-destructive/80 font-mono">
                              {new Date(recordTime * 1000).toISOString().substr(14, 5)}
                            </span>
                          </div>
                        </>
                      ) : (
                        <>
                          <Mic className="h-6 w-6 text-muted-foreground" />
                          <span className="text-body mt-1 text-muted-foreground">Record Audio</span>
                        </>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-muted/50 text-body mt-2 flex h-9 items-center justify-between rounded-md border p-1.5 pl-2.5">
                    <span className="mr-2 flex-1 truncate" title={cloneFileName ?? undefined}>
                      {cloneFileName}
                    </span>
                    <div className="flex items-center gap-1">
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 pt-0.5 text-muted-foreground hover:bg-transparent hover:text-primary"
                              onClick={handleTogglePlayClonePreview}
                              disabled={
                                disabled ||
                                isProcessingCreate ||
                                isGeneratingPreviews ||
                                !cloneAudioObjectURL
                              }
                            >
                              {isPlayingClonePreview ? (
                                <PauseCircle className="h-3.5 w-3.5" />
                              ) : (
                                <PlayCircle className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>{isPlayingClonePreview ? 'Pause preview' : 'Play preview'}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                      <TooltipProvider delayDuration={100}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 pt-0.5 text-muted-foreground hover:bg-transparent hover:text-destructive"
                              onClick={handleClearCloneFile}
                              disabled={disabled || isProcessingCreate || isGeneratingPreviews}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            <p>Remove file</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                )}
              </div>
              <div className="pt-1">
                <Label htmlFor="clone-desc" className="text-label">
                  Description (Optional)
                </Label>
                <Textarea
                  id="clone-desc"
                  value={cloneDescription}
                  onChange={(e) => setCloneDescription(e.target.value)}
                  placeholder="Notes about this voice..."
                  rows={2}
                  className="text-body min-h-[50px]"
                  disabled={disabled || isProcessingCreate || isGeneratingPreviews}
                />
              </div>

              <BillableActionGuard onAddPaymentMethod={onAddPaymentMethod}>
                <Button
                  type="button"
                  onClick={handleCreateAndSelect}
                  className="h-9 w-full bg-green-600 hover:bg-green-700"
                  disabled={
                    disabled ||
                    isProcessingCreate ||
                    isGeneratingPreviews ||
                    !cloneFile ||
                    !cloneName
                  }
                >
                  {isProcessingCreate && createMode === 'clone' ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="mr-2 h-4 w-4" />
                  )}{' '}
                  Create & Select Voice
                </Button>
              </BillableActionGuard>
            </div>
          </ScrollArea>
        </TabsContent>

        {PRIMARY_VOICE_PROVIDER === 'elevenlabs' && (
          <TabsContent value="design" className="mt-2 h-[276px] rounded-md border">
            <ScrollArea className="h-full w-full">
              <div className="space-y-3 p-3">
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label htmlFor="design-final-name" className="text-label">
                      Voice Name
                    </Label>
                    <Input
                      id="design-final-name"
                      value={designFinalVoiceName}
                      onChange={(e) => setDesignFinalVoiceName(e.target.value)}
                      placeholder="e.g., My Designed Voice"
                      className="h-8"
                      disabled={disabled || isProcessingCreate || isGeneratingPreviews}
                    />
                  </div>
                  <div className="space-y-1">
                    <div className="flex flex-row items-center justify-between gap-2 pb-1">
                      <Label htmlFor="design-desc" className="text-label">
                        Voice Description Prompt
                      </Label>
                    </div>
                    <Textarea
                      id="design-desc"
                      value={designVoiceDescription}
                      onChange={(e) => setDesignVoiceDescription(e.target.value)}
                      placeholder="e.g., A calm and soothing female voice with a British accent..."
                      rows={2}
                      className="text-body min-h-[50px]"
                      disabled={disabled || isProcessingCreate || isGeneratingPreviews}
                      maxLength={DESIGN_VOICE_DESC_MAX_LENGTH}
                    />
                    <div className="flex items-center justify-between gap-5">
                      <div className="flex items-center space-x-2 pt-1">
                        <Controller
                          name="designIncludeBio"
                          control={control}
                          render={({ field }) => (
                            <Checkbox
                              id="design-include-bio"
                              checked={field.value}
                              onCheckedChange={field.onChange}
                              disabled={disabled || isProcessingCreate || isGeneratingPreviews}
                            />
                          )}
                        />
                        <div className="grid gap-1.5 leading-none">
                          <label
                            htmlFor="design-include-bio"
                            className="text-label flex items-center gap-1.5 leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                          >
                            Include profile bio
                            <TooltipProvider delayDuration={100}>
                              <Tooltip>
                                <TooltipTrigger type="button" asChild>
                                  <Info className="h-4 w-4 cursor-help text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent side="top" className="text-caption max-w-xs">
                                  <p>
                                    If checked, the profile bio provided above will be taken into
                                    account to refine the voice description.
                                  </p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </label>
                        </div>
                      </div>
                      <p
                        className={cn(
                          'text-caption mt-0.5 text-right',
                          getCharCountClass(
                            designVoiceDescription.length,
                            DESIGN_VOICE_DESC_MIN_LENGTH,
                            DESIGN_VOICE_DESC_MAX_LENGTH,
                            designIncludeBio
                          )
                        )}
                      >
                        {designVoiceDescription.length}/{DESIGN_VOICE_DESC_MAX_LENGTH}
                        {!designIncludeBio && ` (min ${DESIGN_VOICE_DESC_MIN_LENGTH})`}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="design-sample" className="text-label">
                      Sample Text for Previews (Optional)
                    </Label>
                    <Input
                      id="design-sample"
                      value={designSampleText}
                      onChange={(e) => setDesignSampleText(e.target.value)}
                      placeholder={`e.g., Hello, this is a sample reference text for generating the voice.`}
                      className="h-8"
                      disabled={disabled || isProcessingCreate || isGeneratingPreviews}
                      maxLength={DESIGN_SAMPLE_TEXT_MAX_LENGTH}
                    />
                    <p
                      className={cn(
                        'text-caption mt-0.5 text-right',
                        getCharCountClass(
                          designSampleText.length,
                          DESIGN_SAMPLE_TEXT_MIN_LENGTH,
                          DESIGN_SAMPLE_TEXT_MAX_LENGTH,
                          true
                        )
                      )}
                    >
                      {designSampleText.length}/{DESIGN_SAMPLE_TEXT_MAX_LENGTH}
                      {designSampleText.length > 0 && ` (min ${DESIGN_SAMPLE_TEXT_MIN_LENGTH})`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    onClick={handleGenerateDesignPreviews}
                    className="h-8 w-full"
                    disabled={
                      disabled ||
                      isProcessingCreate ||
                      isGeneratingPreviews ||
                      (!designVoiceDescription.trim() && !designIncludeBio) ||
                      (!!designIncludeBio && !bioText?.trim())
                    }
                  >
                    {isGeneratingPreviews ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Wand2 className="mr-2 h-4 w-4" />
                    )}{' '}
                    Generate Previews
                  </Button>

                  {designPreviews.length > 0 && (
                    <div className="space-y-2 pt-2">
                      <Label className="text-label">Select a Preview to Finalize:</Label>
                      <ScrollArea className="h-[120px] rounded-md border p-1">
                        {' '}
                        {/* Increased height */}
                        {designPreviews.map((preview, idx) => (
                          <Button
                            type="button" // Explicitly set type
                            key={preview.generatedVoiceId}
                            variant={
                              selectedPreviewId === preview.generatedVoiceId ? 'default' : 'outline'
                            }
                            size="sm"
                            className="text-caption mb-1 h-8 w-full justify-start"
                            onClick={(e) => playDesignPreviewAudio(e, preview)}
                            disabled={isGeneratingPreviews || isProcessingCreate}
                          >
                            <MicVocal className="mr-2 h-3 w-3" />
                            Preview {idx + 1}
                            {selectedPreviewId === preview.generatedVoiceId && (
                              <Play className="ml-auto h-3 w-3" />
                            )}
                          </Button>
                        ))}
                      </ScrollArea>
                    </div>
                  )}
                  <BillableActionGuard onAddPaymentMethod={onAddPaymentMethod}>
                    <Button
                      type="button"
                      onClick={handleCreateAndSelect}
                      className="h-9 w-full bg-green-600 hover:bg-green-700"
                      disabled={
                        disabled ||
                        isProcessingCreate ||
                        isGeneratingPreviews ||
                        (createMode === 'design' && !selectedPreviewId)
                      }
                    >
                      {isProcessingCreate && createMode === 'design' ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                      )}{' '}
                      Create & Select Voice
                    </Button>
                  </BillableActionGuard>
                </div>
              </div>
            </ScrollArea>
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
