'use server';

/**
 * Pre-hire Chat Server Action
 *
 * This is a Server Action, NOT an API route. Server Actions cannot be called
 * directly via HTTP - they can only be invoked through React's internal mechanism.
 * This prevents abuse by external scripts or direct API calls.
 *
 * Credits are deducted from the user's account for each message. The cost is
 * charged to the billing user associated with the API key:
 * - Personal workspace: User's own account
 * - Organization workspace: Organization's billing_user_id account
 */

import { getCurrentUser } from '@/lib/user/user';
import { ChatCompletionMessage } from '@/types/assistants/chat';
import { createOpenAI } from '@ai-sdk/openai';
import { generateText, LanguageModel } from 'ai';
import { checkCreditsBalance, deductCredits } from '@/lib/user/credits';
import { PRE_HIRE_CHAT_MESSAGE_COST } from '@/constants/assistants/settings';

// Use custom env variable for OpenAI API key
const openai = createOpenAI({
  apiKey: process.env.ORCHESTRA_OPENAI_API_KEY,
});

const getModel = (modelId: string) => openai(modelId) as LanguageModel;

// Abuse prevention limits (not billing-related)
const MAX_MESSAGE_LENGTH = 2000;

export interface PreHireChatResult {
  content?: string;
  error?: string;
}

/**
 * Send a message in the pre-hire chat.
 * This is used BEFORE an assistant is hired for the user to preview the assistant.
 *
 * Credits are checked before the LLM call and deducted after a successful response.
 * If the user has insufficient credits, an INSUFFICIENT_CREDITS error is returned.
 */
export async function sendPreHireChatMessage(
  messages: ChatCompletionMessage[],
  assistantName: string,
  assistantAge: number | null,
  assistantBio: string | null
): Promise<PreHireChatResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: 'Unauthorized' };
    }

    const apiKey = user.apiKey;
    if (!apiKey) {
      return { error: 'Unauthorized - no API key' };
    }

    const userName = `${user.name} ${user.lastName}`;

    if (!messages || !Array.isArray(messages)) {
      return { error: 'Invalid request: messages are required.' };
    }

    // Check message length (abuse prevention)
    const hasOversizedMessage = messages.some(
      (msg) => msg.content && msg.content.length > MAX_MESSAGE_LENGTH
    );
    if (hasOversizedMessage) {
      return { error: `Message too long. Maximum ${MAX_MESSAGE_LENGTH} characters per message.` };
    }

    // Check credits balance before making the LLM call
    const creditsCheck = await checkCreditsBalance(apiKey, PRE_HIRE_CHAT_MESSAGE_COST);
    if (creditsCheck.error) {
      console.error('[preHireChat] Credits check error:', creditsCheck.error);
      return { error: 'INSUFFICIENT_CREDITS' };
    }
    if (!creditsCheck.hasSufficientCredits) {
      return { error: 'INSUFFICIENT_CREDITS' };
    }

    const systemPrompt = `You are an assistant named ${assistantName || 'Assistant'}, who is ${assistantAge || 'ageless'}. You are speaking with ${userName}, who is considering hiring you as a general administrative assistant. Here is a bit about yourself: ${assistantBio || 'I am a diligent and capable assistant.'}. If ${userName} asks any questions about yourself, and this is not covered in the short bio above, then please just make up a sensible response to their question. If they ask what you're able to do, then explain that you can do anything that a very competent virtual administrative assistant can do. You have your own computer with your own mouse and keyboard, your own email address and phone number, and you are a fast learner who quickly learns from on-the-job experience. If the ${userName} is interested in pursuing further, then politely (not forcefully) suggest hiring in order to hop on an introductory call. If un-impressed, then it's a zero-hour contract so it's not a big deal.`;

    const messagesWithSystemPrompt: ChatCompletionMessage[] = [
      { role: 'system', content: systemPrompt },
      ...messages,
    ];

    const result = await generateText({
      model: getModel('gpt-4o-mini'),
      messages: messagesWithSystemPrompt,
    });

    // Deduct credits after successful LLM response
    const deductResult = await deductCredits(apiKey, PRE_HIRE_CHAT_MESSAGE_COST);
    if (!deductResult.success) {
      // Log the error but don't fail the request since the LLM call succeeded
      // This is a rare edge case (balance changed between check and deduct)
      console.error('[preHireChat] Credits deduction failed:', deductResult.error);
      // If it's insufficient credits, still return the error to the user
      if (deductResult.error === 'INSUFFICIENT_CREDITS') {
        return { error: 'INSUFFICIENT_CREDITS' };
      }
    }

    return { content: result.text };
  } catch (error) {
    console.error('[preHireChat] Error:', error);
    return { error: error instanceof Error ? error.message : 'An unknown error occurred.' };
  }
}

/**
 * Generate a post-hire greeting message.
 * This is used AFTER an assistant is hired to generate their first message.
 *
 * Note: This operation is considered part of the assistant onboarding process
 * and is covered by the ASSISTANT_ONBOARDING_FEE, not charged separately.
 */
export async function generatePostHireGreeting(
  assistantName: string,
  assistantAge: number | null,
  assistantBio: string | null,
  assistantNationality: string | null
): Promise<PreHireChatResult> {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return { error: 'Unauthorized' };
    }
    const userName = `${user.name} ${user.lastName}`;

    const displayName = assistantName.replace(/([A-Z])/g, ' $1').trim();
    const greetingSystemPrompt = `You are ${displayName}, a personal assistant for ${userName}. You were just hired. Your profile is: Age ${assistantAge || 'ageless'}, from ${assistantNationality || 'an undisclosed location'}, and your bio is "${assistantBio || 'a helpful assistant'}". Generate a friendly, welcoming first chat message (2-3 sentences) to ${userName}. This will appear in a browser-based chat interface, so write it as a casual chat message — no subject line, no email-style salutation or sign-off. In your message, mention that you're ready to get started and that they can reach you via this chat, by phone call, or by text message.`;

    const result = await generateText({
      model: getModel('gpt-4o-mini'),
      messages: [{ role: 'system', content: greetingSystemPrompt }],
    });

    return { content: result.text };
  } catch (error) {
    console.error('[preHireChat] Greeting error:', error);
    return { error: error instanceof Error ? error.message : 'An unknown error occurred.' };
  }
}
