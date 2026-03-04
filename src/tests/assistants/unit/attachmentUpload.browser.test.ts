/**
 * Tests for Unify Message Attachment Upload Flow
 *
 * These tests verify the new attachment upload behavior that returns full metadata
 * including gsUrl, contentType, and sizeBytes for transcript logging.
 *
 * Tests marked with `it.fails` are expected to fail until the corresponding
 * implementation is completed (requires running backend services).
 */
import { describe, it, expect } from 'vitest';

// =============================================================================
// ATTACHMENT UTILITIES TESTS - New Features
// =============================================================================

describe('Attachment Utilities - New Features', () => {
  describe('validateFile - no size limit, type check only', () => {
    it('should accept any size file with allowed extension', async () => {
      const { validateFile } = await import('@/components/Chat/attachmentUtils');

      const file = new File(['content'], 'report.pdf', { type: 'application/pdf' });
      const result = validateFile(file);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject files with blocked extensions', async () => {
      const { validateFile } = await import('@/components/Chat/attachmentUtils');

      const file = new File(['content'], 'malware.exe', { type: 'application/x-msdownload' });
      const result = validateFile(file);
      expect(result.valid).toBe(false);
    });
  });

  describe('validateFileType - New function', () => {
    it('should export validateFileType function', async () => {
      const utils = await import('@/components/Chat/attachmentUtils');
      expect(typeof (utils as { validateFileType?: unknown }).validateFileType).toBe('function');
    });

    it('should reject blocked extensions (.exe, .bat, .sh)', async () => {
      const { validateFileType } = (await import('@/components/Chat/attachmentUtils')) as {
        validateFileType: (filename: string) => { valid: boolean; error?: string };
      };

      const blockedExtensions = ['.exe', '.bat', '.sh', '.ps1', '.dll'];
      for (const ext of blockedExtensions) {
        const result = validateFileType(`file${ext}`);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('not allowed');
      }
    });

    it('should accept allowed extensions (.pdf, .docx, .png)', async () => {
      const { validateFileType } = (await import('@/components/Chat/attachmentUtils')) as {
        validateFileType: (filename: string) => { valid: boolean; error?: string };
      };

      const allowedExtensions = ['.pdf', '.docx', '.xlsx', '.png', '.jpg', '.csv', '.json'];
      for (const ext of allowedExtensions) {
        const result = validateFileType(`file${ext}`);
        expect(result.valid).toBe(true);
      }
    });
  });

  describe('Attachment count limit - 10 max', () => {
    it('should export MAX_ATTACHMENTS constant', async () => {
      const utils = await import('@/components/Chat/attachmentUtils');
      expect((utils as { MAX_ATTACHMENTS?: number }).MAX_ATTACHMENTS).toBe(10);
    });
  });
});

// =============================================================================
// CHAT ATTACHMENT TYPE TESTS
// =============================================================================

describe('Attachment Type - Fields', () => {
  it('should include gsUrl field in Attachment interface', async () => {
    const chatTypes = await import('@/types/assistants/chat');

    const hasGsUrlSupport = 'createAttachmentWithMetadata' in chatTypes;
    expect(hasGsUrlSupport).toBe(true);
  });

  it('should export isAttachmentMetadata type guard', async () => {
    const chatTypes = await import('@/types/assistants/chat');

    const hasMetadataType = 'isAttachmentMetadata' in chatTypes;
    expect(hasMetadataType).toBe(true);
  });
});

// =============================================================================
// ATTACHMENT UPLOAD FUNCTION TESTS
// =============================================================================

