'use client';

import {
  GranularInterfaceActions,
  GranularTabActions,
  GranularTileActions,
  InterfaceTemplateSchema,
  TemplateExportResponse,
  TemplateImportResponse,
  Favourite,
  FavouritesActions,
} from '@/types/interfaces/grid';
import {
  Hammer,
  SquareMousePointer,
  Settings,
  Plus,
  Pen,
  Trash2,
  Upload,
  Download,
  Loader2,
  FileUp,
  X,
  Check,
  CheckCircle,
  AlertCircle,
  Star,
} from 'lucide-react';
import { Switch } from '@/components/UI/switch';
import { Label } from '@/components/UI/label';
import Tooltip from '@/components/Common/Misc/Tooltip';
import { useStoreContext } from '@/contexts/providers/StoreProvider';
import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import { showSuccessToast, showErrorToast } from '@/components/Common/Toasts/notifications';
import { useListInterfacesQuery } from '@/hooks/Interfaces/Query/useInterfacesQuery';
import BaseDropdown from '../../../../Common/Dropdowns/Base';
import ActionButton from '../../../../Common/Buttons/Action';
import BaseDialog from '../../../../Common/Dialogs/Base';
import { Input } from '../../../../UI/input';
import SubmitButton from '../../../../Common/Buttons/Submit';
import { Alert, AlertDescription } from '@/components/UI/alert';
import { createCompleteDefaultInterface } from '@/utils/interfaces/interfaceSelector';
import { Button } from '@/components/UI/button';
import { Checkbox } from '@/components/UI/checkbox';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import SelectionCommand from '@/components/Common/Commands/SelectionCommand';

