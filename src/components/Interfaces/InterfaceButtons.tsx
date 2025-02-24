"use client";

import { Interface, TileProps } from "@/types/evals/grid";
import { Eye, Hammer, SquareMousePointer } from "lucide-react";
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
import AddTile from "./AddTile";
import ContextSelector from "./Table/Content/ContextSelector";

import { useInterfaceContext } from "../Providers/Stores/InterfaceStoreProvider";

const InterfaceButtons = ({
    project_,
    interface_,
    contexts,
    savedInterface,
    updateInterface,
}: {
    project_: string | null,
    interface_: string | null,
    contexts: Context[],
    savedInterface: Interface,
    updateInterface: (savedInterface?: Interface | null) => Promise<ResponseProps>,
}) => {
    const router = useRouter();

    const project = useInterfaceContext((s) => s.project);
    const pending = useInterfaceContext((s) => s.pending);
    const context = useInterfaceContext((s) => s.context);
    const items = useInterfaceContext((s) => s.items);
    const newCounter = useInterfaceContext((s) => s.newCounter);
    const copied = useInterfaceContext((s) => s.copied);
    const resetting = useInterfaceContext((s) => s.resetting);
    const saveSuccess = useInterfaceContext((s) => s.saveSuccess);
    const edit = useInterfaceContext((s) => s.edit);
    const interactive = useInterfaceContext((s) => s.interactive);
    const anyTilePending = useInterfaceContext((s) => Object.entries(s.tilePending).some(([_, val]) => val));
    const setItems = useInterfaceContext((s) => s.setItems);
    const setNewCounter = useInterfaceContext((s) => s.setNewCounter);
    const setCopied = useInterfaceContext((s) => s.setCopied);
    const setResetting = useInterfaceContext((s) => s.setResetting);
    const setEdit = useInterfaceContext((s) => s.setEdit);
    const setInteractive = useInterfaceContext((s) => s.setInteractive);
    const setFocusDialog = useInterfaceContext((s) => s.setFocusDialog);
    const setDataPending = useInterfaceContext((s) => s.setDataPending);
    const setContext = useInterfaceContext((s) => s.setContext);
    const setSaveDialog = useInterfaceContext((s) => s.setSaveDialog);

    const hiddenItems = items.filter((it) => !it.visible);
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
                disabled={!project || !interface_ || pending}
                onClick={() => setFocusDialog(true)}
            />
            <ContextSelector
                contexts={contexts}
                context={context}
                setContext={(ctx: string) => {
                    setContext(ctx);
                    setItems(items.map(item => {
                        const validContext = contexts.some(c => c.name == ctx);
                        const validItemContext = item.context?.startsWith(ctx);
                        const prefixContexts = contexts.filter(c => c.name.startsWith(ctx));
                        return {
                            ...item,
                            context: validContext
                                ? ctx
                                : validItemContext
                                    ? item.context
                                    : prefixContexts.length == 1
                                        ? prefixContexts[0].name
                                        : undefined,
                            column_context: validItemContext ? item.column_context : undefined
                        };
                    }));
                    setDataPending(true);
                    router.refresh();
                }}
            />
            <ActionButton
                className="transition-all"
                tooltip={!project ? "Select a project first" : "Save Interface"}
                icon={saveIcon}
                variant={variant}
                disabled={!project || !interface_ || pending}
                onClick={async () => setSaveDialog(true)}
            />
            <ActionButton
                className="transition-all"
                tooltip={!project ? "Select a project first" : "Return to last saved interface"}
                icon={resetIcon}
                variant="outline"
                disabled={!project || pending}
                onClick={async () => updateInterface(savedInterface).then(() => {
                    setResetting(true);
                    setEdit(true);
                    router.refresh();
                })}
            />
            <AddTile
                edit={edit}
                project={project_ as string}
                pending={pending}
                items={items}
                newCounter={newCounter}
                setItems={setItems}
                setNewCounter={setNewCounter}
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
                                minW: undefined,
                                minH: undefined,
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
