"use client"

import React, { useState, useCallback, useMemo } from 'react'
import { Button } from '@/components/UI/button'
import { Label } from '@/components/UI/label'
import { Select, SelectContent, SelectGroup, SelectItem, SelectLabel, SelectTrigger, SelectValue } from '@/components/UI/select'
import { ScrollArea } from '@/components/UI/scroll-area'
import BaseDialog from '@/components/Common/Dialogs/Base'
import { Trash2, UserPlus, Users, User, Loader2, Copy, Check } from 'lucide-react'
import { Input } from '@/components/UI/input'
import { 
    ResourceAccessResponse, 
    ResourceAccessGrant,
} from '@/types/resource'
import { ResourcesActions } from '@/types/resource'
import { Role } from '@/types/role'
import { Team } from '@/types/team'
import { OrganizationMember } from '@/types/organization'
import { showSuccessToast, showErrorToast } from '@/components/Common/Toasts/notifications'

interface GranteeOption {
    value: string  // Format: "user:userId" or "team:teamId"
    label: string
    sublabel?: string  // Email for members
    type: 'user' | 'team'
    id: string
}

interface ShareProjectDialogProps {
    open: boolean
    onOpenChange: (open: boolean) => void
    projectId: number
    projectName: string
    resourcesActions: ResourcesActions
    accessEntries: ResourceAccessResponse[]
    availableRoles: Role[]
    availableTeams: Team[]
    availableMembers: OrganizationMember[]
    onAccessUpdated: () => void
}

