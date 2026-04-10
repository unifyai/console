'use client';

/**
 * UserScopeFilter Component
 *
 * Dropdown to select the user scope for viewing usage data.
 * Shows "My Usage", "All Organization", and individual org members.
 * Only visible to admin/owner users.
 */

import * as React from 'react';
import { User } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectGroup,
  SelectSeparator,
} from '@/components/UI/select';
import { UserScope } from '@/types/usage';
import { OrgMember } from '../Main';

interface UserScopeFilterProps {
  /** Current scope value */
  value: UserScope;
  /** Callback when scope changes */
  onChange: (value: UserScope) => void;
  /** Currently selected member ID (when value is 'member') */
  selectedMemberId: string | null;
  /** Callback when a specific member is selected */
  onMemberChange: (memberId: string | null) => void;
  /** List of organization members */
  orgMembers: OrgMember[];
  /** Current user's ID (to identify "My Usage" option) */
  currentUserId: string;
  /** Whether the filter is disabled */
  disabled?: boolean;
  /** Whether to show this filter (only for admins) */
  visible?: boolean;
}

export function UserScopeFilter({
  value,
  onChange,
  selectedMemberId,
  onMemberChange,
  orgMembers,
  currentUserId,
  disabled = false,
  visible = true,
}: UserScopeFilterProps) {
  // Compute the display text based on current selection
  // Must be before any conditional returns to follow Rules of Hooks
  const displayText = React.useMemo(() => {
    if (value === 'self') {
      return 'My Usage';
    }
    if (value === 'org') {
      return 'All Organization';
    }
    // Member scope - find the selected member's name
    if (value === 'member' && selectedMemberId) {
      const member = orgMembers.find((m) => m.userId === selectedMemberId);
      return member?.name || 'Team Member';
    }
    return 'My Usage';
  }, [value, selectedMemberId, orgMembers]);

  // Combine value and selectedMemberId into a single select value
  // Format: "self", "org", or "member:userId"
  const selectValue = React.useMemo(() => {
    if (value === 'member' && selectedMemberId) {
      return `member:${selectedMemberId}`;
    }
    return value;
  }, [value, selectedMemberId]);

  // Separate current user from other members
  const otherMembers = React.useMemo(
    () => orgMembers.filter((m) => m.userId !== currentUserId),
    [orgMembers, currentUserId]
  );

  const handleValueChange = React.useCallback(
    (newValue: string) => {
      if (newValue === 'self') {
        onChange('self');
      } else if (newValue === 'org') {
        onChange('org');
      } else if (newValue.startsWith('member:')) {
        const memberId = newValue.replace('member:', '');
        onChange('member');
        onMemberChange(memberId);
      }
    },
    [onChange, onMemberChange]
  );

  // Early return after all hooks
  if (!visible) {
    return null;
  }

  return (
    <Select value={selectValue} onValueChange={handleValueChange} disabled={disabled}>
      <SelectTrigger className="h-8 w-full sm:w-[180px]" data-testid="user-scope-filter">
        <User className="mr-2 h-4 w-4 shrink-0" />
        <span className="flex-1 truncate text-left">{displayText}</span>
      </SelectTrigger>
      <SelectContent>
        {/* My Usage (self) */}
        <SelectItem value="self">My Usage</SelectItem>

        {/* All Organization (org-wide) */}
        <SelectItem value="org">All Organization</SelectItem>

        {/* Individual Members */}
        {otherMembers.length > 0 && (
          <>
            <SelectSeparator />
            <SelectGroup>
              {otherMembers.map((member) => (
                <SelectItem key={member.userId} value={`member:${member.userId}`}>
                  {member.name}
                </SelectItem>
              ))}
            </SelectGroup>
          </>
        )}
      </SelectContent>
    </Select>
  );
}

export default UserScopeFilter;
