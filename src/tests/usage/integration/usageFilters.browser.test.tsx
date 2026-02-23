/**
 * Usage Filters Integration Tests
 *
 * Browser tests for the filter components.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@/tests/render';
import userEvent from '@testing-library/user-event';
import { GranularityFilter } from '@/components/Pages/Usage/Filters/GranularityFilter';
import { AssistantFilter } from '@/components/Pages/Usage/Filters/AssistantFilter';
import { UserScopeFilter } from '@/components/Pages/Usage/Filters/UserScopeFilter';
import { UsageFiltersBar } from '@/components/Pages/Usage/Filters/UsageFiltersBar';
import { createMockAssistantList, createMockOrgMemberList } from '@/tests/usage/mocks/data';

// Create mock org members for tests
const mockOrgMembers = createMockOrgMemberList(3).map((m) => ({
  userId: m.userId,
  name: m.name || 'Unknown',
  email: m.email,
}));
const mockCurrentUserId = 'user_current';

describe('Usage Filters', () => {
  describe('GranularityFilter', () => {
    it('renders with current value', async () => {
      const onChange = vi.fn();

      render(<GranularityFilter value="time_day" onChange={onChange} disabled={false} />);

      const trigger = screen.getByTestId('granularity-filter');
      expect(trigger).toBeInTheDocument();
      expect(trigger).toHaveTextContent('Day');
    });

    it('calls onChange when selection changes', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<GranularityFilter value="time_day" onChange={onChange} disabled={false} />);

      // Open dropdown
      await user.click(screen.getByTestId('granularity-filter'));

      // Select hour option
      await user.click(screen.getByText('Hour'));

      expect(onChange).toHaveBeenCalledWith('time_hour');
    });

    it('is disabled when disabled prop is true', async () => {
      const onChange = vi.fn();

      render(<GranularityFilter value="time_day" onChange={onChange} disabled />);

      const trigger = screen.getByTestId('granularity-filter');
      expect(trigger).toBeDisabled();
    });

    it('displays all granularity options', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<GranularityFilter value="time_day" onChange={onChange} disabled={false} />);

      // Open dropdown
      await user.click(screen.getByTestId('granularity-filter'));

      // Verify all options are present (use getAllByText since "Day" appears both in trigger and list)
      expect(screen.getByText('Minute')).toBeInTheDocument();
      expect(screen.getByText('Hour')).toBeInTheDocument();
      expect(screen.getAllByText('Day').length).toBeGreaterThanOrEqual(1);
      expect(screen.getByText('Month')).toBeInTheDocument();
      expect(screen.getByText('Year')).toBeInTheDocument();
    });
  });

  describe('AssistantFilter', () => {
    it('renders with all assistants option', async () => {
      const onChange = vi.fn();
      const assistants = createMockAssistantList(2);

      render(
        <AssistantFilter assistants={assistants} value="all" onChange={onChange} disabled={false} />
      );

      // The trigger should display "All Assistants" text
      const trigger = screen.getByTestId('assistant-filter');
      expect(trigger).toHaveTextContent('All Assistants');
    });

    it('displays assistant names in dropdown', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const assistants = createMockAssistantList(2);

      render(
        <AssistantFilter assistants={assistants} value="all" onChange={onChange} disabled={false} />
      );

      // Open dropdown
      await user.click(screen.getByTestId('assistant-filter'));

      expect(screen.getByText('Assistant1 Bot')).toBeInTheDocument();
      expect(screen.getByText('Assistant2 Bot')).toBeInTheDocument();
    });

    it('calls onChange when assistant is selected', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const assistants = createMockAssistantList(2);

      render(
        <AssistantFilter assistants={assistants} value="all" onChange={onChange} disabled={false} />
      );

      // Open dropdown
      await user.click(screen.getByTestId('assistant-filter'));

      // Select first assistant
      await user.click(screen.getByText('Assistant1 Bot'));

      expect(onChange).toHaveBeenCalledWith('asst_1');
    });

    it('is disabled when no assistants available', async () => {
      const onChange = vi.fn();

      render(<AssistantFilter assistants={[]} value="all" onChange={onChange} disabled={false} />);

      const trigger = screen.getByTestId('assistant-filter');
      expect(trigger).toBeDisabled();
    });

    it('displays selected assistant name in trigger', async () => {
      const onChange = vi.fn();
      const assistants = createMockAssistantList(2);

      render(
        <AssistantFilter
          assistants={assistants}
          value="asst_1"
          onChange={onChange}
          disabled={false}
        />
      );

      const trigger = screen.getByTestId('assistant-filter');
      expect(trigger).toHaveTextContent('Assistant1 Bot');
    });
  });

  describe('UserScopeFilter', () => {
    const defaultProps = {
      value: 'self' as const,
      onChange: vi.fn(),
      selectedMemberId: null,
      onMemberChange: vi.fn(),
      orgMembers: mockOrgMembers,
      currentUserId: mockCurrentUserId,
      disabled: false,
      visible: true,
    };

    it('renders when visible', async () => {
      render(<UserScopeFilter {...defaultProps} />);

      expect(screen.getByTestId('user-scope-filter')).toBeInTheDocument();
    });

    it('does not render when not visible', async () => {
      render(<UserScopeFilter {...defaultProps} visible={false} />);

      expect(screen.queryByTestId('user-scope-filter')).not.toBeInTheDocument();
    });

    it('displays correct labels in trigger', async () => {
      render(<UserScopeFilter {...defaultProps} />);

      const trigger = screen.getByTestId('user-scope-filter');
      expect(trigger).toHaveTextContent('My Usage');
    });

    it('displays scope options in dropdown', async () => {
      const user = userEvent.setup();

      render(<UserScopeFilter {...defaultProps} />);

      // Open dropdown
      await user.click(screen.getByTestId('user-scope-filter'));

      // Check for options: "My Usage" and "All Organization"
      expect(screen.getByRole('option', { name: 'My Usage' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'All Organization' })).toBeInTheDocument();
    });

    it('displays org member names in dropdown', async () => {
      const user = userEvent.setup();

      render(<UserScopeFilter {...defaultProps} />);

      // Open dropdown
      await user.click(screen.getByTestId('user-scope-filter'));

      // Check that org members are shown
      expect(screen.getByRole('option', { name: 'User 1' })).toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'User 2' })).toBeInTheDocument();
    });

    it('calls onChange with org when All Organization is selected', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<UserScopeFilter {...defaultProps} onChange={onChange} />);

      // Open dropdown
      await user.click(screen.getByTestId('user-scope-filter'));

      // Select organization option
      await user.click(screen.getByRole('option', { name: 'All Organization' }));

      expect(onChange).toHaveBeenCalledWith('org');
    });

    it('calls onMemberChange when a specific member is selected', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();
      const onMemberChange = vi.fn();

      render(
        <UserScopeFilter {...defaultProps} onChange={onChange} onMemberChange={onMemberChange} />
      );

      // Open dropdown
      await user.click(screen.getByTestId('user-scope-filter'));

      // Select a specific member
      await user.click(screen.getByRole('option', { name: 'User 1' }));

      expect(onChange).toHaveBeenCalledWith('member');
      expect(onMemberChange).toHaveBeenCalledWith('user_1');
    });
  });

  describe('UsageFiltersBar', () => {
    const defaultProps = {
      userScope: 'self' as const,
      onUserScopeChange: vi.fn(),
      selectedMemberId: null,
      onMemberChange: vi.fn(),
      orgMembers: mockOrgMembers,
      currentUserId: mockCurrentUserId,
      assistantId: 'all',
      onAssistantChange: vi.fn(),
      assistants: createMockAssistantList(2),
      startDate: '2026-01-01',
      endDate: '2026-01-31',
      onDateRangeChange: vi.fn(),
      granularity: 'time_day' as const,
      onGranularityChange: vi.fn(),
      onReset: vi.fn(),
      onRefresh: vi.fn(),
      canViewOrg: false,
      disabled: false,
    };

    it('renders all filter components', async () => {
      render(<UsageFiltersBar {...defaultProps} />);

      expect(screen.getByTestId('usage-filters-bar')).toBeInTheDocument();
      expect(screen.getByTestId('assistant-filter')).toBeInTheDocument();
      expect(screen.getByTestId('granularity-filter')).toBeInTheDocument();
      expect(screen.getByTestId('timeframe-filter')).toBeInTheDocument();
      expect(screen.getByTestId('refresh-button')).toBeInTheDocument();
    });

    it('hides user scope filter when user cannot view org', async () => {
      render(<UsageFiltersBar {...defaultProps} canViewOrg={false} />);

      expect(screen.queryByTestId('user-scope-filter')).not.toBeInTheDocument();
    });

    it('shows user scope filter when user can view org', async () => {
      render(<UsageFiltersBar {...defaultProps} canViewOrg={true} />);

      expect(screen.getByTestId('user-scope-filter')).toBeInTheDocument();
    });

    it('calls onRefresh when refresh button is clicked', async () => {
      const user = userEvent.setup();
      const onRefresh = vi.fn();

      render(<UsageFiltersBar {...defaultProps} onRefresh={onRefresh} />);

      await user.click(screen.getByTestId('refresh-button'));

      expect(onRefresh).toHaveBeenCalled();
    });

    it('disables all filters when disabled prop is true', async () => {
      render(<UsageFiltersBar {...defaultProps} disabled={true} />);

      expect(screen.getByTestId('assistant-filter')).toBeDisabled();
      expect(screen.getByTestId('granularity-filter')).toBeDisabled();
      expect(screen.getByTestId('refresh-button')).toBeDisabled();
    });
  });
});
