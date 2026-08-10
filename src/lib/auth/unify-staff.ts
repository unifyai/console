/**
 * Unify staff identity.
 *
 * Org names are user-choosable — anyone may call their organization
 * "Unify" — so anything granting internal privileges must key on the
 * authenticated session email (verified by the identity provider), not
 * only on membership in an org so named.
 */

export const UNIFY_EMAIL_DOMAIN = '@unify.ai';

/** Whether the email is a unify.ai mailbox. */
export function isUnifyStaff(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(UNIFY_EMAIL_DOMAIN);
}

/** Whether the user is staff operating inside the Unify organization. */
export function isUnifyStaffMember(
  email: string | null | undefined,
  organizations: ReadonlyArray<{ name: string }> | null | undefined
): boolean {
  return isUnifyStaff(email) && (organizations?.some((o) => o.name === 'Unify') ?? false);
}
