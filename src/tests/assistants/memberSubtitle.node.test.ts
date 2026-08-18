/**
 * The "x real · y virtual" subtitle under a team or group in the roster.
 *
 * The regression covered here: the real count used to subtract the viewing
 * user, on the belief that the roster list below it omitted them too. It never
 * did — the viewer is rendered as an ordinary row marked "(you)" — so a solo
 * org read "0 real" while listing one person, and disagreed with the chat
 * header, which counts the whole membership.
 */
import { describe, expect, it } from 'vitest';
import { formatRealVirtualSubtitle } from '@/utils/orgChat/memberSubtitle';

describe('formatRealVirtualSubtitle', () => {
  it('counts the viewing user, who is a member like anyone else', () => {
    expect(formatRealVirtualSubtitle(['u-julia'], 2)).toBe('1 real · 2 virtual');
  });

  it('counts every human member', () => {
    expect(formatRealVirtualSubtitle(['u-julia', 'u-dan', 'u-ada'], 1)).toBe('3 real · 1 virtual');
  });

  it('handles a membership with no humans', () => {
    expect(formatRealVirtualSubtitle([], 4)).toBe('0 real · 4 virtual');
  });
});
