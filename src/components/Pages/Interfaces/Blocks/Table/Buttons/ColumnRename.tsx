import { useState, Dispatch, SetStateAction } from "react";
import { Column } from "@tanstack/react-table";
import BaseDialog from "@/components/Common/Dialogs/Base";
import { Input } from "@/components/UI/input";
import SubmitButton from "@/components/Common/Buttons/Submit";
import ActionButton from "@/components/Common/Buttons/Action";
import { Pencil } from "lucide-react";
import { DropdownMenuItem } from "@radix-ui/react-dropdown-menu";
import { sanitizeId } from "@/utils/interfaces/table/columnOperations";

export default function ColumnRename({
  column,
  renderMode = "button",
  onRename,
  open,
  setOpen,
}: {
  column: Column<any>;
  onRename: (oldName: string, newName: string) => void;
  renderMode: "button" | "menuItem";
  open?: boolean;
  setOpen?: Dispatch<SetStateAction<boolean>>;
}) {
  const rawId = column.id.split("/").pop() || column.id;
  const oldName = sanitizeId(rawId);
  const [value, setValue] = useState(oldName);
  const [dialogOpen, setDialogOpen] = useState(false);

  const doRename = () => {
    const newName = value.trim();
    if (newName && newName !== oldName) {
      onRename(oldName, newName);
    }
    setDialogOpen(false);
    setOpen?.(false);
  };

  const trigger = renderMode === "menuItem" ? (
    <DropdownMenuItem
      className="flex items-center gap-2 cursor-pointer"
      onSelect={(e) => e.preventDefault()}
    >
      <div
        onClick={() => setDialogOpen(true)}
        className="flex flex-row gap-2 items-center"
      >
        <Pencil className="h-4 w-4" />
        <span>Rename column</span>
      </div>
    </DropdownMenuItem>
  ) : (
    <ActionButton
      tooltip="Rename column"
      icon={<Pencil className="h-4 w-4" />}
      onClick={() => setDialogOpen(true)}
    />
  );

  return (
    <BaseDialog
      context="tile"
      open={dialogOpen}
      setOpen={setDialogOpen}
      button={trigger}
      title="Rename Column"
      body={
        <Input
          autoFocus
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") doRename();
          }}
        />
      }
      footer={
        <div className="flex justify-end">
          <SubmitButton text="Rename" onClick={doRename} />
        </div>
      }
    />
  );
} 