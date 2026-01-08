'use client';

import React from 'react';
import ChatInView from './ChatInView';
import ChatOutView from './ChatOutView';
import { LogComparisonProps } from '../types';
import { LogsActions } from '@/types/interfaces/grid';
import { LogProps } from '@/types/interfaces/logs';

/**
 * A quick check for “chat-out”: has "id" and "choices" array.
 */
function isChatOutShape(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  return 'id' in obj && 'choices' in obj && Array.isArray(obj.choices);
}

/**
 * A quick check for “chat-in”: has "messages" array and optional "model" string.
 */
function isChatInShape(obj: any): boolean {
  if (!obj || typeof obj !== 'object') return false;
  if (!('messages' in obj) || !Array.isArray(obj.messages)) return false;
  // if needed, you can also require "model" in obj && typeof obj.model === "string"
  return true;
}

/**
 * ChatView: universal entry point for either ChatInView or ChatOutView.
 * If something looks like both shapes, you can pick a priority or do further checks.
 */
export default function ChatView(
  props: LogComparisonProps & {
    isImmutable?: boolean;
    fieldName: string;
    context: string | null;
    baseLog: LogProps | undefined;
    comparisonLogs: LogProps[] | undefined;
    logsActions?: LogsActions;
  }
) {
  const { value } = props;

  // If it matches the “chat-in” shape => ChatInView
  if (isChatInShape(value)) {
    return <ChatInView {...props} />;
  }

  // Otherwise if it matches the “chat-out” shape => ChatOutView
  if (isChatOutShape(value)) {
    return <ChatOutView {...props} />;
  }

  // fallback => mention not recognized
  return (
    <p className="text-red-500">ChatView: Value is not recognized as chat-in or chat-out shape.</p>
  );
}
