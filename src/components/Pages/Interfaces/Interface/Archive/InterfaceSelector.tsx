'use client';

import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import {
  Loader2,
  Search,
  Upload,
  X,
  AlertCircle,
  FileUp,
  Check,
  CheckCircle,
  Plus,
  Trash2,
} from 'lucide-react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button } from '@/components/UI/button';
import { Input } from '@/components/UI/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/UI/card';
import { Skeleton } from '@/components/UI/skeleton';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/UI/dialog';
import { Label } from '@/components/UI/label';
import { Checkbox } from '@/components/UI/checkbox';
import { Alert, AlertDescription } from '@/components/UI/alert';
import ListTable from '@/components/Common/Tables/List/Base';
import {
  GranularInterfaceActions,
  GranularTabActions,
  GranularTileActions,
  InterfaceData,
  InterfaceTemplateSchema,
  TemplateExportResponse,
  TemplateImportResponse,
  ProjectsActions,
} from '@/types/interfaces/grid';
import { StateProps, SetStateProps } from '@/types/listTable';
import { useQueryClient } from '@tanstack/react-query';
import {
  ExtendedInterfaceData,
  transformInterfacesData,
  filterInterfaces,
  createInterfaceUrl,
  createCompleteDefaultInterface,
  ensureInterfaceLoadable,
} from '@/utils/interfaces/interfaceSelector';
import { showErrorToast, showLoadingToast } from '@/components/Common/Toasts/notifications';
import { toast } from 'sonner';
import { SkeletonTable, createInterfaceSelectorColumns } from './InterfaceSelectorTable';
import { useListInterfacesQuery } from '@/hooks/Interfaces/Query/useInterfacesQuery';

const EMPTY_INTERFACE_DATA: InterfaceData[] = [];

interface InterfaceSelectorProps {
  projectId: string;
  interfaceActions: GranularInterfaceActions;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
  projectActions: ProjectsActions;
}

