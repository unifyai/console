"use client";

import { Interface, TileProps } from "@/types/evals/grid";
import { Eye, Hammer, PencilRuler, SquareMousePointer } from "lucide-react";
import { Plus } from "lucide-react";
import { Check, Clipboard, ListRestart, Loader2, TriangleAlert, Save, FocusIcon } from "lucide-react";
import ActionButton from "../Common/Buttons/Action";
import BaseDropdown from "../Common/Dropdowns/Base";
import { DropdownMenuItem } from "../UI/dropdown-menu";
import { Context } from "@/types/evals/grid";
import { useRouter } from "next/navigation";
import { SetStateAction } from "react";
import { ResponseProps } from "@/types/common";
import { Switch } from "../UI/switch";
import { Label } from "../UI/label";
import Tooltip from "../Common/Misc/Tooltip";

const InterfaceButtons = ({
    edit,
    interactive,
    interface_,
    project,
    pending,
    anyTilePending,
    items,
    newCounter,
    copied,
    resetting,
    saveSuccess,
    hiddenItems,
    savedInterface,
    setItems,
    setNewCounter,
    setCopied,
    setResetting,
    setEdit,
    setInteractive,
    setFocusDialog,
    setSaveDialog,
    updateInterface,
}: {
    edit: boolean,
    interactive: boolean,
    project_: string | null,
    interface_: string | null,
    project: string | null,
    pending: boolean,
    anyTilePending: boolean,
    context: string | undefined,
    columnContext: string | undefined,
    contexts: Context[],
    items: TileProps[],
    newCounter: number,
    copied: string | undefined,
    resetting: boolean,
    saveSuccess: boolean | undefined,
    hiddenItems: TileProps[],
    savedInterface: Interface,
    setItems: (value: SetStateAction<TileProps[]>) => void,
    setNewCounter: (value: SetStateAction<number>) => void,
    setCopied: (value: SetStateAction<string | undefined>) => void,
    setResetting: (value: SetStateAction<boolean>) => void,
    setEdit: (value: SetStateAction<boolean>) => void,
    setInteractive: (value: SetStateAction<boolean>) => void,
    setFocusDialog: (value: SetStateAction<boolean>) => void,
    setDataPending: (value: SetStateAction<boolean>) => void,
    setContext: (value: SetStateAction<string | undefined>) => void,
    setColumnContext: (value: SetStateAction<string | undefined>) => void,
    setSaveDialog: (value: SetStateAction<boolean>) => void,
    updateInterface: (savedInterface?: Interface | null) => Promise<ResponseProps>
}) => {
    const router = useRouter();

    const saveIcon = saveSuccess ? <Check /> : saveSuccess == false ? <TriangleAlert /> : <Save />;
    const resetIcon = resetting ? <Loader2 className="animate-spin" /> : <ListRestart />;
    const variant = saveSuccess == false ? "destructive" : "outline";

    return (
        <div className="flex gap-2 items-center pl-4 pr-10">
            <ActionButton
                className="transition-all"
                tooltip="Open Focus Pane"
                icon={<FocusIcon />}
                variant={"outline"}
                disabled={anyTilePending || !project || !interface_ || pending}
                onClick={() => setFocusDialog(true)}
            />
            <ActionButton
                className="transition-all"
                tooltip={!project ? "Select a project first" : "Save Interface"}
                icon={saveIcon}
                variant={variant}
                disabled={anyTilePending || !project || !interface_ || pending}
                onClick={async () => setSaveDialog(true)}
            />
            <ActionButton
                className="transition-all"
                tooltip={!project ? "Select a project first" : "Return to last saved interface"}
                icon={resetIcon}
                variant="outline"
                disabled={anyTilePending || !project || pending}
                onClick={async () => updateInterface(savedInterface).then(() => {
                    setResetting(true);
                    setEdit(true);
                    router.refresh();
                })}
            />
            <ActionButton
                className="transition-all"
                tooltip={(!edit || !project) ? "Select a project first" : "Add new tile"}
                icon={<Plus />}
                text="Add Tile"
                variant="outline"
                disabled={!edit || !project || pending}
                onClick={() => {
                    setItems([
                        ...items,
                        {
                            i: "Tile_" + newCounter,
                            x: (items.length * 2) % 12,
                            y: (items.length * 2) / 12,
                            w: 4,
                            h: 4,
                            minW: 4,
                            minH: 4,
                            tab: undefined,
                            visible: true,
                        }
                    ]);
                    setNewCounter(newCounter + 1);
                }}
            />
            <BaseDropdown
                button={<ActionButton
                    variant="outline"
                    icon={<Eye />}
                    tooltip="Show Hidden"
                    size="sm"
                    disabled={hiddenItems.length == 0 || pending}
                />}
            >
                {hiddenItems.map((item, idx) => <DropdownMenuItem
                    key={idx}
                    onSelect={() => {
                        setItems([...items.map(
                            it => it.i == item.i ? {
                                ...it,
                                x: (items.length * 2) % 12,
                                y: (items.length * 2) / 12,
                                w: 4,
                                h: 4,
                                minW: 4,
                                minH: 4,
                                visible: true
                            } : { ...it }
                        )]);
                    }}
                    disabled={hiddenItems.length == 0}
                    className="w-64"
                >
                    {item.i}
                </DropdownMenuItem>)}
            </BaseDropdown>
            <ActionButton
                variant="outline"
                icon={<Clipboard />}
                tooltip="Paste"
                disabled={!copied || pending}
                onClick={() => {
                    const copiedItem = items.find(item => item.i == copied) as TileProps;
                    setItems([
                        ...items,
                        { ...copiedItem, i: "Tile_" + newCounter }
                    ]);
                    setNewCounter(newCounter + 1);
                    setCopied(undefined);
                }}
            />
            <div className="flex items-center gap-2 border rounded-md p-1">
                <Switch id="edit" checked={edit} onCheckedChange={() => setEdit(!edit)} />
                <Label htmlFor="edit">
                    <Tooltip content="Edit">
                        <Hammer name="edit" size={18} color={edit ? "var(--primary)" : undefined} />
                    </Tooltip>
                </Label>
            </div>
            <div className="flex items-center gap-2 border rounded-md p-1">
                <Switch id="interactive" checked={interactive} onCheckedChange={() => setInteractive(!interactive)} />
                <Label htmlFor="interactive">
                    <Tooltip content="Interactive">
                        <SquareMousePointer name="interactive" size={18} color={interactive ? "var(--primary)" : undefined} />
                    </Tooltip>
                </Label>
            </div>
        </div>
    )
};

export default InterfaceButtons;