describe('uploadAttachment Function - New Response Format', () => {
  it('should export uploadAttachment function', async () => {
    const utils = await import('@/components/Chat/attachmentUtils');
    expect(typeof (utils as { uploadAttachment?: unknown }).uploadAttachment).toBe('function');
  });

  // These tests require backend services (Communication Adapters) to be running
  it.fails('should return gsUrl in upload response', async () => {
    const { uploadAttachment } = (await import('@/components/Chat/attachmentUtils')) as {
      uploadAttachment: (
        file: File,
        assistantId: string
      ) => Promise<{
        id: string;
        filename: string;
        gsUrl: string;
        signedUrl: string;
        contentType: string;
        sizeBytes: number;
      }>;
    };

    const file = new File(['test content'], 'report.pdf', { type: 'application/pdf' });
    const result = await uploadAttachment(file, '123');

    expect(result.gsUrl).toBeDefined();
    expect(result.gsUrl).toMatch(/^gs:\/\/unify-message-attachments\//);
  });

  it.fails('should return contentType in upload response', async () => {
    const { uploadAttachment } = (await import('@/components/Chat/attachmentUtils')) as {
      uploadAttachment: (
        file: File,
        assistantId: string
      ) => Promise<{
        id: string;
        filename: string;
        gsUrl: string;
        signedUrl: string;
        contentType: string;
        sizeBytes: number;
      }>;
    };

    const file = new File(['test content'], 'report.pdf', { type: 'application/pdf' });
    const result = await uploadAttachment(file, '123');

    expect(result.contentType).toBe('application/pdf');
  });

  it.fails('should return sizeBytes in upload response', async () => {
    const { uploadAttachment } = (await import('@/components/Chat/attachmentUtils')) as {
      uploadAttachment: (
        file: File,
        assistantId: string
      ) => Promise<{
        id: string;
        filename: string;
        gsUrl: string;
        signedUrl: string;
        contentType: string;
        sizeBytes: number;
      }>;
    };

    const content = 'x'.repeat(1000);
    const file = new File([content], 'report.pdf', { type: 'application/pdf' });
    const result = await uploadAttachment(file, '123');

    expect(result.sizeBytes).toBe(1000);
  });
});

// =============================================================================
// SIGNED URL GENERATION TESTS
// =============================================================================

describe('getSignedUrl Function - On-demand URL generation', () => {
  it('should export getSignedUrl function', async () => {
    const utils = await import('@/components/Chat/attachmentUtils');
    expect(typeof (utils as { getSignedUrl?: unknown }).getSignedUrl).toBe('function');
  });

  // This test requires backend services (Orchestra) to be running
  it.fails('should generate signed URL from gs:// URL', async () => {
    const { getSignedUrl } = (await import('@/components/Chat/attachmentUtils')) as {
      getSignedUrl: (gsUrl: string) => Promise<string>;
    };

    const gsUrl = 'gs://bucket/123/uuid_report.pdf';
    const signedUrl = await getSignedUrl(gsUrl);

    expect(signedUrl).toMatch(/^https:\/\/storage\.googleapis\.com\//);
  });
});

// =============================================================================
// MESSAGE ATTACHMENT FORMAT TESTS
// =============================================================================

describe('createMessageAttachment Function - Format for sending', () => {
  it('should export createMessageAttachment function', async () => {
    const utils = await import('@/components/Chat/attachmentUtils');
    expect(typeof (utils as { createMessageAttachment?: unknown }).createMessageAttachment).toBe(
      'function'
    );
  });

  it('should create message attachment with gsUrl (not signedUrl)', async () => {
    const { createMessageAttachment } = (await import('@/components/Chat/attachmentUtils')) as {
      createMessageAttachment: (uploadResponse: {
        id: string;
        filename: string;
        gsUrl: string;
        signedUrl: string;
        contentType: string;
        sizeBytes: number;
      }) => {
        id: string;
        filename: string;
        gsUrl: string;
        contentType: string;
        sizeBytes: number;
      };
    };

    const uploadResponse = {
      id: 'uuid-123',
      filename: 'report.pdf',
      gsUrl: 'gs://bucket/123/uuid-123_report.pdf',
      signedUrl: 'https://storage.googleapis.com/...',
      contentType: 'application/pdf',
      sizeBytes: 5000,
    };

    const messageAttachment = createMessageAttachment(uploadResponse);

    // Should include gsUrl for transcript logging
    expect(messageAttachment.gsUrl).toBe(uploadResponse.gsUrl);
    // Should NOT include signedUrl
    expect((messageAttachment as { signedUrl?: string }).signedUrl).toBeUndefined();
    // Should include all metadata
    expect(messageAttachment.id).toBe(uploadResponse.id);
    expect(messageAttachment.filename).toBe(uploadResponse.filename);
    expect(messageAttachment.contentType).toBe(uploadResponse.contentType);
    expect(messageAttachment.sizeBytes).toBe(uploadResponse.sizeBytes);
  });
});

// =============================================================================
// FILE TYPE ALLOWLIST/BLOCKLIST CONSTANTS
// =============================================================================

describe('File Type Constants', () => {
  it('should export ALLOWED_EXTENSIONS constant', async () => {
    const utils = await import('@/components/Chat/attachmentUtils');
    const ALLOWED_EXTENSIONS = (utils as { ALLOWED_EXTENSIONS?: Set<string> }).ALLOWED_EXTENSIONS;

    expect(ALLOWED_EXTENSIONS).toBeDefined();
    expect(ALLOWED_EXTENSIONS).toBeInstanceOf(Set);

    // Check key extensions are included
    expect(ALLOWED_EXTENSIONS?.has('.pdf')).toBe(true);
    expect(ALLOWED_EXTENSIONS?.has('.docx')).toBe(true);
    expect(ALLOWED_EXTENSIONS?.has('.png')).toBe(true);
    expect(ALLOWED_EXTENSIONS?.has('.jpg')).toBe(true);
  });

  it('should export BLOCKED_EXTENSIONS constant', async () => {
    const utils = await import('@/components/Chat/attachmentUtils');
    const BLOCKED_EXTENSIONS = (utils as { BLOCKED_EXTENSIONS?: Set<string> }).BLOCKED_EXTENSIONS;

    expect(BLOCKED_EXTENSIONS).toBeDefined();
    expect(BLOCKED_EXTENSIONS).toBeInstanceOf(Set);

    // Check dangerous extensions are blocked
    expect(BLOCKED_EXTENSIONS?.has('.exe')).toBe(true);
    expect(BLOCKED_EXTENSIONS?.has('.bat')).toBe(true);
    expect(BLOCKED_EXTENSIONS?.has('.sh')).toBe(true);
    expect(BLOCKED_EXTENSIONS?.has('.ps1')).toBe(true);
    expect(BLOCKED_EXTENSIONS?.has('.dll')).toBe(true);
  });
});
