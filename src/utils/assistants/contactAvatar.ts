import type { Assistant, ContactIdentityRoot } from '@/types/assistants/assistant';

function identityRoots(assistant: Assistant): ContactIdentityRoot[] {
  if (assistant.contactIdentityRoots?.length) {
    return assistant.contactIdentityRoots;
  }
  return [
    {
      targetScope: 'personal',
      targetTeamId: null,
      selfContactId: assistant.selfContactId,
      bossContactId: assistant.bossContactId,
    },
  ];
}

export function contactIsAssistantSelf(
  assistant: Assistant,
  contactId: number | null | undefined
): boolean {
  if (contactId == null) return false;
  if (contactId === assistant.selfContactId) return true;
  return identityRoots(assistant).some((root) => root.selfContactId === contactId);
}

export function contactIsBoss(assistant: Assistant, contactId: number | null | undefined): boolean {
  if (contactId == null) return false;
  if (contactId === assistant.bossContactId) return true;
  return identityRoots(assistant).some((root) => root.bossContactId === contactId);
}

export function assistantProfilePhotoSrc(assistant: Assistant): string | null {
  return assistant.signedProfilePhotoUrl || assistant.profilePhoto || null;
}