export const ShareProjectDialog = React.memo(function ShareProjectDialog({
    open,
    onOpenChange,
    projectId,
    projectName,
    resourcesActions,
    accessEntries,
    availableRoles,
    availableTeams,
    availableMembers,
    onAccessUpdated,
}: ShareProjectDialogProps) {
    const [selectedGrantee, setSelectedGrantee] = useState<string>('')
    const [selectedRoleId, setSelectedRoleId] = useState<string>('')
    const [isGranting, setIsGranting] = useState(false)
    const [isRevoking, setIsRevoking] = useState<number | null>(null)
    const [isUpdating, setIsUpdating] = useState<number | null>(null)
    const [error, setError] = useState('')
    const [copied, setCopied] = useState(false)

    // Generate project link
    const projectLink = useMemo(() => {
        if (typeof window === 'undefined') return ''
        const baseUrl = window.location.origin
        return `${baseUrl}/interfaces?project=${encodeURIComponent(projectName)}`
    }, [projectName])

    const handleCopyLink = useCallback(async () => {
        try {
            await navigator.clipboard.writeText(projectLink)
            setCopied(true)
            showSuccessToast('Link copied', 'Project link copied to clipboard')
            setTimeout(() => setCopied(false), 2000)
        } catch {
            showErrorToast('Failed to copy', 'Could not copy link to clipboard')
        }
    }, [projectLink])

    // Filter roles that can be assigned (exclude Owner typically)
    const assignableRoles = useMemo(() => {
        return availableRoles.filter(role => role.name !== 'Owner')
    }, [availableRoles])

    // Build set of grantee IDs that already have access
    const existingGranteeIds = useMemo(() => {
        const ids = new Set<string>()
        accessEntries.forEach(entry => {
            ids.add(`${entry.grantee_type}:${entry.grantee_id}`)
        })
        return ids
    }, [accessEntries])

    // Build grantee options from teams and members, excluding those with existing access
    const granteeOptions = useMemo((): { teams: GranteeOption[], members: GranteeOption[] } => {
        const teams: GranteeOption[] = availableTeams
            .filter(team => !existingGranteeIds.has(`team:${team.id}`))
            .map(team => ({
                value: `team:${team.id}`,
                label: team.name,
                type: 'team' as const,
                id: team.id.toString(),
            }))

        const members: GranteeOption[] = availableMembers
            .filter(member => !existingGranteeIds.has(`user:${member.user_id}`))
            .map(member => ({
                value: `user:${member.user_id}`,
                label: member.name || member.email || member.user_id,
                sublabel: member.name && member.email ? member.email : undefined,
                type: 'user' as const,
                id: member.user_id,
            }))

        return { teams, members }
    }, [availableTeams, availableMembers, existingGranteeIds])

    // Get the currently selected grantee option
    const selectedGranteeOption = useMemo(() => {
        if (!selectedGrantee) return null
        return [...granteeOptions.teams, ...granteeOptions.members].find(
            opt => opt.value === selectedGrantee
        )
    }, [selectedGrantee, granteeOptions])

    const handleGrant = useCallback(async () => {
        if (!selectedGranteeOption || !selectedRoleId) {
            setError('Please select a user or team and a role')
            return
        }

        setIsGranting(true)
        setError('')

        try {
            const grantData: ResourceAccessGrant = {
                role_id: parseInt(selectedRoleId, 10),
                grantee_type: selectedGranteeOption.type,
                grantee_id: selectedGranteeOption.id,
            }
            
            const result = await resourcesActions.grantAccess('project', projectId, grantData)

            if ('status' in result && result.status !== 201) {
                throw new Error((result as any).detail || 'Failed to grant access')
            }

            showSuccessToast('Access granted', `${selectedGranteeOption.type === 'user' ? 'User' : 'Team'} now has access to this project`)
            setSelectedGrantee('')
            setSelectedRoleId('')
            onAccessUpdated()
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to grant access'
            setError(errorMsg)
            showErrorToast('Failed to grant access', errorMsg)
        } finally {
            setIsGranting(false)
        }
    }, [resourcesActions, projectId, selectedGranteeOption, selectedRoleId, onAccessUpdated])

    const handleRevoke = useCallback(async (entry: ResourceAccessResponse) => {
        setIsRevoking(entry.id)
        
        try {
            const result = await resourcesActions.revokeAccess('project', projectId, {
                grantee_type: entry.grantee_type as 'user' | 'team',
                grantee_id: entry.grantee_id,
                role_id: entry.role_id,
            })
            
            if (result && 'status' in result && result.status !== 204) {
                throw new Error((result as any).detail || 'Failed to revoke access')
            }

            showSuccessToast('Access revoked', `Access for ${entry.grantee_name || entry.grantee_id} has been removed`)
            onAccessUpdated()
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to revoke access'
            showErrorToast('Failed to revoke access', errorMsg)
        } finally {
            setIsRevoking(null)
        }
    }, [resourcesActions, projectId, onAccessUpdated])

    const handleUpdateRole = useCallback(async (entry: ResourceAccessResponse, newRoleId: number) => {
        setIsUpdating(entry.id)
        
        try {
            const result = await resourcesActions.updateAccess('project', projectId, entry.id, {
                role_id: newRoleId,
            })
            
            if ('status' in result && result.status !== 200) {
                throw new Error((result as any).detail || 'Failed to update role')
            }

            showSuccessToast('Role updated', `Role for ${entry.grantee_name || entry.grantee_id} has been updated`)
            onAccessUpdated()
        } catch (err) {
            const errorMsg = err instanceof Error ? err.message : 'Failed to update role'
            showErrorToast('Failed to update role', errorMsg)
        } finally {
            setIsUpdating(null)
        }
    }, [resourcesActions, projectId, onAccessUpdated])

    const handleOpenChange = useCallback((newOpen: boolean) => {
        if (!newOpen) {
            setSelectedGrantee('')
            setSelectedRoleId('')
            setError('')
        }
        onOpenChange(newOpen)
    }, [onOpenChange])

    return (
        <BaseDialog
            button={<></>}
            open={open}
            setOpen={handleOpenChange}
            title={`Share project`}
            body={
                <div className="space-y-6 pt-4">
                    {/* Grant Access Section */}
                    <div className="space-y-4">
                        <Label className="text-label font-medium">Grant Access</Label>
                        <div className="flex gap-2">
                            <Select
                                value={selectedGrantee}
                                onValueChange={setSelectedGrantee}
                            >
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Select member or team..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {granteeOptions.teams.length > 0 && (
                                        <SelectGroup>
                                            <SelectLabel className="flex items-center gap-2">
                                                <Users className="h-3 w-3" />
                                                Teams
                                            </SelectLabel>
                                            {granteeOptions.teams.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    <div className="flex items-center gap-2">
                                                        <Users className="h-4 w-4" />
                                                        {option.label}
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    )}
                                    {granteeOptions.members.length > 0 && (
                                        <SelectGroup>
                                            <SelectLabel className="flex items-center gap-2">
                                                <User className="h-3 w-3" />
                                                Members
                                            </SelectLabel>
                                            {granteeOptions.members.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    <div className="flex items-center gap-2">
                                                        <User className="h-4 w-4" />
                                                        <div className="flex flex-row gap-2 justify-between items-center">
                                                            <span>{option.label}</span>
                                                            {option.sublabel && (
                                                                <span className="text-xs"> - {option.sublabel}</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </SelectItem>
                                            ))}
                                        </SelectGroup>
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="flex gap-2">
                            <Select 
                                value={selectedRoleId} 
                                onValueChange={setSelectedRoleId}
                            >
                                <SelectTrigger className="flex-1">
                                    <SelectValue placeholder="Select role..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {assignableRoles.map((role) => (
                                        <SelectItem key={role.id} value={role.id.toString()}>
                                            {role.name}
                                            {role.description && (
                                                <span className="ml-2 text-xs">
                                                    - {role.description}
                                                </span>
                                            )}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <Button
                                onClick={handleGrant}
                                disabled={isGranting || !selectedGrantee || !selectedRoleId}
                                className="gap-2"
                            >
                                {isGranting ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />}
                                Add
                            </Button>
                        </div>
                        {error && (
                            <p className="text-caption text-destructive">{error}</p>
                        )}
                    </div>

                    {/* Current Access Section */}
                    <div className="space-y-3">
                        <Label className="text-label font-medium">Current Access</Label>
                        {accessEntries.length === 0 ? (
                            <p className="text-caption text-muted-foreground">
                                No users or teams have access to this project yet.
                            </p>
                        ) : (
                            <ScrollArea className="h-48">
                                <div className="space-y-2">
                                    {accessEntries.map((entry) => (
                                        <div
                                            key={entry.id}
                                            className="flex items-center justify-between p-3 rounded-md bg-muted/50"
                                        >
                                            <div className="flex items-center gap-3">
                                                {entry.grantee_type === 'user' ? (
                                                    <User className="h-4 w-4 text-muted-foreground" />
                                                ) : (
                                                    <Users className="h-4 w-4 text-muted-foreground" />
                                                )}
                                                <div>
                                                    <p className="text-body-sm font-medium">
                                                        {entry.grantee_name || entry.grantee_id}
                                                    </p>
                                                    <p className="text-caption text-muted-foreground">
                                                        {entry.grantee_type === 'user' ? 'User' : 'Team'}
                                                    </p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                {entry.role_name === 'Owner' ? (
                                                    <span className="w-28 h-8 flex items-center justify-center text-body-sm font-medium">
                                                        Owner
                                                    </span>
                                                ) : (
                                                    <Select
                                                        value={entry.role_id.toString()}
                                                        onValueChange={(v) => handleUpdateRole(entry, parseInt(v, 10))}
                                                        disabled={isUpdating === entry.id}
                                                    >
                                                        <SelectTrigger className="w-28 h-8">
                                                            <SelectValue />
                                                        </SelectTrigger>
                                                        <SelectContent>
                                                            {assignableRoles.map((role) => (
                                                                <SelectItem key={role.id} value={role.id.toString()}>
                                                                    {role.name}
                                                                </SelectItem>
                                                            ))}
                                                        </SelectContent>
                                                    </Select>
                                                )}
                                                {entry.role_name !== 'Owner' && (
                                                    <Button
                                                        variant="ghost"
                                                        size="icon"
                                                        onClick={() => handleRevoke(entry)}
                                                        disabled={isRevoking === entry.id || entry.role_name === 'Owner'}
                                                        className="h-8 w-8 text-destructive hover:text-destructive"
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </Button>)
                                                }
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </ScrollArea>
                        )}
                    </div>

                    {/* Copy Link Section */}
                    <div className="space-y-2">
                        <Label className="text-label font-medium">Project Link</Label>
                        <div className="flex gap-2">
                            <Input
                                value={projectLink}
                                readOnly
                                className="flex-1 text-muted-foreground"
                            />
                            <Button
                                variant="outline"
                                size="icon"
                                onClick={handleCopyLink}
                                className="shrink-0"
                            >
                                {copied ? (
                                    <Check className="h-4 w-4 text-green-500" />
                                ) : (
                                    <Copy className="h-4 w-4" />
                                )}
                            </Button>
                        </div>
                    </div>
                </div>
            }
            footer={
                <Button variant="outline" onClick={() => handleOpenChange(false)}>
                    Done
                </Button>
            }
        />
    )
})
