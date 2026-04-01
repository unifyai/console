/**
 * Integration Tests for Unify Message Attachment Upload UI Flow
 *
 * These tests verify the complete attachment upload flow from the UI,
 * including file selection, upload to GCS, and sending messages with attachments.
 *
 * Tests marked with `it.fails` are expected to fail until the corresponding
 * implementation is completed.
 */
import * as React from 'react';
import { render, screen, waitFor, act } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Server Action module before importing components
vi.mock('@/lib/assistants/preHireChat', () => ({
  sendPreHireChatMessage: vi.fn().mockResolvedValue({ content: 'Mocked response' }),
  generatePostHireGreeting: vi.fn().mockResolvedValue({ content: 'Hello! I am ready to work.' }),
}));

import {
  ChatTestHarness,
  setupChatMocks,
  cleanupChatMocks,
  createMockChatActions,
  testFiles,
  simulateFileDrop,
  getAttachmentChips,
  getAttachmentChipNames,
} from './fixtures';

// Chat mocks state
let chatMocks: ReturnType<typeof setupChatMocks>;

beforeEach(() => {
  chatMocks = setupChatMocks();
});

afterEach(() => {
  cleanupChatMocks();
});

// =============================================================================
// ATTACHMENT UPLOAD FLOW TESTS
// =============================================================================

