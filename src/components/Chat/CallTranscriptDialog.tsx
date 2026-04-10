import { Loader2, Phone } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/UI/dialog';
import { ScrollArea } from '@/components/UI/scroll-area';
import { CallPill, CallTranscriptUtterance } from '@/types/assistants/chat';
import { cn } from '@/lib/utils';

function formatDuration(seconds: number): string {
  if (seconds < 60) return `0:${String(seconds).padStart(2, '0')}`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

interface CallTranscriptDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  pill: CallPill | null;
  utterances: CallTranscriptUtterance[];
  loading: boolean;
  assistantName?: string;
}

export function CallTranscriptDialog({
  open,
  onOpenChange,
  pill,
  utterances,
  loading,
  assistantName = 'Assistant',
}: CallTranscriptDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[80vh] flex-col sm:max-w-[500px]"
        data-testid="call-transcript-dialog"
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4" />
            Call Transcript
          </DialogTitle>
          {pill && (
            <DialogDescription>Duration: {formatDuration(pill.durationSeconds)}</DialogDescription>
          )}
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : utterances.length === 0 ? (
            <div className="text-caption py-12 text-center text-muted-foreground">
              No transcript available for this call.
            </div>
          ) : (
            <div className="space-y-3 pr-4" data-testid="call-transcript-content">
              {utterances.map((utterance) => (
                <div key={utterance.id} data-testid="call-transcript-utterance">
                  <div className="flex items-baseline gap-2">
                    <span
                      className={cn(
                        'text-xs font-semibold',
                        utterance.role === 'assistant' ? 'text-muted-foreground' : 'text-foreground'
                      )}
                    >
                      {utterance.role === 'assistant' ? assistantName : 'You'}
                    </span>
                    {utterance.callUtteranceTimestamp && (
                      <span className="text-muted-foreground/60 text-[10px]">
                        {utterance.callUtteranceTimestamp}
                      </span>
                    )}
                  </div>
                  <p className="text-sm leading-relaxed">{utterance.content}</p>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
