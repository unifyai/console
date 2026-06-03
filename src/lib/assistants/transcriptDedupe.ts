type TranscriptLike = Record<string, unknown> | null | undefined;

interface CanonicalTranscriptKey {
  medium: string;
  timestamp: string;
  exchangeId: number | null;
  content: string;
  authoringAssistantId: number | null;
  attachments: string;
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function canonicalAttachmentSignature(value: unknown): string {
  if (!Array.isArray(value) || value.length === 0) {
    return '';
  }
  const signatures = value.map((attachment) => {
    if (!attachment || typeof attachment !== 'object') {
      return '';
    }
    const record = attachment as Record<string, unknown>;
    return [
      asString(record.filename),
      asString(record.gsUrl ?? record.gs_url),
      asString(record.contentType ?? record.content_type),
      String(asNumber(record.sizeBytes ?? record.size_bytes) ?? ''),
    ].join(':');
  });
  signatures.sort();
  return signatures.join('|');
}

/**
 * Build a root-agnostic transcript key so fanout copies collapse in merged views.
 *
 * We intentionally exclude root-local sender/receiver ids because those differ
 * between personal and space roots for the same logical message.
 */
export function transcriptMergeDedupeKey(
  transcript: TranscriptLike,
  fallbackId?: string | number
): string {
  if (!transcript) {
    return `fallback:${String(fallbackId ?? 'unknown')}`;
  }
  const canonical: CanonicalTranscriptKey = {
    medium: asString(transcript.medium),
    timestamp: asString(transcript.timestamp),
    exchangeId: asNumber(transcript.exchangeId ?? transcript.exchange_id),
    content: asString(transcript.content),
    authoringAssistantId: asNumber(
      transcript.authoringAssistantId ?? transcript.authoring_assistant_id
    ),
    attachments: canonicalAttachmentSignature(transcript.attachments),
  };
  const hasCanonicalData =
    canonical.medium !== '' ||
    canonical.timestamp !== '' ||
    canonical.exchangeId !== null ||
    canonical.content !== '' ||
    canonical.authoringAssistantId !== null ||
    canonical.attachments !== '';
  if (!hasCanonicalData) {
    return `fallback:${String(fallbackId ?? 'unknown')}`;
  }
  return JSON.stringify(canonical);
}