const InterfaceButtons = ({
  tabIdOrName,
  interfaceId,
  interfaceActions,
  tabActions,
  tileActions,
  favouritesActions,
  initialFavourites,
  disabled,
  setOverlayState,
  setIsSwitchingInterface,
}: {
  tabIdOrName: string | null;
  interfaceId: string;
  interfaceActions: GranularInterfaceActions;
  tabActions: GranularTabActions;
  tileActions: GranularTileActions;
  favouritesActions: FavouritesActions;
  initialFavourites: Favourite[];
  disabled?: boolean;
  setOverlayState: React.Dispatch<
    React.SetStateAction<{
      isVisible: boolean;
      operation: 'saving' | 'resetting' | 'refreshing' | null;
      status: 'loading' | 'success' | 'error' | null;
    }>
  >;
  setIsSwitchingInterface: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  // Get the project data and the contexts with granular access
  const project = useStoreContext((state) => state.activeProjectId);

  // Fetch interfaces for the current project
  const {
    data: interfacesData,
    isLoading: isLoadingInterfaces,
    refetch: refetchInterfaces,
  } = useListInterfacesQuery(project, interfaceActions);

  const interfaces = useMemo(() => interfacesData || [], [interfacesData]);
  const currentInterface = useMemo(
    () => interfaces.find((iface: any) => iface.id === interfaceId),
    [interfaces, interfaceId]
  );
  const interfaceNames = useMemo(() => interfaces.map((iface: any) => iface.name), [interfaces]);

  // Dialog and dropdown states
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);

  // State for create dialog
  const [isCreating, setIsCreating] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createError, setCreateError] = useState('');

  // State for rename dialog
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameName, setRenameName] = useState('');
  const [renameError, setRenameError] = useState('');

  // State for delete dialog
  const [isDeleting, setIsDeleting] = useState(false);

  // State for import dialog
  const [isImporting, setIsImporting] = useState(false);
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

  // Favourites state
  const [favourites, setFavourites] = useState<Favourite[]>(initialFavourites);
  const [isFavouriting, setIsFavouriting] = useState(false);

  useEffect(() => {
    setFavourites(initialFavourites);
  }, [initialFavourites]);

  const currentFavourite = useMemo(() => {
    if (!currentInterface?.name || !favourites) return null;
    return favourites.find((fav) => fav.projectName === currentInterface.name) || null;
  }, [currentInterface, favourites]);

  const handleToggleFavourite = async () => {
    if (!currentInterface?.name || isFavouriting || !project) return;

    setIsFavouriting(true);
    try {
      if (currentFavourite) {
        const success = await favouritesActions.delete(currentFavourite.id);
        if (success) {
          setFavourites((prev) => prev.filter((f) => f.id !== currentFavourite.id));
          showSuccessToast('Removed from Favourites');
        } else {
          showErrorToast('Failed to remove from Favourites');
        }
      } else {
        const newPosition = favourites.length;
        const newFavourite = await favouritesActions.create(
          currentInterface.name,
          'layout-dashboard',
          newPosition
        );
        if (newFavourite) {
          setFavourites((prev) => [...prev, newFavourite]);
          showSuccessToast('Added to Favourites');
        } else {
          showErrorToast('Failed to add to Favourites');
        }
      }
    } catch (error) {
      console.error('Error toggling favourite:', error);
      showErrorToast('An error occurred while managing Favourites.');
    } finally {
      setIsFavouriting(false);
    }
  };

  const handleInterfaceSelect = (selectedName: string) => {
    if (!selectedName || currentInterface?.name === selectedName) return;
    setIsSwitchingInterface(true);
    const newParams = new URLSearchParams(searchParams.toString());
    newParams.set('interface', selectedName);
    router.push(`?${newParams.toString()}`);
  };

  const handleCreateInterface = async () => {
    if (!createName.trim()) {
      setCreateError('Interface name is required.');
      return;
    }
    if (
      interfaces.some((iface: any) => iface.name.toLowerCase() === createName.trim().toLowerCase())
    ) {
      setCreateError('An interface with this name already exists.');
      return;
    }
    setIsCreating(true);
    setCreateError('');
    try {
      const newInterface = await createCompleteDefaultInterface({
        queryClient,
        project: project!,
        interfaceActions,
        tabActions,
        tileActions,
        baseName: createName.trim(),
      });
      if (newInterface?.name) {
        setIsSwitchingInterface(true);
        const url = new URL(window.location.href);
        url.searchParams.set('interface', newInterface.name);
        router.push(url.toString());
        setCreateOpen(false);
      } else {
        throw new Error('Failed to create interface.');
      }
    } catch (error) {
      setCreateError((error as Error).message);
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    if (createOpen) {
      setCreateName('');
      setCreateError('');
    }
  }, [createOpen]);

  const handleRenameInterface = async () => {
    if (!currentInterface || !renameName.trim()) {
      setRenameError('Interface name is required.');
      return;
    }
    if (renameName.trim() === currentInterface.name) {
      setRenameOpen(false);
      return;
    }
    if (
      interfaces.some(
        (iface: any) =>
          iface.name.toLowerCase() === renameName.trim().toLowerCase() && iface.id !== interfaceId
      )
    ) {
      setRenameError('An interface with this name already exists.');
      return;
    }
    setIsRenaming(true);
    setRenameError('');
    try {
      await interfaceActions.update({
        interfaceId: interfaceId,
        data: { name: renameName.trim() },
      });
      const url = new URL(window.location.href);
      url.searchParams.set('interface', renameName.trim());
      router.push(url.toString());
      setRenameOpen(false);
      refetchInterfaces();
    } catch (error) {
      setRenameError((error as Error).message);
    } finally {
      setIsRenaming(false);
    }
  };

  useEffect(() => {
    if (renameOpen) {
      setRenameName(currentInterface?.name || '');
      setRenameError('');
    }
  }, [renameOpen, currentInterface]);

  const handleDeleteInterface = async () => {
    setIsDeleting(true);
    try {
      await interfaceActions.delete({ interfaceId: interfaceId });
      router.push(`/interfaces?project=${project}`);
    } catch (error) {
      console.error('Failed to delete interface', error);
    } finally {
      setIsDeleting(false);
      setDeleteOpen(false);
    }
  };

  const handleExportTemplate = useCallback(async () => {
    if (!currentInterface) return;
    try {
      const result = await interfaceActions.exportTemplate(
        {
          interfaceId: currentInterface.id!,
          projectName: project!,
          interfaceName: currentInterface.name,
        },
        { includeMetadata: true, templateName: currentInterface.name }
      );
      if ('error' in result) throw new Error(result.error);
      const blob = new Blob([JSON.stringify(result, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentInterface.name}-template.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Failed to export template', error);
    }
  }, [currentInterface, interfaceActions, project]);

  const handleFileSelect = useCallback(
    (file: File) => {
      setFileError('');
      if (file.type !== 'application/json') {
        setFileError('Please select a valid JSON template file.');
        return;
      }
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (!parsed.template?.name) throw new Error('Invalid template file.');
          setTemplateData(parsed);
          if (useTemplateName) setImportInterfaceName(parsed.template.name);
        } catch (error) {
          setFileError('Invalid JSON in template file.');
        }
      };
      reader.readAsText(file);
    },
    [useTemplateName]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => handleFileSelect(files[0]),
    multiple: false,
    accept: { 'application/json': ['.json'] },
  });

  const validateImportName = useCallback(
    (name: string) => {
      if (!name.trim()) {
        setNameError('Interface name is required.');
        return false;
      }
      if (interfaces.some((iface: any) => iface.name.toLowerCase() === name.toLowerCase())) {
        setNameError('An interface with this name already exists.');
        return false;
      }
      setNameError('');
      return true;
    },
    [interfaces]
  );

  const executeImport = useCallback(async () => {
    if (!selectedFile || !templateData || !validateImportName(importInterfaceName)) return;
    setIsImporting(true);
    try {
      const result = await interfaceActions.importTemplate(templateData.template, {
        projectName: project!,
        newInterfaceName: importInterfaceName.trim(),
        validateFirst: true,
        autoSanitize: true,
      });
      if ('error' in result) {
        throw new Error(result.error);
      }
      setImportResult(result as TemplateImportResponse);
      setShowImportSuccess(true);
      setTimeout(async () => {
        setImportOpen(false);
        // Refetch and use the cached data - no duplicate API call
        const { data: refreshedInterfaces } = await refetchInterfaces();
        const newInterface = refreshedInterfaces?.find(
          (i: { name: string }) => i.name === importInterfaceName.trim()
        );
        if (newInterface) {
          const url = new URL(window.location.href);
          url.searchParams.set('interface', newInterface.name);
          router.push(url.toString());
        }
      }, 2000);
    } catch (error) {
      setFileError((error as Error).message);
    } finally {
      setIsImporting(false);
    }
  }, [
    selectedFile,
    templateData,
    importInterfaceName,
    validateImportName,
    interfaceActions,
    project,
    refetchInterfaces,
    router,
  ]);

  return (
    <div className="flex items-center gap-2">
      {/* Add Tile button removed - use the floating button in the bottom left instead */}
    </div>
  );
};

export default InterfaceButtons;
