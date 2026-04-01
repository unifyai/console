'use client';

import { useState, useEffect, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { Switch } from '@/components/UI/switch';
import { Label } from '@/components/UI/label';
import { toast } from 'sonner';
import type { OrgMFASettings } from '@/lib/orchestra/api/organization';
import type { ResponseProps } from '@/types/common';

export interface MfaSettingsActions {
  getMfaSettings: (orgId: number) => Promise<OrgMFASettings | ResponseProps>;
  updateMfaSettings: (
    orgId: number,
    requireMfa: boolean
  ) => Promise<OrgMFASettings | ResponseProps>;
}

interface SecuritySettingsPanelProps {
  organizationId: number;
  canEdit: boolean;
  actions: MfaSettingsActions;
}

function isMfaSettings(data: OrgMFASettings | ResponseProps): data is OrgMFASettings {
  return 'requireMfa' in data && !('detail' in data);
}

const SecuritySettingsPanel = ({
  organizationId,
  canEdit,
  actions,
}: SecuritySettingsPanelProps) => {
  const [requireMfa, setRequireMfa] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await actions.getMfaSettings(organizationId);
      if (isMfaSettings(result)) {
        setRequireMfa(result.requireMfa);
      }
    } catch {
      console.error('Failed to fetch MFA settings');
    } finally {
      setIsLoading(false);
    }
  }, [actions, organizationId]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleToggle = async (checked: boolean) => {
    setIsSaving(true);
    try {
      const result = await actions.updateMfaSettings(organizationId, checked);
      if (isMfaSettings(result)) {
        setRequireMfa(result.requireMfa);
        toast.success(
          checked
            ? 'MFA enforcement enabled — all members will be required to set up 2FA'
            : 'MFA enforcement disabled'
        );
      } else {
        toast.error((result as ResponseProps).detail || 'Failed to update MFA settings');
      }
    } catch {
      toast.error('Failed to update MFA settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 p-4 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        <span className="text-sm">Loading security settings...</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4" data-testid="security-settings-panel">
      <div className="rounded-lg border bg-card p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col gap-1">
            <Label htmlFor="require-mfa" className="text-body font-medium">
              Require two-factor authentication
            </Label>
            <p className="text-caption text-muted-foreground">
              When enabled, all members must set up 2FA to access this organization. Members without
              2FA will be prompted to set it up before they can use the workspace.
            </p>
          </div>
          <Switch
            id="require-mfa"
            checked={requireMfa}
            onCheckedChange={handleToggle}
            disabled={!canEdit || isSaving}
            data-testid="require-mfa-toggle"
          />
        </div>
      </div>
    </div>
  );
};

export default SecuritySettingsPanel;