describe('Attachment Upload Flow - New Metadata', () => {
  const attachmentUser = userEvent.setup();

  describe('Upload Returns Full Metadata', () => {
    it.fails(
      'should store gsUrl in attachment after successful upload',
      {
        meta: {
          alias: 'Attach-Upload-GsUrl',
          scenario: 'User uploads a file',
          behavior: 'Attachment includes gsUrl for transcript logging',
        },
      },
      async () => {
        // Mock upload endpoint to return new metadata format
        const mockUpload = vi.fn().mockResolvedValue({
          id: 'upload-uuid',
          filename: 'report.pdf',
          gsUrl: 'gs://bucket/123/upload-uuid_report.pdf',
          signedUrl: 'https://storage.googleapis.com/...',
          contentType: 'application/pdf',
          sizeBytes: 12345,
        });

        const chatActions = createMockChatActions({
          uploadAttachment: mockUpload,
        });

        const { container } = render(
          <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
        );

        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const input = await screen.findByPlaceholderText('Send a message...');
        await waitFor(() => expect(input).not.toBeDisabled());

        // Upload a file
        const file = testFiles.pdf();
        await simulateFileDrop(container, [file], attachmentUser);

        // Verify upload was called
        await waitFor(() => {
          expect(mockUpload).toHaveBeenCalled();
        });

        // The uploaded attachment should have gsUrl
        const chips = getAttachmentChips(container);
        expect(chips.length).toBe(1);

        // Check the chip's data attribute for gsUrl (implementation dependent)
        const chip = chips[0];
        expect(chip.dataset.gsUrl).toBeDefined();
        expect(chip.dataset.gsUrl).toMatch(/^gs:\/\/assistant-message-attachments-production\//);
      }
    );

    it.fails(
      'should display contentType icon based on uploaded file type',
      {
        meta: {
          alias: 'Attach-Upload-ContentType',
          scenario: 'User uploads different file types',
          behavior: 'Correct icon is shown based on contentType',
        },
      },
      async () => {
        const mockUpload = vi
          .fn()
          .mockResolvedValueOnce({
            id: 'pdf-uuid',
            filename: 'doc.pdf',
            gsUrl: 'gs://bucket/123/pdf-uuid_doc.pdf',
            signedUrl: 'https://storage.googleapis.com/...',
            contentType: 'application/pdf',
            sizeBytes: 1000,
          })
          .mockResolvedValueOnce({
            id: 'xlsx-uuid',
            filename: 'data.xlsx',
            gsUrl: 'gs://bucket/123/xlsx-uuid_data.xlsx',
            signedUrl: 'https://storage.googleapis.com/...',
            contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            sizeBytes: 2000,
          });

        const chatActions = createMockChatActions({
          uploadAttachment: mockUpload,
        });

        const { container } = render(
          <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
        );

        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const input = await screen.findByPlaceholderText('Send a message...');
        await waitFor(() => expect(input).not.toBeDisabled());

        // Upload PDF
        await simulateFileDrop(container, [testFiles.pdf()], attachmentUser);

        // Upload Excel file
        await simulateFileDrop(container, [testFiles.xlsx()], attachmentUser);

        await waitFor(() => {
          const chips = getAttachmentChips(container);
          expect(chips.length).toBe(2);

          // Each chip should have contentType stored
          expect(chips[0].dataset.contentType).toBe('application/pdf');
          expect(chips[1].dataset.contentType).toBe(
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
          );
        });
      }
    );
  });

  describe('File Type Validation in UI', () => {
    it.fails(
      'should prevent uploading blocked file types with error message',
      {
        meta: {
          alias: 'Attach-Block-Exe',
          scenario: 'User tries to upload .exe file',
          behavior: 'Upload is blocked with error toast',
        },
      },
      async () => {
        const chatActions = createMockChatActions();
        const { container } = render(
          <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
        );

        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const input = await screen.findByPlaceholderText('Send a message...');
        await waitFor(() => expect(input).not.toBeDisabled());

        // Try to upload an executable
        const exeFile = new File(['MZ...'], 'malware.exe', { type: 'application/octet-stream' });
        await simulateFileDrop(container, [exeFile], attachmentUser);

        // Should show error toast
        await waitFor(() => {
          expect(screen.getByText(/file type not allowed/i)).toBeInTheDocument();
        });

        // No chip should be added
        const chipNames = getAttachmentChipNames(container);
        expect(chipNames).toHaveLength(0);
      }
    );

    it.fails(
      'should prevent uploading script files with warning',
      {
        meta: {
          alias: 'Attach-Block-Script',
          scenario: 'User tries to upload .sh, .bat, .ps1 files',
          behavior: 'Upload is blocked with warning',
        },
      },
      async () => {
        const chatActions = createMockChatActions();
        const { container } = render(
          <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
        );

        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const input = await screen.findByPlaceholderText('Send a message...');
        await waitFor(() => expect(input).not.toBeDisabled());

        // Try to upload a shell script
        const shFile = new File(['#!/bin/bash\necho hello'], 'script.sh', { type: 'text/plain' });
        await simulateFileDrop(container, [shFile], attachmentUser);

        // Should show warning
        await waitFor(() => {
          expect(screen.getByText(/file type not allowed/i)).toBeInTheDocument();
        });

        // No chip should be added
        const chipNames = getAttachmentChipNames(container);
        expect(chipNames).toHaveLength(0);
      }
    );
  });

  describe('New File Size Limit (25MB)', () => {
    it(
      'should reject files over 25MB',
      {
        meta: {
          alias: 'Attach-Reject-25MB',
          scenario: 'User tries to upload 26MB file',
          behavior: 'File is rejected with size error',
        },
      },
      async () => {
        const chatActions = createMockChatActions();
        const { container } = render(
          <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
        );

        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const input = await screen.findByPlaceholderText('Send a message...');
        await waitFor(() => expect(input).not.toBeDisabled());

        // Create 26MB file
        const content = 'x'.repeat(26 * 1024 * 1024);
        const largeFile = new File([content], 'huge.pdf', { type: 'application/pdf' });

        await simulateFileDrop(container, [largeFile], attachmentUser);

        // Should show size limit error mentioning 25MB
        await waitFor(() => {
          expect(screen.getByText(/25MB/i)).toBeInTheDocument();
        });

        // No chip should be added
        const chipNames = getAttachmentChipNames(container);
        expect(chipNames).toHaveLength(0);
      }
    );

    it(
      'should accept files between 10MB and 25MB (new limit)',
      {
        meta: {
          alias: 'Attach-Accept-20MB',
          scenario: 'User uploads 20MB file (over old 10MB limit)',
          behavior: 'File is accepted with new 25MB limit',
        },
      },
      async () => {
        const mockUpload = vi.fn().mockResolvedValue({
          id: 'large-uuid',
          filename: 'bigfile.pdf',
          gsUrl: 'gs://bucket/123/large-uuid_bigfile.pdf',
          signedUrl: 'https://storage.googleapis.com/...',
          contentType: 'application/pdf',
          sizeBytes: 20 * 1024 * 1024,
        });

        const chatActions = createMockChatActions({
          uploadAttachment: mockUpload,
        });

        const { container } = render(
          <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
        );

        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const input = await screen.findByPlaceholderText('Send a message...');
        await waitFor(() => expect(input).not.toBeDisabled());

        // Create 20MB file (would be rejected by old 10MB limit, accepted by new 25MB limit)
        const content = 'x'.repeat(20 * 1024 * 1024);
        const mediumFile = new File([content], 'medium.pdf', { type: 'application/pdf' });

        await simulateFileDrop(container, [mediumFile], attachmentUser);

        // Should be accepted
        await waitFor(() => {
          const chipNames = getAttachmentChipNames(container);
          expect(chipNames).toContain('medium.pdf');
        });
      }
    );
  });

  describe('New Attachment Count Limit (10)', () => {
    it(
      'should accept up to 10 attachments',
      {
        meta: {
          alias: 'Attach-Accept-10',
          scenario: 'User attaches 10 files',
          behavior: 'All 10 files are accepted',
        },
      },
      async () => {
        const mockUpload = vi.fn().mockImplementation((file) => ({
          id: `uuid-${file.name}`,
          filename: file.name,
          gsUrl: `gs://bucket/123/uuid_${file.name}`,
          signedUrl: 'https://storage.googleapis.com/...',
          contentType: file.type,
          sizeBytes: file.size,
        }));

        const chatActions = createMockChatActions({
          uploadAttachment: mockUpload,
        });

        const { container } = render(
          <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
        );

        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const input = await screen.findByPlaceholderText('Send a message...');
        await waitFor(() => expect(input).not.toBeDisabled());

        // Upload 10 files (exceeds old 5 limit but within new 10 limit)
        for (let i = 0; i < 10; i++) {
          const file = new File([`content-${i}`], `file${i}.pdf`, { type: 'application/pdf' });
          await simulateFileDrop(container, [file], attachmentUser);
        }

        // All 10 should be present
        await waitFor(() => {
          const chipNames = getAttachmentChipNames(container);
          expect(chipNames).toHaveLength(10);
        });
      }
    );

    it(
      'should reject 11th attachment with error',
      {
        meta: {
          alias: 'Attach-Reject-11th',
          scenario: 'User tries to add 11th attachment',
          behavior: '11th file is rejected with max count error',
        },
      },
      async () => {
        const mockUpload = vi.fn().mockImplementation((file) => ({
          id: `uuid-${file.name}`,
          filename: file.name,
          gsUrl: `gs://bucket/123/uuid_${file.name}`,
          signedUrl: 'https://storage.googleapis.com/...',
          contentType: file.type,
          sizeBytes: file.size,
        }));

        const chatActions = createMockChatActions({
          uploadAttachment: mockUpload,
        });

        const { container } = render(
          <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
        );

        await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
        act(() => chatMocks.eventSource!.simulateOpen());

        const input = await screen.findByPlaceholderText('Send a message...');
        await waitFor(() => expect(input).not.toBeDisabled());

        // Upload 10 files
        for (let i = 0; i < 10; i++) {
          const file = new File([`content-${i}`], `file${i}.pdf`, { type: 'application/pdf' });
          await simulateFileDrop(container, [file], attachmentUser);
        }

        await waitFor(() => {
          expect(getAttachmentChipNames(container)).toHaveLength(10);
        });

        // Try to add 11th
        const eleventhFile = new File(['content'], 'extra.pdf', { type: 'application/pdf' });
        await simulateFileDrop(container, [eleventhFile], attachmentUser);

        // Should show max attachments error mentioning 10
        await waitFor(() => {
          expect(screen.getByText(/maximum.*10/i)).toBeInTheDocument();
        });

        // Should still have only 10
        const chipNames = getAttachmentChipNames(container);
        expect(chipNames).toHaveLength(10);
        expect(chipNames).not.toContain('extra.pdf');
      }
    );
  });
});

// =============================================================================
// MESSAGE SENDING WITH NEW ATTACHMENT FORMAT
// =============================================================================

describe('Send Message with Attachments - New Format', () => {
  const attachmentUser = userEvent.setup();

  it.fails(
    'should send attachments with gsUrl (not signedUrl)',
    {
      meta: {
        alias: 'Send-Attach-GsUrl',
        scenario: 'User sends message with attachments',
        behavior: 'Message payload includes gsUrl for transcript logging',
      },
    },
    async () => {
      const mockMessage = vi.fn().mockResolvedValue({ info: 'Message sent' });
      const mockUpload = vi.fn().mockResolvedValue({
        id: 'att-uuid',
        filename: 'report.pdf',
        gsUrl: 'gs://bucket/123/att-uuid_report.pdf',
        signedUrl: 'https://storage.googleapis.com/signed...',
        contentType: 'application/pdf',
        sizeBytes: 5000,
      });

      const chatActions = createMockChatActions({
        message: mockMessage,
        uploadAttachment: mockUpload,
      });

      const { container } = render(
        <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
      );

      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      const input = await screen.findByPlaceholderText('Send a message...');
      await waitFor(() => expect(input).not.toBeDisabled());

      // Upload file
      await simulateFileDrop(container, [testFiles.pdf()], attachmentUser);

      await waitFor(() => {
        expect(getAttachmentChipNames(container)).toHaveLength(1);
      });

      // Type message and send
      await attachmentUser.type(input, 'Here is the report');
      const sendButton = screen.getByRole('button', { name: /send/i });
      await attachmentUser.click(sendButton);

      // Verify message was sent with gsUrl
      await waitFor(() => {
        expect(mockMessage).toHaveBeenCalled();
        const call = mockMessage.mock.calls[0][0];
        expect(call.attachments).toBeDefined();
        expect(call.attachments[0].gsUrl).toBeDefined();
        expect(call.attachments[0].gsUrl).toMatch(/^gs:\/\//);
        // Should NOT include signedUrl in the message payload
        expect(call.attachments[0].signedUrl).toBeUndefined();
      });
    }
  );

  it.fails(
    'should include full metadata in sent message',
    {
      meta: {
        alias: 'Send-Attach-FullMeta',
        scenario: 'User sends message with attachment',
        behavior: 'Message includes id, filename, gsUrl, contentType, sizeBytes',
      },
    },
    async () => {
      const mockMessage = vi.fn().mockResolvedValue({ info: 'Message sent' });
      const mockUpload = vi.fn().mockResolvedValue({
        id: 'full-meta-uuid',
        filename: 'data.xlsx',
        gsUrl: 'gs://bucket/123/full-meta-uuid_data.xlsx',
        signedUrl: 'https://storage.googleapis.com/...',
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        sizeBytes: 15000,
      });

      const chatActions = createMockChatActions({
        message: mockMessage,
        uploadAttachment: mockUpload,
      });

      const { container } = render(
        <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
      );

      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      const input = await screen.findByPlaceholderText('Send a message...');
      await waitFor(() => expect(input).not.toBeDisabled());

      // Upload Excel file
      await simulateFileDrop(container, [testFiles.xlsx()], attachmentUser);

      await waitFor(() => {
        expect(getAttachmentChipNames(container)).toHaveLength(1);
      });

      // Send message
      await attachmentUser.type(input, 'Check the spreadsheet');
      const sendButton = screen.getByRole('button', { name: /send/i });
      await attachmentUser.click(sendButton);

      // Verify full metadata
      await waitFor(() => {
        expect(mockMessage).toHaveBeenCalled();
        const attachment = mockMessage.mock.calls[0][0].attachments[0];
        expect(attachment.id).toBe('full-meta-uuid');
        expect(attachment.filename).toBe('data.xlsx');
        expect(attachment.gsUrl).toBe(
          'gs://bucket/123/full-meta-uuid_data.xlsx'
        );
        expect(attachment.contentType).toBe(
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        );
        expect(attachment.sizeBytes).toBe(15000);
      });
    }
  );
});

// =============================================================================
// TRANSCRIPT DISPLAY WITH ATTACHMENTS
// =============================================================================

describe('Transcript Display with Attachments', () => {
  it.fails(
    'should display attachments from transcript history',
    {
      meta: {
        alias: 'Transcript-Show-Attach',
        scenario: 'User views chat history with attachments',
        behavior: 'Attachments are displayed in message bubbles',
      },
    },
    async () => {
      const mockTranscripts = vi.fn().mockResolvedValue([
        {
          id: 'msg-1',
          role: 'user',
          content: 'Here is the report',
          timestamp: new Date(),
          messageId: 1,
          attachments: [
            {
              id: 'att-uuid',
              filename: 'report.pdf',
              gsUrl: 'gs://bucket/123/att-uuid_report.pdf',
              contentType: 'application/pdf',
              sizeBytes: 12000,
            },
          ],
        },
      ]);

      const chatActions = createMockChatActions({
        getTranscripts: mockTranscripts,
      });

      render(
        <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
      );

      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      // Wait for transcript to load and display
      await waitFor(() => {
        // Should show the attachment in the message
        expect(screen.getByText('report.pdf')).toBeInTheDocument();
      });
    }
  );

  it.fails(
    'should show attachment preview/thumbnail for images',
    {
      meta: {
        alias: 'Transcript-Image-Preview',
        scenario: 'Transcript contains image attachment',
        behavior: 'Image thumbnail is displayed',
      },
    },
    async () => {
      const mockTranscripts = vi.fn().mockResolvedValue([
        {
          id: 'msg-1',
          role: 'user',
          content: 'Check this photo',
          timestamp: new Date(),
          messageId: 1,
          attachments: [
            {
              id: 'img-uuid',
              filename: 'photo.png',
              gsUrl: 'gs://bucket/123/img-uuid_photo.png',
              contentType: 'image/png',
              sizeBytes: 50000,
            },
          ],
        },
      ]);

      // Mock signed URL generation for image preview
      const mockSignedUrl = vi.fn().mockResolvedValue({
        signedUrl: 'https://storage.googleapis.com/signed-preview-url',
      });

      const chatActions = createMockChatActions({
        getTranscripts: mockTranscripts,
        getSignedUrl: mockSignedUrl,
      });

      render(
        <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
      );

      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      // Wait for image thumbnail to load
      await waitFor(() => {
        const img = screen.getByRole('img', { name: /photo\.png/i });
        expect(img).toBeInTheDocument();
        expect(img).toHaveAttribute('src', expect.stringContaining('storage.googleapis.com'));
      });
    }
  );

  it.fails(
    'should show "unavailable" state for deleted attachments',
    {
      meta: {
        alias: 'Transcript-Unavailable-Attach',
        scenario: 'Attachment source file was deleted (user deleted)',
        behavior: 'Shows unavailable indicator instead of preview',
      },
    },
    async () => {
      const mockTranscripts = vi.fn().mockResolvedValue([
        {
          id: 'msg-1',
          role: 'user',
          content: 'Old attachment',
          timestamp: new Date(),
          messageId: 1,
          attachments: [
            {
              id: 'deleted-uuid',
              filename: 'deleted.pdf',
              gsUrl:
                'gs://bucket/deleted-user/deleted-uuid_deleted.pdf',
              contentType: 'application/pdf',
              sizeBytes: 5000,
            },
          ],
        },
      ]);

      // Mock 404 for deleted file
      const mockSignedUrl = vi.fn().mockRejectedValue({ status: 404 });

      const chatActions = createMockChatActions({
        getTranscripts: mockTranscripts,
        getSignedUrl: mockSignedUrl,
      });

      render(
        <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
      );

      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      // Should show unavailable state
      await waitFor(() => {
        expect(screen.getByText(/unavailable/i)).toBeInTheDocument();
        // Should still show the filename for reference
        expect(screen.getByText('deleted.pdf')).toBeInTheDocument();
      });
    }
  );
});
