/**
 * Every transcript renderer must handle typed meeting-chat lines.
 *
 * There are two of them, reading from different stores: the call-pill dialog
 * reads call-utterance rows, the Transcripts pane reads Transcripts rows. Chat
 * rendering was added to the dialog alone, and the pane went on showing typed
 * lines with a play button that seeks to audio they were never part of — the
 * kind of gap no per-component test catches, because each component passes its
 * own tests.
 *
 * This is a structural guard rather than a behavioural one: it fails when a
 * renderer gains a seek control without the chat check, including a third one
 * nobody has written yet.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(process.cwd(), 'src');

/** Marker for "this file renders a per-line playback control". */
const SEEK_MARKER = 'seek-button';
/** The shared predicate every such file must consult. */
const CHAT_GUARD = 'isChat';

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) return walk(path);
    return path.endsWith('.tsx') && !path.includes('.test.') ? [path] : [];
  });
}

describe('transcript chat rendering', () => {
  const renderers = walk(SRC).filter((path) => readFileSync(path, 'utf8').includes(SEEK_MARKER));

  it('finds the renderers it is meant to police', () => {
    // A refactor that renames the testid would otherwise leave this suite
    // passing over an empty set.
    expect(renderers.length).toBeGreaterThanOrEqual(2);
  });

  it.each(renderers.map((path) => [path.slice(SRC.length + 1)]))(
    '%s gates its seek control on whether the line was typed',
    (relative) => {
      const source = readFileSync(join(SRC, relative), 'utf8');
      expect(source).toContain(CHAT_GUARD);
    }
  );
});
