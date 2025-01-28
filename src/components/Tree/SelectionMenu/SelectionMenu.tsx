"use client";

import React, { useState, useEffect } from "react";

import SubMenu from "./SubMenu";
import BaseDialog from "../../Common/Dialogs/Base";
import { FileProps, NodeProps } from "@/types/common";
import { FolderTree } from "lucide-react";
import { buildDirectoryTree, flattenTree } from "@/utils/misc/tree";
import SettingButton from "../../Common/Buttons/Setting";
import { ReactNode } from "react";

export default function SelectionMenu ({ type, data, onClick } : {
  type: string, 
  data: FileProps[],
  onClick: (value: any) => void
}) {
  
  // Handle directory modal
  const [isOpen, setIsOpen] = useState(false);
  const tree = buildDirectoryTree(type, data)
  
  return (
      <BaseDialog
        button={
            <SettingButton variant="outline" icon={<FolderTree/>} tooltip={`Manage ${type}`}/>
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
              onClick={onClick}
            />
          ))
        }
      />  
  );
};
