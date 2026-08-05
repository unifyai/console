import type { ChatMention } from '@/types/orgChat';

/**
 * Who a room message addresses, read from the text the sender actually wrote.
 *
 * Mentions used to be recorded only when picked from the autocomplete, so
 * typing "@Ada" by hand sent an empty list. That was survivable while mentions
 * were decoration; it stopped being so once the runtime began using them to
 * decide whose turn it is to answer — an assistant addressed by a hand-typed
 * name saw no mention at all and stood down. Reading the submitted text instead
 * makes the picker a convenience rather than the only path.
 *
 * Longest name first, and each match consumes its span, so "@Ada Chen" resolves
 * to Ada Chen rather than also matching a separate "Ada".
 */
export function resolveMentionsInText(
  content: string,
  candidates: readonly ChatMention[] | undefined
): ChatMention[] {
  if (!content || !candidates?.length) return [];

  const byLongestName = [...candidates]
    .filter((candidate) => (candidate.name ?? '').trim().length > 0)
    .sort((a, b) => (b.name ?? '').length - (a.name ?? '').length);

  // Matched spans are blanked rather than removed, so later offsets stay valid.
  let remaining = content;
  const found: ChatMention[] = [];

  for (const candidate of byLongestName) {
    const token = `@${candidate.name}`;
    const at = remaining.indexOf(token);
    if (at === -1) continue;
    if (found.some((m) => m.kind === candidate.kind && m.id === candidate.id)) continue;
    found.push(candidate);
    remaining =
      remaining.slice(0, at) + ' '.repeat(token.length) + remaining.slice(at + token.length);
  }

  // Report in the order the names appear, which is how the reader meets them.
  return found.sort((a, b) => content.indexOf(`@${a.name}`) - content.indexOf(`@${b.name}`));
}
