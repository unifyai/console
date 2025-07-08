"use client";

import React, { useState, useEffect } from "react";

import SubMenu from "./SubMenu";
import BaseDialog from "../../../Common/Dialogs/Base";
import { FileProps, NodeProps } from "@/types/common";
import { GroupedLogProps, LogProps } from "@/types/interfaces/logs";
import { FolderTree, LoaderCircle } from "lucide-react";
import { buildDirectoryTree, flattenTree } from "@/utils/misc/tree";
import SettingButton from "../../../Common/Buttons/Setting";

export default function SelectionMenu ({ type, data, onClick, logs } : {
  type: string, 
  data: FileProps[],
  onClick: (value: any) => void,
  logs: LogProps[] | GroupedLogProps[]
}) {
  
  /* Display loader when data updates */
  const [loading, setLoading] = useState(false);
  useEffect(() => {
      setLoading(false);
  },[logs])

  // Handle directory modal
  const [isOpen, setIsOpen] = useState(false);
  const tree = buildDirectoryTree(type, data)
  const icon = loading ? <LoaderCircle className="animate-spin text-primary"/> : <FolderTree/>

  // Handle update
  const handleClick = (value: any) => {
    onClick(value);
    setLoading(true);
  }
  return (
      <BaseDialog
        button={
            <SettingButton variant="outline" icon={icon} tooltip={`Manage ${type}`} disabled={loading}/>
        }
        title={`${type[0].toUpperCase() + type.slice(1)} selector`}
        description={`Select one of your ${type.toLowerCase()}.`}
        open={isOpen}
        setOpen={setIsOpen}
        body={
          [tree].map((node, index) => (
            <SubMenu
              key={index}
              node={node!}
              type={type}
              setIsOpen={setIsOpen}
              onClick={handleClick}
            />
          ))
        }
      />  
  );
};
