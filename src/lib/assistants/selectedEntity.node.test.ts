import { describe, expect, it } from 'vitest';
import {
  parseSelectedEntityKey,
  resolveOrgEntitySelection,
  teamEntityKey,
} from '@/lib/assistants/selectedEntity';

const emptyRoster = { humans: [], teams: [], groups: [] };

describe('resolveOrgEntitySelection', () => {
  it('keeps assistant selections in any workspace', () => {
    expect(
      resolveOrgEntitySelection({
        entity: parseSelectedEntityKey('524'),
        organizationId: null,
        roster: null,
      })
    ).toBe('keep');
  });

  it('clears team/human/group selections in personal workspace', () => {
    expect(
      resolveOrgEntitySelection({
        entity: parseSelectedEntityKey(teamEntityKey(11)),
        organizationId: null,
        roster: null,
      })
    ).toBe('clear');
    expect(
      resolveOrgEntitySelection({
        entity: parseSelectedEntityKey('human:user-1'),
        organizationId: null,
        roster: emptyRoster,
      })
    ).toBe('clear');
  });

  it('waits for roster in an org workspace', () => {
    expect(
      resolveOrgEntitySelection({
        entity: parseSelectedEntityKey(teamEntityKey(11)),
        organizationId: '1',
        roster: null,
      })
    ).toBe('pending');
  });

  it('keeps a team that exists in the settled roster', () => {
    expect(
      resolveOrgEntitySelection({
        entity: parseSelectedEntityKey(teamEntityKey(11)),
        organizationId: '1',
        roster: {
          humans: [],
          teams: [{ teamId: 11 }],
          groups: [],
        },
      })
    ).toBe('keep');
  });

  it('clears a team missing from the settled roster', () => {
    expect(
      resolveOrgEntitySelection({
        entity: parseSelectedEntityKey(teamEntityKey(11)),
        organizationId: '1',
        roster: emptyRoster,
      })
    ).toBe('clear');
  });
});