export default function InterfaceSelector({
  projectId,
  interfaceActions,
  tabActions,
  tileActions,
  projectActions,
}: InterfaceSelectorProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const queryClient = useQueryClient();

  // Local state for table functionality
  const [searchQuery, setSearchQuery] = useState('');
  const [isNavigating, setIsNavigating] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isRefetchingAfterImport, setIsRefetchingAfterImport] = useState(false);

  // Custom create dialog state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [createInterfaceName, setCreateInterfaceName] = useState('');
  const [createNameError, setCreateNameError] = useState('');
  const [createResult, setCreateResult] = useState<string | null>(null);

  // Custom delete dialog state
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteInterfaceId, setDeleteInterfaceId] = useState('');
  const [deleteInterfaceName, setDeleteInterfaceName] = useState('');
  const [deleteResult, setDeleteResult] = useState<string | null>(null);
  const [showDeleteSuccess, setShowDeleteSuccess] = useState(false);

  // Custom delete project dialog state
  const [showDeleteProjectDialog, setShowDeleteProjectDialog] = useState(false);
  const [isDeletingProject, setIsDeletingProject] = useState(false);
  const [deleteProjectResult, setDeleteProjectResult] = useState<string | null>(null);
  const [showDeleteProjectSuccess, setShowDeleteProjectSuccess] = useState(false);

  // Import dialog state (existing)
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [importInterfaceName, setImportInterfaceName] = useState('');
  const [useTemplateName, setUseTemplateName] = useState(false);
  const [templateData, setTemplateData] =
    useState<TemplateExportResponse<InterfaceTemplateSchema> | null>(null);
  const [nameError, setNameError] = useState('');
  const [fileError, setFileError] = useState('');
  const [importResult, setImportResult] = useState<TemplateImportResponse | null>(null);
  const [showImportSuccess, setShowImportSuccess] = useState(false);
  const [tableState, setTableState] = useState<StateProps>({
    sorting: [{ id: 'updatedAt', desc: true }],
  });

  // State for auto-creating the default interface
  const [isCreatingDefault, setIsCreatingDefault] = useState(false);

  // Fetch interfaces for the project
  const {
    data: interfaces = EMPTY_INTERFACE_DATA,
    isLoading,
    error,
    isFetching,
    refetch,
  } = useListInterfacesQuery(projectId, interfaceActions);

  // Auto-create "Default" interface if none exist
  useEffect(() => {
    if (
      !isLoading &&
      !isFetching &&
      Array.isArray(interfaces) &&
      interfaces.length === 0 &&
      projectId &&
      !isCreatingDefault
    ) {
      const createDefault = async () => {
        setIsCreatingDefault(true);
        try {
          const newInterface = await createCompleteDefaultInterface({
            queryClient,
            project: projectId,
            interfaceActions,
            tabActions,
            tileActions,
            baseName: 'Default',
          });

          if (newInterface && newInterface.name) {
            const newUrl = createInterfaceUrl(searchParams, newInterface.name);
            router.push(newUrl);
          } else {
            throw new Error('Failed to create the default interface.');
          }
        } catch (err) {
          console.error('Failed to auto-create default interface:', err);
          setIsCreatingDefault(false); // Allow manual creation if auto-creation fails
        }
      };
      createDefault();
    }
  }, [
    isLoading,
    isFetching,
    interfaces,
    projectId,
    isCreatingDefault,
    queryClient,
    interfaceActions,
    tabActions,
    tileActions,
    searchParams,
    router,
  ]);

  // Transform interfaces data with additional fields using utility function
  const extendedInterfaces: ExtendedInterfaceData[] = useMemo(() => {
    return transformInterfacesData(interfaces);
  }, [interfaces]);

  // Filter interfaces based on search query using utility function
  const filteredInterfaces = useMemo(() => {
    return filterInterfaces(extendedInterfaces, searchQuery);
  }, [extendedInterfaces, searchQuery]);

  // Handle interface selection with router navigation
  const handleInterfaceSelect = useCallback(
    async (interfaceName: string) => {
      setIsNavigating(true);

      try {
        // Preflight the interface to avoid navigating into a broken state
        const ac = new AbortController();
        await ensureInterfaceLoadable(projectId, interfaceName, ac.signal);
        const newUrl = createInterfaceUrl(searchParams, interfaceName);
        router.push(newUrl);
      } catch (error) {
        console.error('Failed to navigate to interface:', error);
        setIsNavigating(false);
        showErrorToast('Failed to load interface');
      }
    },
    [router, searchParams, projectId]
  );

  // Show/dismiss a loading toast while navigating (replaces frosted overlay)
  const navToastIdRef = useRef<string | number | null>(null);
  useEffect(() => {
    if (isNavigating && navToastIdRef.current == null) {
      navToastIdRef.current = showLoadingToast('Loading interface...');
    } else if (!isNavigating && navToastIdRef.current != null) {
      toast.dismiss(navToastIdRef.current);
      navToastIdRef.current = null;
    }
  }, [isNavigating]);

  // Validate interface name doesn't already exist
  const validateCreateInterfaceName = useCallback(
    (name: string) => {
      if (!name.trim()) {
        setCreateNameError('Interface name is required.');
        return false;
      }

      if (name.length > 50) {
        setCreateNameError('Interface name must be less than 50 characters.');
        return false;
      }

      if (!/^[a-zA-Z0-9_-]+$/.test(name)) {
        setCreateNameError(
          'Interface name can only contain letters, numbers, hyphens, and underscores.'
        );
        return false;
      }

      const existingNames = extendedInterfaces.map((iface) => iface.name.toLowerCase());
      if (existingNames.includes(name.toLowerCase())) {
        setCreateNameError('An interface with this name already exists.');
        return false;
      }

      setCreateNameError('');
      return true;
    },
    [extendedInterfaces]
  );

  // Handle create interface name change with real-time validation
  const handleCreateInterfaceNameChange = useCallback(
    (value: string) => {
      setCreateInterfaceName(value);
      validateCreateInterfaceName(value);
    },
    [validateCreateInterfaceName]
  );

  // Handle create interface action
  const handleCreateInterface = useCallback(() => {
    setShowCreateDialog(true);
    setCreateInterfaceName('');
    setCreateNameError('');
    setCreateResult(null);
  }, []);

  // Execute create interface
  const executeCreateInterface = useCallback(async () => {
    if (!validateCreateInterfaceName(createInterfaceName)) {
      return;
    }

    setIsCreating(true);
    try {
      const newInterface = await createCompleteDefaultInterface({
        queryClient,
        project: projectId,
        interfaceActions,
        tabActions,
        tileActions,
        baseName: createInterfaceName.trim(),
      });

      if (newInterface && newInterface.name) {
        // Close dialog immediately and show navigation loader
        setShowCreateDialog(false);
        setIsNavigating(true);

        // Navigate to the newly created interface
        const newUrl = createInterfaceUrl(searchParams, newInterface.name);
        router.push(newUrl);
      } else {
        throw new Error('Failed to create interface');
      }
    } catch (error) {
      console.error('Failed to create interface:', error);
      setCreateResult('Failed to create interface. Please try again.');
    } finally {
      setIsCreating(false);
    }
  }, [
    createInterfaceName,
    validateCreateInterfaceName,
    projectId,
    interfaceActions,
    tabActions,
    tileActions,
    searchParams,
    router,
    queryClient,
  ]);

  // Execute delete interface
  const executeDeleteInterface = useCallback(async () => {
    setIsDeleting(true);
    try {
      console.log('[InterfaceSelector] Deleting interface:', deleteInterfaceId);
      await interfaceActions.delete({ interfaceId: deleteInterfaceId });
      setDeleteResult('Interface deleted successfully!');
      setShowDeleteSuccess(true);

      // Refetch interfaces and close dialog
      setTimeout(async () => {
        setShowDeleteDialog(false);
        await refetch();

        // Reset delete state
        setTimeout(() => {
          setDeleteInterfaceId('');
          setDeleteInterfaceName('');
          setDeleteResult(null);
          setShowDeleteSuccess(false);
        }, 1000);
      }, 1500);
    } catch (error) {
      console.error('Failed to delete interface:', error);
      setDeleteResult('Failed to delete interface. Please try again.');
    } finally {
      setIsDeleting(false);
    }
  }, [deleteInterfaceId, interfaceActions, refetch]);

  // Handle keyboard events for dialogs
  const handleCreateKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isCreating && validateCreateInterfaceName(createInterfaceName)) {
        executeCreateInterface();
      }
    },
    [isCreating, createInterfaceName, validateCreateInterfaceName, executeCreateInterface]
  );

  const handleDeleteKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isDeleting) {
        executeDeleteInterface();
      }
    },
    [isDeleting, executeDeleteInterface]
  );

  // Execute delete project
  const executeDeleteProject = useCallback(async () => {
    setIsDeletingProject(true);
    try {
      console.log('[InterfaceSelector] Deleting project:', projectId);
      await projectActions.delete(projectId);
      setDeleteProjectResult('Project deleted successfully!');
      setShowDeleteProjectSuccess(true);

      // Navigate back to default project selection after deletion
      setTimeout(() => {
        setShowDeleteProjectDialog(false);
        // Navigate to home or project selection page
        router.push('/interfaces');
      }, 2000);
    } catch (error) {
      console.error('Failed to delete project:', error);
      setDeleteProjectResult('Failed to delete project. Please try again.');
    } finally {
      setIsDeletingProject(false);
    }
  }, [projectId, projectActions, router]);

  // Handle delete project keyboard events
  const handleDeleteProjectKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !isDeletingProject) {
        executeDeleteProject();
      }
    },
    [isDeletingProject, executeDeleteProject]
  );

  // Handle delete project action
  const handleDeleteProject = useCallback(() => {
    setShowDeleteProjectDialog(true);
    setDeleteProjectResult(null);
    setShowDeleteProjectSuccess(false);
  }, []);

  // Handle export as template
  const handleExportTemplate = useCallback(
    async (interfaceId: string, interfaceName: string) => {
      setIsExporting(true);
      try {
        const result = await interfaceActions.exportTemplate(
          { interfaceId: interfaceId, projectName: projectId, interfaceName: interfaceName },
          { includeMetadata: true, templateName: interfaceName }
        );

        if ('error' in result) {
          console.error('Failed to export interface template:', result.error);
          // TODO: Show error toast/notification
          return;
        }

        // TODO: Download the template or show success message
        console.log('Interface template exported successfully:', result);

        // Create a downloadable file
        const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${interfaceName}-template.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      } catch (error) {
        console.error('Failed to export interface template:', error);
        // TODO: Show error toast/notification
      } finally {
        setIsExporting(false);
      }
    },
    [interfaceActions, projectId]
  );

  // Handle import template action
  const handleImportTemplate = useCallback(() => {
    setShowImportDialog(true);
    setSelectedFile(null);
    setImportInterfaceName('');
    setUseTemplateName(false);
    setTemplateData(null);
    setNameError('');
    setFileError('');
    setImportResult(null);
    setShowImportSuccess(false);
  }, []);

  // Handle file selection
  const handleFileSelect = useCallback(
    (file: File) => {
      setFileError('');

      if (file.type !== 'application/json') {
        setFileError('Please select a valid JSON template file.');
        return;
      }

      setSelectedFile(file);

      // Read and parse the file
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const content = e.target?.result as string;
          const parsed = JSON.parse(content);

          // Validate that this is a proper template structure
          if (!parsed.template) {
            setFileError(
              "Invalid template file format. Expected a template with 'template' property."
            );
            setSelectedFile(null);
            setTemplateData(null);
            return;
          }

          // Validate that it's an interface template
          if (!parsed.template.name) {
            setFileError("Invalid interface template. Template must have a 'name' property.");
            setSelectedFile(null);
            setTemplateData(null);
            return;
          }

          setTemplateData(parsed as TemplateExportResponse<InterfaceTemplateSchema>);

          // Auto-populate name if checkbox is checked
          if (useTemplateName && parsed.template.name) {
            setImportInterfaceName(parsed.template.name);
          }
        } catch (error) {
          setFileError('Invalid JSON template file.');
          setSelectedFile(null);
          setTemplateData(null);
        }
      };
      reader.readAsText(file);
    },
    [useTemplateName]
  );

  // Handle drag events
  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true);
    } else if (e.type === 'dragleave') {
      setDragActive(false);
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setDragActive(false);

      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        handleFileSelect(e.dataTransfer.files[0]);
      }
    },
    [handleFileSelect]
  );

  // Validate interface name
  const validateImportInterfaceName = useCallback(
    (name: string) => {
      if (!name.trim()) {
        setNameError('Interface name is required.');
        return false;
      }

      const existingNames = extendedInterfaces.map((iface) => iface.name.toLowerCase());
      if (existingNames.includes(name.toLowerCase())) {
        setNameError('An interface with this name already exists.');
        return false;
      }

      setNameError('');
      return true;
    },
    [extendedInterfaces]
  );

  // Handle interface name change
  const handleInterfaceNameChange = useCallback(
    (value: string) => {
      setImportInterfaceName(value);
      validateImportInterfaceName(value);
    },
    [validateImportInterfaceName]
  );

  // Handle use template name toggle
  const handleUseTemplateNameChange = useCallback(
    (checked: boolean) => {
      setUseTemplateName(checked);
      if (checked && templateData?.template?.name) {
        const templateName = templateData.template.name;
        setImportInterfaceName(templateName);
        validateImportInterfaceName(templateName);
      }
    },
    [templateData, validateImportInterfaceName]
  );

  // Execute import
  const executeImport = useCallback(async () => {
    if (!selectedFile || !templateData || !validateImportInterfaceName(importInterfaceName)) {
      return;
    }

    setIsImporting(true);
    try {
      // Pass the template data directly as expected by the API
      const result = await interfaceActions.importTemplate(templateData.template, {
        projectName: projectId,
        newInterfaceName: importInterfaceName.trim(),
        validateFirst: true,
        autoSanitize: true,
      });

      if ('error' in result) {
        setFileError(result.error || 'Failed to import template. Please try again.');
      } else {
        // Success - show stats and then refresh data
        setImportResult(result as TemplateImportResponse);
        setShowImportSuccess(true);

        // Start refetching after showing success
        setIsRefetchingAfterImport(true);

        // Close dialog after a short delay to show success message
        setTimeout(async () => {
          setShowImportDialog(false);
          await refetch(); // This will refresh the interface list
          setIsRefetchingAfterImport(false);

          // Reset success state after another short delay
          setTimeout(() => {
            setShowImportSuccess(false);
            setImportResult(null);
          }, 1000);
        }, 2000);
      }
    } catch (error) {
      setFileError('Failed to import template. Please try again.');
    } finally {
      setIsImporting(false);
    }
  }, [
    selectedFile,
    templateData,
    importInterfaceName,
    validateImportInterfaceName,
    interfaceActions,
    projectId,
    refetch,
  ]);

  // Create table columns using utility function - now with custom delete handling
  const columns = useMemo(
    () =>
      createInterfaceSelectorColumns({
        onInterfaceSelect: handleInterfaceSelect,
        onDeleteInterface: (interfaceId: string, interfaceName: string) => {
          setDeleteInterfaceId(interfaceId);
          setDeleteInterfaceName(interfaceName);
          setShowDeleteDialog(true);
        },
        onExportTemplate: handleExportTemplate,
      }),
    [handleInterfaceSelect, handleExportTemplate]
  );

  // Table state setters
  const setStateProps: SetStateProps = {
    setSorting: (sorting) => setTableState((prev) => ({ ...prev, sorting })),
  };

  // Show skeleton loading state during initial load or while creating default interface
  if (isLoading || isCreatingDefault) {
    const titleText = isCreatingDefault ? 'Setting Up Your Project' : 'Loading Interfaces';
    const descriptionText = isCreatingDefault
      ? "No interfaces found. We're creating a 'Default' interface for you."
      : `Fetching interfaces for project: ${projectId}`;

    return (
      <div className="relative h-full w-full overflow-auto bg-background">
        <div className="container mx-auto space-y-6 py-6">
          <Card className="shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-title flex items-center justify-between">
                {titleText}
              </CardTitle>
              <CardDescription className="text-body">{descriptionText}</CardDescription>
            </CardHeader>
            <CardContent className="flex min-h-[300px] flex-col items-center justify-center space-y-4 pt-10">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-background">
        <div className="space-y-4 text-center">
          <div className="text-destructive">Error loading interfaces</div>
          <div className="text-sm text-muted-foreground">{error.message}</div>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="relative h-full w-full overflow-auto bg-background">
      {/* Export overlay when exporting template */}
      {isExporting && (
        <div className="bg-background/80 absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <div className="text-body text-muted-foreground">Exporting template...</div>
          </div>
        </div>
      )}

      {/* Import success overlay when refetching after import */}
      {isRefetchingAfterImport && (
        <div className="bg-background/80 absolute inset-0 z-50 flex items-center justify-center backdrop-blur-sm">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin" />
            <div className="text-body text-muted-foreground">Refreshing interface list...</div>
          </div>
        </div>
      )}

      <div className="container mx-auto space-y-6 py-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-title flex items-center justify-between">
              <span>Project Interfaces</span>
              <div className="flex gap-2">
                <Button
                  onClick={handleCreateInterface}
                  variant="outline"
                  className="gap-2"
                  disabled={isFetching || isRefetchingAfterImport}
                >
                  <Plus className="h-4 w-4" />
                  Create new interface
                </Button>
                <Button
                  onClick={handleImportTemplate}
                  variant="outline"
                  className="gap-2"
                  disabled={isFetching || isRefetchingAfterImport}
                >
                  <Upload className="h-4 w-4" />
                  Import from template
                </Button>
                <Button
                  onClick={handleDeleteProject}
                  variant="destructive"
                  className="gap-2"
                  disabled={isFetching || isRefetchingAfterImport}
                >
                  <Trash2 className="h-4 w-4" />
                  Delete project
                </Button>
              </div>
            </CardTitle>
            <CardDescription className="text-body">
              Select an interface to work with for project:{' '}
              <span className="text-strong font-mono">{projectId}</span>
              {(isFetching || isRefetchingAfterImport) && (
                <span className="text-caption ml-2 text-muted-foreground">
                  <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                  {isRefetchingAfterImport ? 'Refreshing after import...' : 'Refreshing...'}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Search Bar */}
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                <Input
                  placeholder="Search by ID, name, or tags..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                  disabled={isFetching || isRefetchingAfterImport}
                />
              </div>
            </div>

            {/* Interface Table */}
            {(isFetching && interfaces.length === 0) || isRefetchingAfterImport ? (
              <SkeletonTable />
            ) : (
              <div className="relative rounded-lg border bg-background">
                {/* Show subtle loading indicator when refetching */}
                {isFetching && interfaces.length > 0 && !isRefetchingAfterImport && (
                  <div className="absolute right-2 top-2 z-10">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                <div className="max-h-[500px] overflow-auto">
                  <ListTable
                    data={filteredInterfaces}
                    columns={columns}
                    state={tableState}
                    setState={setStateProps}
                  />
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Import Template Dialog */}
      <Dialog open={showImportDialog} onOpenChange={setShowImportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Import Interface Template</DialogTitle>
            <DialogDescription>
              Upload a JSON template file to create a new interface.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Import Success Message */}
            {showImportSuccess && importResult && (
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <div className="ml-2">
                  <div className="font-medium text-green-800 dark:text-green-200">
                    Template imported successfully!
                  </div>
                  <div className="mt-1 text-sm text-green-700 dark:text-green-300">
                    Created: {importResult.importStats?.interfaces} interface
                    {importResult.importStats?.interfaces !== 1 ? 's' : ''},{' '}
                    {importResult.importStats?.tabs} tab
                    {importResult.importStats?.tabs !== 1 ? 's' : ''},{' '}
                    {importResult.importStats?.tiles} tile
                    {importResult.importStats?.tiles !== 1 ? 's' : ''}
                  </div>
                </div>
              </Alert>
            )}

            {/* File Upload Area - Hidden during success */}
            {!showImportSuccess && (
              <>
                <div
                  className={`rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
                    dragActive
                      ? 'bg-primary/5 border-primary'
                      : 'border-gray-300 dark:border-gray-600'
                  } ${selectedFile ? 'border-green-500 bg-green-50 dark:bg-green-950' : ''} `}
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                >
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-2 text-green-600 dark:text-green-400">
                      <Check className="h-5 w-5" />
                      <span className="font-medium">{selectedFile.name}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setSelectedFile(null);
                          setTemplateData(null);
                          setFileError('');
                        }}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <FileUp className="mx-auto h-8 w-8 text-gray-400" />
                      <div>
                        <p className="text-body text-strong">
                          Drag and drop your template file here, or{' '}
                          <Button
                            variant="link"
                            className="h-auto p-0 text-primary"
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file';
                              input.accept = '.json,application/json';
                              input.onchange = (e) => {
                                const file = (e.target as HTMLInputElement).files?.[0];
                                if (file) handleFileSelect(file);
                              };
                              input.click();
                            }}
                          >
                            browse files
                          </Button>
                        </p>
                        <p className="text-caption text-muted-foreground">JSON files only</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* File Error */}
                {fileError && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>{fileError}</AlertDescription>
                  </Alert>
                )}

                {/* Interface Name Field */}
                <div className="space-y-2">
                  <Label htmlFor="interface-name">Interface Name</Label>
                  <Input
                    id="interface-name"
                    value={importInterfaceName}
                    onChange={(e) => handleInterfaceNameChange(e.target.value)}
                    placeholder="Enter interface name"
                    className={nameError ? 'border-red-500' : ''}
                  />
                  {nameError && <p className="text-caption text-destructive">{nameError}</p>}
                </div>

                {/* Use Template Name Checkbox */}
                {templateData?.template?.name && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="use-template-name"
                      checked={useTemplateName}
                      onCheckedChange={handleUseTemplateNameChange}
                    />
                    <Label htmlFor="use-template-name" className="text-body">
                      Use from template ({templateData.template.name})
                    </Label>
                  </div>
                )}
              </>
            )}

            {/* Action Buttons */}
            {!showImportSuccess && (
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowImportDialog(false)}
                  disabled={isImporting}
                >
                  Cancel
                </Button>
                <Button
                  onClick={executeImport}
                  disabled={
                    !selectedFile || !importInterfaceName.trim() || !!nameError || isImporting
                  }
                >
                  {isImporting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Importing...
                    </>
                  ) : (
                    'Import Template'
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Create Interface Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create New Interface</DialogTitle>
            <DialogDescription>
              Create a new interface for project:{' '}
              <span className="font-mono font-medium">{projectId}</span>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Interface Name Field */}
            <div className="space-y-2">
              <Label htmlFor="create-interface-name">Interface Name</Label>
              <Input
                id="create-interface-name"
                value={createInterfaceName}
                onChange={(e) => handleCreateInterfaceNameChange(e.target.value)}
                onKeyDown={handleCreateKeyDown}
                placeholder="Enter interface name"
                className={createNameError ? 'border-red-500' : ''}
              />
              {createNameError && (
                <p className="text-caption text-destructive">{createNameError}</p>
              )}
            </div>

            {/* Error Message */}
            {createResult && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{createResult}</AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            <div className="flex justify-end gap-2 pt-4">
              <Button
                variant="outline"
                onClick={() => setShowCreateDialog(false)}
                disabled={isCreating}
              >
                Cancel
              </Button>
              <Button
                onClick={executeCreateInterface}
                disabled={!createInterfaceName.trim() || !!createNameError || isCreating}
              >
                {isCreating ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creating...
                  </>
                ) : (
                  'Create Interface'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Interface Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Interface</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the interface &quot;{deleteInterfaceName}&quot;? This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Delete Success Message */}
            {showDeleteSuccess && deleteResult && (
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <div className="ml-2">
                  <div className="font-medium text-green-800 dark:text-green-200">
                    {deleteResult}
                  </div>
                  <div className="mt-1 text-sm text-green-700 dark:text-green-300">
                    Refreshing interface list...
                  </div>
                </div>
              </Alert>
            )}

            {/* Warning Message - Hidden during success */}
            {!showDeleteSuccess && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This will permanently delete the interface and all its associated tabs and tiles.
                  This action cannot be undone.
                </AlertDescription>
              </Alert>
            )}

            {/* Error Message */}
            {deleteResult && !showDeleteSuccess && deleteResult.includes('Failed') && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{deleteResult}</AlertDescription>
              </Alert>
            )}

            {/* Action Buttons */}
            {!showDeleteSuccess && (
              <div className="flex justify-end gap-2 pt-4" onKeyDown={handleDeleteKeyDown}>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteDialog(false)}
                  disabled={isDeleting}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={executeDeleteInterface}
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Interface
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Project Dialog */}
      <Dialog open={showDeleteProjectDialog} onOpenChange={setShowDeleteProjectDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete Project</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the project &quot;{projectId}&quot;? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Delete Success Message */}
            {showDeleteProjectSuccess && deleteProjectResult && (
              <Alert className="border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950">
                <CheckCircle className="h-4 w-4 text-green-600 dark:text-green-400" />
                <div className="ml-2">
                  <div className="font-medium text-green-800 dark:text-green-200">
                    {deleteProjectResult}
                  </div>
                  <div className="mt-1 text-sm text-green-700 dark:text-green-300">
                    Refreshing project list...
                  </div>
                </div>
              </Alert>
            )}

            {/* Warning Message - Hidden during success */}
            {!showDeleteProjectSuccess && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  This will permanently delete the project
                  {interfaces.length > 0 &&
                    ` and all ${interfaces.length} interface${interfaces.length !== 1 ? 's' : ''} with their tabs and tiles`}
                  . This action cannot be undone.
                </AlertDescription>
              </Alert>
            )}

            {/* Error Message */}
            {deleteProjectResult &&
              !showDeleteProjectSuccess &&
              deleteProjectResult.includes('Failed') && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{deleteProjectResult}</AlertDescription>
                </Alert>
              )}

            {/* Action Buttons */}
            {!showDeleteProjectSuccess && (
              <div className="flex justify-end gap-2 pt-4" onKeyDown={handleDeleteProjectKeyDown}>
                <Button
                  variant="outline"
                  onClick={() => setShowDeleteProjectDialog(false)}
                  disabled={isDeletingProject}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={executeDeleteProject}
                  disabled={isDeletingProject}
                >
                  {isDeletingProject ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    <>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Delete Project
                    </>
                  )}
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
