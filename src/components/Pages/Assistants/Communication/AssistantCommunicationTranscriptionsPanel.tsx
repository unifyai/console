'use client';

import * as React from 'react';
import { useTranscriptions, useLocalParticipant, useParticipants } from '@livekit/components-react';
import { ScrollArea } from '@/components/UI/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/UI/avatar';

interface AssistantCommunicationTranscriptionsPanelProps {
  userImage?: string | null;
  assistantPhoto?: string | null;
}

export function AssistantCommunicationTranscriptionsPanel({
  userImage,
  assistantPhoto,
}: AssistantCommunicationTranscriptionsPanelProps) {
  const transcriptions = useTranscriptions();
  const { localParticipant } = useLocalParticipant();
  const participants = useParticipants();

  const sortedTranscriptions = React.useMemo(() => {
    return transcriptions.sort(
      (a, b) => (a.streamInfo?.startTime ?? 0) - (b.streamInfo?.startTime ?? 0)
    );
  }, [transcriptions]);

  return (
    <div className="flex h-full w-full flex-col text-foreground">
      <ScrollArea className="flex-1">
        <div className="space-y-4 p-4">
          {sortedTranscriptions.length === 0 ? (
            <div className="text-body-muted pt-8 text-center">No transcriptions yet.</div>
          ) : (
            sortedTranscriptions.map((transcription, index) => {
              const participant = participants.find(
                (p) => p.identity === transcription.participantInfo.identity
              );
              const participantName = participant?.name || transcription.participantInfo.identity;
              const isUser = transcription.participantInfo.identity === localParticipant.identity;
              const avatarSrc = isUser ? userImage : assistantPhoto;
              const fallback =
                participantName?.substring(0, 2).toUpperCase() || (isUser ? 'U' : 'A');

              const showName =
                index === 0 ||
                sortedTranscriptions[index - 1].participantInfo.identity !==
                  transcription.participantInfo.identity;

              return (
                <div
                  key={`${transcription.streamInfo.startTime}-${index}`}
                  className="flex items-start gap-3"
                >
                  <Avatar className="h-8 w-8 border">
                    <AvatarImage src={avatarSrc ?? undefined} alt={participantName} />
                    <AvatarFallback>{fallback}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    {showName && <p className="text-title text-semibold">{participantName}</p>}
                    <p className="text-body-muted">{transcription.text}</p>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
