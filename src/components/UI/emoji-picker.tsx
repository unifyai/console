'use client';

import * as React from 'react';
import dynamic from 'next/dynamic';
import { useTheme } from 'next-themes';
import { Theme as EmojiTheme, EmojiStyle, type EmojiClickData } from 'emoji-picker-react';
import { cn } from '@/lib/utils';

const FullEmojiPicker = dynamic(() => import('emoji-picker-react'), { ssr: false });

interface EmojiPickerProps {
  width: number;
  height: number;
  onSelect: (emoji: string) => void;
  /**
   * Skin tones are a person's choice about a person. A picker choosing the
   * face on a room, a file or a list has nobody to tone, and the control is
   * the widest thing in a header that has no width to spare.
   */
  skinTonesDisabled?: boolean;
  className?: string;
}

/**
 * The emoji picker, wearing the app's own surface.
 *
 * The library ships a picker sized for a page of its own: an opaque white
 * card, a 40px search field, 30px category buttons and 40px emoji tiles. Drop
 * that into a popover and two things go wrong — the card reads as a second,
 * whiter surface floating on ours, and its chrome eats over half the box, so
 * the grid everyone opened it for gets the smaller half.
 *
 * `.app-emoji-picker` in globals.css maps the library's whole `--epr-*`
 * surface onto our tokens and takes the chrome down a band. It has to live
 * there rather than here because the library renders its own internals, and
 * its class names are the only handle on them.
 *
 * Every emoji surface goes through this component, so the treatment cannot
 * reach one picker and miss another — which is exactly how the group-icon
 * picker spent a release wearing the library's white card while the chat's
 * wore ours.
 */
export function EmojiPicker({
  width,
  height,
  onSelect,
  skinTonesDisabled = false,
  className,
}: EmojiPickerProps) {
  const { resolvedTheme } = useTheme();

  const theme =
    resolvedTheme === 'dark'
      ? EmojiTheme.DARK
      : resolvedTheme === 'light'
        ? EmojiTheme.LIGHT
        : EmojiTheme.AUTO;

  return (
    <FullEmojiPicker
      open
      theme={theme}
      emojiStyle={EmojiStyle.NATIVE}
      className={cn('app-emoji-picker', className)}
      width={width}
      height={height}
      lazyLoadEmojis
      autoFocusSearch={false}
      skinTonesDisabled={skinTonesDisabled}
      previewConfig={{ showPreview: false }}
      onEmojiClick={(data: EmojiClickData) => onSelect(data.emoji)}
    />
  );
}
