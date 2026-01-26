import * as React from 'react';
import { render, screen, waitFor, act, fireEvent } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock the Server Action module
vi.mock('@/lib/assistants/preHireChat', () => ({
  sendPreHireChatMessage: vi.fn().mockResolvedValue({ content: 'Mocked response' }),
  generatePostHireGreeting: vi.fn().mockResolvedValue({ content: 'Hello! I am ready to work.' }),
}));

import {
  setupChatMocks,
  cleanupChatMocks,
  createMockChatActions,
  ChatTestHarness,
  getChatInput,
  getSendButton,
  getChatBubbles,
  testFiles,
  simulateFileDrop,
  getAttachButton,
  getAttachmentChips,
  getAttachmentChipNames,
  removeAttachmentChip,
  isDragActiveVisible,
} from './fixtures';
import { ChatMessage } from '@/types/assistants/chat';

describe('Chat Attachments', () => {
  let chatMocks: ReturnType<typeof setupChatMocks>;
  const user = userEvent.setup();

  beforeEach(() => {
    chatMocks = setupChatMocks();
  });

  afterEach(() => {
    cleanupChatMocks();
  });

  describe('Paperclip Button', () => {
    it('should render paperclip button and be enabled when connected', async () => {
      const chatActions = createMockChatActions();
      render(
        <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
      );

      // Wait for EventSource and open connection
      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      // Wait for input to be enabled (using findBy which waits)
      const input = await screen.findByPlaceholderText('Send a message...');
      await waitFor(() => expect(input).not.toBeDisabled());

      // Attach button should also be enabled when connection is ready
      const attachButton = getAttachButton(screen);
      expect(attachButton).not.toBeDisabled();
    });

    it('should be disabled when chat is not connected', async () => {
      const chatActions = createMockChatActions();
      render(
        <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
      );

      // Wait for EventSource to be created but don't open it
      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());

      // Button should render but be disabled without connection
      const attachButton = await screen.findByLabelText('Attach files');
      expect(attachButton).toBeDisabled();
    });
  });

  describe('File Selection', () => {
    it('should add attachment chip when file is selected', async () => {
      const chatActions = createMockChatActions();
      const { container } = render(
        <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
      );

      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      // Wait for connection to be ready
      const input = await screen.findByPlaceholderText('Send a message...');
      await waitFor(() => expect(input).not.toBeDisabled());

      // Upload a file
      const file = testFiles.pdf();
      await simulateFileDrop(container, [file], user);

      // Check chip was added
      await waitFor(() => {
        const chipNames = getAttachmentChipNames(container);
        expect(chipNames).toContain('report.pdf');
      });
    });

    it('should show correct icon for PDF files', async () => {
      const chatActions = createMockChatActions();
      const { container } = render(
        <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
      );

      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      const input = await screen.findByPlaceholderText('Send a message...');
      await waitFor(() => expect(input).not.toBeDisabled());

      const file = testFiles.pdf();
      await simulateFileDrop(container, [file], user);

      await waitFor(() => {
        const chips = getAttachmentChips(container);
        expect(chips.length).toBe(1);
        // Icon should be present
        const icon = chips[0].querySelector('[data-testid="attachment-icon"]');
        expect(icon).toBeInTheDocument();
      });
    });

    it('should show correct icon for image files', async () => {
      const chatActions = createMockChatActions();
      const { container } = render(
        <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
      );

      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      const input = await screen.findByPlaceholderText('Send a message...');
      await waitFor(() => expect(input).not.toBeDisabled());

      const file = testFiles.png();
      await simulateFileDrop(container, [file], user);

      await waitFor(() => {
        const chipNames = getAttachmentChipNames(container);
        expect(chipNames).toContain('image.png');
      });
    });

    it('should handle multiple file types', async () => {
      const chatActions = createMockChatActions();
      const { container } = render(
        <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
      );

      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      const input = await screen.findByPlaceholderText('Send a message...');
      await waitFor(() => expect(input).not.toBeDisabled());

      // Upload multiple files
      await simulateFileDrop(container, [testFiles.pdf()], user);
      await simulateFileDrop(container, [testFiles.png()], user);
      await simulateFileDrop(container, [testFiles.docx()], user);

      await waitFor(() => {
        const chipNames = getAttachmentChipNames(container);
        expect(chipNames).toHaveLength(3);
        expect(chipNames).toContain('report.pdf');
        expect(chipNames).toContain('image.png');
        expect(chipNames).toContain('document.docx');
      });
    });
  });

  describe('File Validation', () => {
    it('should reject files over 10MB with toast error', async () => {
      const chatActions = createMockChatActions();
      const { container } = render(
        <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
      );

      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      const input = await screen.findByPlaceholderText('Send a message...');
      await waitFor(() => expect(input).not.toBeDisabled());

      const file = testFiles.large();
      await simulateFileDrop(container, [file], user);

      // File should not be added
      await waitFor(
        () => {
          const chipNames = getAttachmentChipNames(container);
          expect(chipNames).toHaveLength(0);
        },
        { timeout: 1000 }
      );
    });

    it('should reject more than 5 attachments with toast error', async () => {
      const chatActions = createMockChatActions();
      const { container } = render(
        <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
      );

      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      // Add 5 files
      await simulateFileDrop(container, [testFiles.pdf()], user);
      await simulateFileDrop(container, [testFiles.png()], user);
      await simulateFileDrop(container, [testFiles.docx()], user);
      await simulateFileDrop(container, [testFiles.txt()], user);
      await simulateFileDrop(container, [testFiles.json()], user);

      await waitFor(() => {
        const chipNames = getAttachmentChipNames(container);
        expect(chipNames).toHaveLength(5);
      });

      // Try to add a 6th file
      await simulateFileDrop(container, [testFiles.zip()], user);

      // Should still have only 5
      await waitFor(() => {
        const chipNames = getAttachmentChipNames(container);
        expect(chipNames).toHaveLength(5);
      });
    });

    it('should silently skip duplicate files', async () => {
      const chatActions = createMockChatActions();
      const { container } = render(
        <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
      );

      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      const input = await screen.findByPlaceholderText('Send a message...');
      await waitFor(() => expect(input).not.toBeDisabled());

      // Add same file twice
      await simulateFileDrop(container, [testFiles.pdf()], user);
      await simulateFileDrop(container, [testFiles.pdf()], user);

      await waitFor(() => {
        const chipNames = getAttachmentChipNames(container);
        expect(chipNames).toHaveLength(1);
      });
    });
  });

  describe('Attachment Management', () => {
    it('should remove attachment when X is clicked', async () => {
      const chatActions = createMockChatActions();
      const { container } = render(
        <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
      );

      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      const input = await screen.findByPlaceholderText('Send a message...');
      await waitFor(() => expect(input).not.toBeDisabled());

      await simulateFileDrop(container, [testFiles.pdf()], user);

      await waitFor(() => {
        const chipNames = getAttachmentChipNames(container);
        expect(chipNames).toHaveLength(1);
      });

      // Remove the file
      await removeAttachmentChip(container, 'report.pdf', user);

      await waitFor(() => {
        const chipNames = getAttachmentChipNames(container);
        expect(chipNames).toHaveLength(0);
      });
    });

    it('should allow adding more files after removing one', async () => {
      const chatActions = createMockChatActions();
      const { container } = render(
        <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
      );

      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      const input = await screen.findByPlaceholderText('Send a message...');
      await waitFor(() => expect(input).not.toBeDisabled());

      // Add 5 files (max)
      await simulateFileDrop(container, [testFiles.pdf()], user);
      await simulateFileDrop(container, [testFiles.png()], user);
      await simulateFileDrop(container, [testFiles.docx()], user);
      await simulateFileDrop(container, [testFiles.txt()], user);
      await simulateFileDrop(container, [testFiles.json()], user);

      await waitFor(() => {
        expect(getAttachmentChipNames(container)).toHaveLength(5);
      });

      // Remove one
      await removeAttachmentChip(container, 'report.pdf', user);

      await waitFor(() => {
        expect(getAttachmentChipNames(container)).toHaveLength(4);
      });

      // Should be able to add another
      await simulateFileDrop(container, [testFiles.zip()], user);

      await waitFor(() => {
        const chipNames = getAttachmentChipNames(container);
        expect(chipNames).toHaveLength(5);
        expect(chipNames).toContain('archive.zip');
      });
    });

    it('should clear all attachments after sending', async () => {
      let sentMessages: ChatMessage[] = [];
      const chatActions = createMockChatActions();
      const { container } = render(
        <ChatTestHarness
          initialHistory={[]}
          assistantActionsOverride={{ chat: chatActions }}
          onHistoryChange={(history) => {
            sentMessages = history;
          }}
        />
      );

      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      // Wait for chat to be ready
      const input = await screen.findByPlaceholderText('Send a message...');
      await waitFor(() => expect(input).not.toBeDisabled());

      // Add attachment
      await simulateFileDrop(container, [testFiles.pdf()], user);

      await waitFor(() => {
        expect(getAttachmentChipNames(container)).toHaveLength(1);
      });

      // Type some text
      await user.type(input, 'Sending with attachment');

      // Press Enter to send
      await user.keyboard('{Enter}');

      // Verify message was sent with attachment
      await waitFor(() => {
        expect(sentMessages.length).toBeGreaterThan(0);
        const lastMessage = sentMessages[sentMessages.length - 1];
        expect(lastMessage.content).toBe('Sending with attachment');
        expect(lastMessage.attachments).toBeDefined();
        expect(lastMessage.attachments).toHaveLength(1);
        expect(lastMessage.attachments?.[0].name).toBe('report.pdf');
      });

      // Input should be cleared
      await waitFor(() => {
        expect(input).toHaveValue('');
      });

      // Allow React to complete all rendering updates
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Pending attachments should be cleared from UI (not in message bubbles)
      const pendingChips = screen.queryAllByTestId('pending-attachment-chip');
      expect(pendingChips).toHaveLength(0);
    });
  });

  describe('Sending Messages', () => {
    it('should send message with text and attachments', async () => {
      const chatActions = createMockChatActions();
      const { container } = render(
        <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
      );

      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      // Wait for input to be enabled
      const input = getChatInput(screen);
      await waitFor(() => {
        expect(input).not.toBeDisabled();
      });

      // Type message
      await user.type(input, 'Here is the file');

      // Add attachment
      await simulateFileDrop(container, [testFiles.pdf()], user);

      await waitFor(() => {
        expect(getAttachmentChipNames(container)).toHaveLength(1);
      });

      // Send
      const sendButton = getSendButton(screen);
      await waitFor(() => {
        expect(sendButton).not.toBeDisabled();
      });
      await user.click(sendButton);

      // Message should be sent
      await waitFor(
        () => {
          const bubbles = getChatBubbles(screen);
          expect(bubbles.some((b) => b?.includes('Here is the file'))).toBe(true);
        },
        { timeout: 2000 }
      );
    });

    it('should send message with only attachments (no text)', async () => {
      let sentMessages: ChatMessage[] = [];
      const chatActions = createMockChatActions();
      const { container } = render(
        <ChatTestHarness
          initialHistory={[]}
          assistantActionsOverride={{ chat: chatActions }}
          onHistoryChange={(history) => {
            sentMessages = history;
          }}
        />
      );

      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      // Wait for input to be enabled
      const input = await screen.findByPlaceholderText('Send a message...');
      await waitFor(() => expect(input).not.toBeDisabled());

      // Initially send button should be disabled (no content)
      let sendButton = getSendButton(screen);
      expect(sendButton).toBeDisabled();

      // Add attachment without typing any text
      await simulateFileDrop(container, [testFiles.pdf()], user);

      await waitFor(() => {
        expect(getAttachmentChipNames(container)).toHaveLength(1);
      });

      // Send button should now be enabled (attachment counts as content)
      await waitFor(() => {
        sendButton = getSendButton(screen);
        expect(sendButton).not.toBeDisabled();
      });

      // Click send button with user event
      await user.click(sendButton);

      // Verify message was sent with attachment (even without text)
      await waitFor(() => {
        expect(sentMessages.length).toBeGreaterThan(0);
        const lastMessage = sentMessages[sentMessages.length - 1];
        expect(lastMessage.content).toBe(''); // No text
        expect(lastMessage.attachments).toBeDefined();
        expect(lastMessage.attachments).toHaveLength(1);
        expect(lastMessage.attachments?.[0].name).toBe('report.pdf');
      });

      // Input should still be empty (no text was typed)
      await waitFor(() => {
        expect(input).toHaveValue('');
      });

      // Allow React to complete all rendering updates
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 50));
      });

      // Pending attachments should be cleared from UI (not in message bubbles)
      const pendingChips = screen.queryAllByTestId('pending-attachment-chip');
      expect(pendingChips).toHaveLength(0);
    });

    it('should enable send button when attachments added', async () => {
      const chatActions = createMockChatActions();
      const { container } = render(
        <ChatTestHarness initialHistory={[]} assistantActionsOverride={{ chat: chatActions }} />
      );

      await waitFor(() => expect(chatMocks.eventSource).not.toBeNull());
      act(() => chatMocks.eventSource!.simulateOpen());

      // Wait for input to be ready
      const input = await screen.findByPlaceholderText('Send a message...');
      await waitFor(() => expect(input).not.toBeDisabled());

      // Send button should be disabled without text or attachments
      let sendButton = getSendButton(screen);
      expect(sendButton).toBeDisabled();

      // Add attachment
      await simulateFileDrop(container, [testFiles.pdf()], user);

      await waitFor(() => {
        expect(getAttachmentChipNames(container)).toHaveLength(1);
      });

      // Send button should now be enabled
      await waitFor(() => {
        sendButton = getSendButton(screen);
        expect(sendButton).not.toBeDisabled();
      });
    });
  });
});
