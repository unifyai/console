import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/UI/input";
import Tooltip from "@/components/Common/Misc/Tooltip";

export default function EditableSecret({ value, onSave, conceal = true, className="w-24" }: { value: string; onSave: (val: string) => void; conceal?: boolean; className?: string }) {
  const [editing, setEditing] = useState(false);
  const [temp, setTemp] = useState(value);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (temp !== value) onSave(temp.trim());
  };

  return editing ? (
    <Input
      ref={inputRef}
      className={`${className} px-1 text-body-sm`}
      value={temp}
      onChange={(e) => setTemp(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") commit();
      }}
    />
  ) : (
    <Tooltip content={conceal ? "Value" : "Key"} side="top">
      <Input
        readOnly
        value={conceal ? "***" : value}
        className={`${className} px-1 text-body-sm cursor-pointer`}
        onClick={() => setEditing(true)}
      />
    </Tooltip>
  );
} 