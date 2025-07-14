"use client";

import { GranularInterfaceActions, GranularTabActions, GranularTileActions, InterfaceTemplateSchema, TemplateExportResponse, TemplateImportResponse, Favourite, FavouritesActions } from "@/types/interfaces/grid";
import { Hammer, SquareMousePointer, Settings, Plus, Pen, Trash2, Upload, Download, Loader2, FileUp, X, Check, CheckCircle, AlertCircle, RefreshCw, Star } from "lucide-react";
import { Switch } from "@/components/UI/switch";
import { Label } from "@/components/UI/label";
import Tooltip from "@/components/Common/Misc/Tooltip";
import AddTile from "./AddTile";
import { useStoreContext } from "@/contexts/providers/StoreProvider";
import { useMemo, useState, useCallback, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQueryClient } from "@tanstack/react-query";
import { useTab } from "@/contexts/hooks/tab";
import { getAnyTileLoading } from "@/contexts/utils/sliceUtils";
import { showSuccessToast, showErrorToast } from "@/components/Common/Toasts/notifications";
import { useListInterfacesQuery } from "@/hooks/Interfaces/Query/useInterfacesQuery";
import BaseDropdown from "../../../../Common/Dropdowns/Base";
import ActionButton from "../../../../Common/Buttons/Action";
import BaseDialog from "../../../../Common/Dialogs/Base";
import { Input } from "../../../../UI/input";
import SubmitButton from "../../../../Common/Buttons/Submit";
import { Alert, AlertDescription } from "@/components/UI/alert";
import { createCompleteDefaultInterface } from "@/utils/interfaces/interfaceSelector";
import { Button } from "@/components/UI/button";
import { Checkbox } from "@/components/UI/checkbox";
import { useDropzone } from "react-dropzone";
import { cn } from "@/lib/utils";
import SelectionCommand from "@/components/Common/Commands/SelectionCommand";

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
    tabIdOrName: string | null,
    interfaceId: string,
    interfaceActions: GranularInterfaceActions,
    tabActions: GranularTabActions,
    tileActions: GranularTileActions,
    favouritesActions: FavouritesActions;
    initialFavourites: Favourite[];
    disabled?: boolean,
    setOverlayState: React.Dispatch<React.SetStateAction<{
        isVisible: boolean;
        operation: 'saving' | 'resetting' | 'refreshing' | null;
        status: 'loading' | 'success' | 'error' | null;
    }>>;
    setIsSwitchingInterface: React.Dispatch<React.SetStateAction<boolean>>;
}) => {
    const router = useRouter();
    const searchParams = useSearchParams();
    const queryClient = useQueryClient();

    // Get the project data and the contexts with granular access
    const project = useStoreContext((state) => state.activeProjectId);
    const anyTileLoading = useStoreContext(state => getAnyTileLoading(state));

    // Tab states and actions with granular access
    const {
        meta: tabMetaState,
        ui: tabUIState,
        uiActions: tabUIActions,
    } = useTab(tabIdOrName || "", interfaceId);
    const tabId = tabMetaState?.id || null;

    // Fetch interfaces for the current project
    const { data: interfacesData, isLoading: isLoadingInterfaces, refetch: refetchInterfaces } = useListInterfacesQuery(
        project,
        interfaceActions
    );

    const interfaces = useMemo(() => interfacesData || [], [interfacesData]);
    const currentInterface = useMemo(() => interfaces.find(iface => iface.id === interfaceId), [interfaces, interfaceId]);
    const interfaceNames = useMemo(() => interfaces.map(iface => iface.name), [interfaces]);

    // Dialog and dropdown states
    const [settingsOpen, setSettingsOpen] = useState(false);
    const [createOpen, setCreateOpen] = useState(false);
    const [renameOpen, setRenameOpen] = useState(false);
    const [deleteOpen, setDeleteOpen] = useState(false);
    const [importOpen, setImportOpen] = useState(false);

    // State for create dialog
    const [isCreating, setIsCreating] = useState(false);
    const [createName, setCreateName] = useState("");
    const [createError, setCreateError] = useState("");

    // State for rename dialog
    const [isRenaming, setIsRenaming] = useState(false);
    const [renameName, setRenameName] = useState("");
    const [renameError, setRenameError] = useState("");

    // State for delete dialog
    const [isDeleting, setIsDeleting] = useState(false);

    // State for import dialog
    const [isImporting, setIsImporting] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [dragActive, setDragActive] = useState(false);
    const [importInterfaceName, setImportInterfaceName] = useState("");
    const [useTemplateName, setUseTemplateName] = useState(false);
    const [templateData, setTemplateData] = useState<TemplateExportResponse<InterfaceTemplateSchema> | null>(null);
    const [nameError, setNameError] = useState("");
    const [fileError, setFileError] = useState("");
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
        return favourites.find(fav => fav.project === currentInterface.name) || null;
    }, [currentInterface, favourites]);

    const handleToggleFavourite = async () => {
        if (!currentInterface?.name || isFavouriting || !project) return;

        setIsFavouriting(true);
        try {
            if (currentFavourite) {
                const success = await favouritesActions.delete(currentFavourite.id);
                if (success) {
                    setFavourites(prev => prev.filter(f => f.id !== currentFavourite.id));
                    showSuccessToast("Removed from Favourites");
                } else {
                    showErrorToast("Failed to remove from Favourites");
                }
            } else {
                const newPosition = favourites.length;
                const newFavourite = await favouritesActions.create(currentInterface.name, 'layout-dashboard', newPosition);
                if (newFavourite) {
                    setFavourites(prev => [...prev, newFavourite]);
                    showSuccessToast("Added to Favourites");
                } else {
                    showErrorToast("Failed to add to Favourites");
                }
            }
        } catch (error) {
            console.error("Error toggling favourite:", error);
            showErrorToast("An error occurred while managing Favourites.");
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
        if (!createName.trim()) { setCreateError("Interface name is required."); return; }
        if (interfaces.some(iface => iface.name.toLowerCase() === createName.trim().toLowerCase())) {
            setCreateError("An interface with this name already exists."); return;
        }
        setIsCreating(true);
        setCreateError("");
        try {
            const newInterface = await createCompleteDefaultInterface({
                queryClient, project: project!, interfaceActions, tabActions, tileActions, baseName: createName.trim()
            });
            if (newInterface?.name) {
                setIsSwitchingInterface(true);
                const url = new URL(window.location.href);
                url.searchParams.set('interface', newInterface.name);
                router.push(url.toString());
                setCreateOpen(false);
            } else { throw new Error("Failed to create interface."); }
        } catch (error) {
            setCreateError((error as Error).message);
        } finally { setIsCreating(false); }
    };
    
    useEffect(() => {
        if(createOpen) {
            setCreateName("");
            setCreateError("");
        }
    }, [createOpen]);

    const handleRenameInterface = async () => {
        if (!currentInterface || !renameName.trim()) { setRenameError("Interface name is required."); return; }
        if (renameName.trim() === currentInterface.name) { setRenameOpen(false); return; }
        if (interfaces.some(iface => iface.name.toLowerCase() === renameName.trim().toLowerCase() && iface.id !== interfaceId)) {
            setRenameError("An interface with this name already exists."); return;
        }
        setIsRenaming(true); setRenameError("");
        try {
            await interfaceActions.update({ interface_id: interfaceId, data: { name: renameName.trim() }});
            const url = new URL(window.location.href);
            url.searchParams.set('interface', renameName.trim());
            router.push(url.toString());
            setRenameOpen(false);
            refetchInterfaces();
        } catch (error) {
            setRenameError((error as Error).message);
        } finally { setIsRenaming(false); }
    };

    useEffect(() => {
        if(renameOpen) {
            setRenameName(currentInterface?.name || "");
            setRenameError("");
        }
    }, [renameOpen, currentInterface]);

    const handleDeleteInterface = async () => {
        setIsDeleting(true);
        try {
            await interfaceActions.delete({ interface_id: interfaceId });
            router.push(`/interfaces?project=${project}`);
        } catch (error) {
            console.error("Failed to delete interface", error);
        } finally {
            setIsDeleting(false);
            setDeleteOpen(false);
        }
    };

    const handleExportTemplate = useCallback(async () => {
        if (!currentInterface) return;
        try {
            const result = await interfaceActions.exportTemplate(
                { interface_id: currentInterface.id!, project: project!, interface_name: currentInterface.name },
                { include_metadata: true, template_name: currentInterface.name }
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
            console.error("Failed to export template", error);
        }
    }, [currentInterface, interfaceActions, project]);

    const handleFileSelect = useCallback((file: File) => {
        setFileError("");
        if (file.type !== 'application/json') { setFileError("Please select a valid JSON template file."); return; }
        setSelectedFile(file);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const parsed = JSON.parse(e.target?.result as string);
                if (!parsed.template?.name) throw new Error("Invalid template file.");
                setTemplateData(parsed);
                if (useTemplateName) setImportInterfaceName(parsed.template.name);
            } catch (error) { setFileError("Invalid JSON in template file."); }
        };
        reader.readAsText(file);
    }, [useTemplateName]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop: (files) => handleFileSelect(files[0]), multiple: false, accept: { 'application/json': ['.json'] } });
    
    const validateImportName = useCallback((name: string) => {
        if (!name.trim()) { setNameError("Interface name is required."); return false; }
        if (interfaces.some(iface => iface.name.toLowerCase() === name.toLowerCase())) {
            setNameError("An interface with this name already exists."); return false;
        }
        setNameError(""); return true;
    }, [interfaces]);

    const executeImport = useCallback(async () => {
        if (!selectedFile || !templateData || !validateImportName(importInterfaceName)) return;
        setIsImporting(true);
        try {
            const result = await interfaceActions.importTemplate(templateData.template, { project: project!, new_interface_name: importInterfaceName.trim(), validate_first: true, auto_sanitize: true });
            if ('error' in result) { throw new Error(result.error); }
            setImportResult(result as TemplateImportResponse);
            setShowImportSuccess(true);
            setTimeout(async () => {
                setImportOpen(false);
                await refetchInterfaces();
                const newInterface = (await interfaceActions.list(project!)).find(i => i.name === importInterfaceName.trim());
                if (newInterface) {
                    const url = new URL(window.location.href);
                    url.searchParams.set('interface', newInterface.name);
                    router.push(url.toString());
                }
            }, 2000);
        } catch (error) { setFileError((error as Error).message);
        } finally { setIsImporting(false); }
    }, [selectedFile, templateData, importInterfaceName, validateImportName, interfaceActions, project, refetchInterfaces, router]);


    return (
        <div className="flex items-center gap-2">
            
            {/* Interface Selector */}
            {project && (
                <SelectionCommand
                    type="Interfaces"
                    items={interfaceNames}
                    value={currentInterface?.name}
                    onSelect={handleInterfaceSelect}
                    loading={isLoadingInterfaces}
                    onOpenChange={refetchInterfaces}
                />
            )}

            {/* Add Tile Button */}
            {tabId && <AddTile
                tabId={tabId}
                interfaceId={interfaceId}
                project={project}
                anyTileLoading={anyTileLoading}
                tabActions={tabActions} 
                tileActions={tileActions}
            />}

            {/* Refresh Button */}
            {tabId && <ActionButton
                className="backdrop-blur-sm bg-background/90 border border-border/50 shadow-md"
                variant="outline"
                icon={tabUIState?.refreshing ? <RefreshCw className="animate-spin" /> : <RefreshCw />}
                tooltip={"Refresh Interface"}
                disabled={!project || tabUIState?.pending || tabUIState?.dataPending}
                onClick={async () => {
                    tabUIActions?.setRefreshing(true);
                    setOverlayState({ isVisible: true, operation: 'refreshing', status: 'loading' });
                    try {
                        await Promise.all([
                            router.refresh(),
                            new Promise(resolve => setTimeout(resolve, 1000))
                        ]);
                        setOverlayState({ isVisible: true, operation: 'refreshing', status: 'success' });
                    } catch (error) {
                        console.error("Failed to refresh interface:", error);
                        setOverlayState({ isVisible: true, operation: 'refreshing', status: 'error' });
                    } finally {
                        tabUIActions?.setRefreshing(false);
                    }
                }}
            />}
            
            {/* Edit and Interactive mode switches */}
            <div className="flex items-center gap-2 backdrop-blur-sm bg-background/90 border border-border/50 shadow-md rounded-lg px-3 py-1 h-8">
                <Switch id="edit" checked={tabUIState?.edit || false} onCheckedChange={() => { const newEditState = !tabUIState?.edit; tabUIActions?.setEdit(newEditState); showSuccessToast("Edit Mode", newEditState ? "You can now edit your interface." : "Edit mode disabled."); }} disabled={!project}/>
                <Label htmlFor="edit" className="cursor-pointer"><Tooltip content="Edit"><Hammer name="edit" size={18} color={tabUIState?.edit ? "var(--primary)" : undefined} /></Tooltip></Label>
            </div>

            <div className="flex items-center gap-2 backdrop-blur-sm bg-background/90 border border-border/50 shadow-md rounded-lg px-3 py-1 h-8">
                <Switch id="interactive" checked={tabUIState?.interactive || false} onCheckedChange={() => { const newInteractiveState = !tabUIState?.interactive; tabUIActions?.setInteractive(newInteractiveState); showSuccessToast("Interactive Mode", newInteractiveState ? "Interactive mode enabled." : "Interactive mode disabled."); }} disabled={!project} />
                <Label htmlFor="interactive" className="cursor-pointer"><Tooltip content="Interactive"><SquareMousePointer name="interactive" size={18} color={tabUIState?.interactive ? "var(--primary)" : undefined} /></Tooltip></Label>
            </div>

            {/* Interface Settings Dropdown */}
            {project && (
                <BaseDropdown
                    context="interface"
                    button={<ActionButton tooltip="Interface Settings" icon={<Settings />} variant="outline" className="backdrop-blur-sm bg-background/90 border border-border/50 shadow-md"/>}
                    open={settingsOpen}
                    setOpen={setSettingsOpen}
                >
                    <div className="w-56 flex flex-col items-center p-2">
                        <div className="w-full border-b pb-1">
                             <BaseDialog
                                open={createOpen} setOpen={setCreateOpen} title="Create New Interface"
                                button={<ActionButton tooltip="Create new interface" text="Create new interface" icon={<Plus className="mr-2 h-4 w-4" />} variant="ghost" className="w-full justify-start" />}
                                body={<div className="space-y-2 pt-4"><Label htmlFor="iface-name">Interface Name</Label><Input id="iface-name" value={createName} onChange={e => { setCreateName(e.target.value); setCreateError(""); }} onKeyDown={e => e.key === 'Enter' && handleCreateInterface()} autoFocus /><p className="text-xs text-destructive">{createError}</p></div>}
                                footer={<SubmitButton text="Create" onClick={handleCreateInterface} loading={isCreating} />}
                            />
                        </div>
                        <div className="w-full border-b py-1">
                            <BaseDialog open={renameOpen} setOpen={setRenameOpen} title="Rename Interface"
                                button={<ActionButton tooltip="Rename current interface" text="Rename interface" icon={<Pen className="mr-2 h-4 w-4" />} variant="ghost" className="w-full justify-start" />}
                                body={<div className="space-y-2 pt-4"><Label htmlFor="iface-rename">New Name</Label><Input id="iface-rename" value={renameName} onChange={e => { setRenameName(e.target.value); setRenameError(""); }} onKeyDown={e => e.key === 'Enter' && handleRenameInterface()} autoFocus /><p className="text-xs text-destructive">{renameError}</p></div>}
                                footer={<SubmitButton text="Rename" onClick={handleRenameInterface} loading={isRenaming} />}
                            />
                        </div>
                        <div className="w-full border-b py-1">
                            <BaseDialog open={deleteOpen} setOpen={setDeleteOpen} title="Delete Interface"
                                button={<ActionButton tooltip="Delete current interface" text="Delete interface" icon={<Trash2 className="mr-2 h-4 w-4" />} variant="ghost" className="w-full justify-start" />}
                                body={<p className="pt-4">Are you sure you want to delete the interface {currentInterface?.name}? This action cannot be undone.</p>}
                                footer={<Button variant="destructive" onClick={handleDeleteInterface} disabled={isDeleting}>{isDeleting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Delete</Button>}
                            />
                        </div>
                        <div className="w-full border-b py-1">
                            <ActionButton tooltip="Export current interface as template" text="Export as template" icon={<Download className="mr-2 h-4 w-4" />} variant="ghost" onClick={handleExportTemplate} className="w-full justify-start" />
                        </div>
                        <div className="w-full pt-1">
                            <BaseDialog open={importOpen} setOpen={setImportOpen} title="Import Interface from Template"
                                button={<ActionButton tooltip="Setup a new interface from a template" text="Import from template" icon={<Upload className="mr-2 h-4 w-4" />} variant="ghost" className="w-full justify-start" />}
                                body={
                                    <div className="space-y-4 pt-4">
                                        {showImportSuccess && importResult ? (
                                            <Alert className="border-green-200 bg-green-50"><CheckCircle className="h-4 w-4 text-green-600" /><div className="ml-2"><div className="font-medium text-green-800">Template imported!</div><div className="text-sm text-green-700 mt-1">Created: {importResult.import_stats?.interfaces} interface, {importResult.import_stats?.tabs} tabs, {importResult.import_stats?.tiles} tiles</div></div></Alert>
                                        ) : (
                                            <>
                                                <div {...getRootProps()} className={cn("border-2 border-dashed rounded-lg p-6 text-center transition-colors", dragActive ? 'border-primary bg-primary/5' : 'border-gray-300', selectedFile ? 'border-green-500 bg-green-50' : '')}><input {...getInputProps()} />{selectedFile ? (<div className="flex items-center justify-center gap-2 text-green-600"><Check className="h-5 w-5" /><span>{selectedFile.name}</span><Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); setSelectedFile(null); setTemplateData(null); setFileError(""); }}><X className="h-4 w-4" /></Button></div>) : (<div className="space-y-2"><FileUp className="h-8 w-8 mx-auto text-gray-400" /><p className="text-sm font-medium">Drag & drop or <Button variant="link" className="p-0 h-auto" onClick={(e) => e.stopPropagation()}>browse</Button></p></div>)}</div>
                                                {fileError && <Alert variant="destructive"><AlertCircle className="h-4 w-4" /><AlertDescription>{fileError}</AlertDescription></Alert>}
                                                <div className="space-y-2"><Label htmlFor="import-name">New Interface Name</Label><Input id="import-name" value={importInterfaceName} onChange={e => { setImportInterfaceName(e.target.value); validateImportName(e.target.value); }} className={nameError ? "border-red-500" : ""} />{nameError && <p className="text-xs text-red-500">{nameError}</p>}</div>
                                                {templateData?.template?.name && <div className="flex items-center space-x-2"><Checkbox id="use-template-name" checked={useTemplateName} onCheckedChange={(c) => { setUseTemplateName(!!c); if (c) setImportInterfaceName(templateData.template.name); }} /><Label htmlFor="use-template-name" className="text-sm">Use name from template ({templateData.template.name})</Label></div>}
                                            </>
                                        )}
                                    </div>
                                }
                                footer={!showImportSuccess ? <div className="flex justify-end gap-2 pt-4"><Button variant="outline" onClick={() => setImportOpen(false)} disabled={isImporting}>Cancel</Button><Button onClick={executeImport} disabled={!selectedFile || !importInterfaceName.trim() || !!nameError || isImporting}>{isImporting && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}Import</Button></div> : <></>}
                            />
                        </div>
                    </div>
                </BaseDropdown>
            )}

        </div>
    );
};

export default InterfaceButtons;