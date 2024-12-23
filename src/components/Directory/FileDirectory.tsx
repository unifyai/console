"use client";

import React, { useState, useMemo, useCallback, useEffect, } from "react";

import Tooltip from "../Common/Misc/Tooltip";
import BaseDialog from "../Common/Dialogs/Base";
import BaseButton from "../Common/Buttons/Base";
import AutoComplete from "../Common/Misc/AutoComplete";
import SubmitButton from "../Common/Buttons/Submit";
import SubDirectory from "./SubDirectory";

import { FileProps, NodeProps } from "@/types/common";
import { ResponseProps } from "@/types/common";
import { Folder } from "lucide-react";
import { buildDirectoryTree, flattenTree } from "@/utils/misc/tree";
import { updateNode } from "@/utils/misc/directory";
import CancelButton from "../Common/Buttons/Cancel";
import SettingButton from "../Common/Buttons/Setting";

export default function FileDirectory ({ type,  data, defaultValue, setterFunction, renamingFunction } : {
  type: string, 
  data: FileProps[],
  defaultValue?: string | undefined,
  setterFunction: (x: FileProps | undefined) => void,
  renamingFunction: (name: string, newName: string) => Promise<ResponseProps>,
}) {
  
  // Initialize tree and keep a backup of the original for reference
  const [initialTree, setInitialTree] = useState<NodeProps>();
  const [tree, setTree] = useState<NodeProps>();
  useEffect(() => {
    const structure = buildDirectoryTree(type, data);
    setInitialTree(structure);
    setTree(structure);
  }, [data]);

  // Handle filtering and selection using the search bar
  const [selectedFile, setSelectedFile] = useState<NodeProps | undefined>();
  const files = useMemo(() => {
    return tree ? flattenTree(tree).filter((node) => node.type === "file") : [];
  }, [tree]);
  const handleSelection = useCallback((selection: string | undefined, files: NodeProps[]) => {
    const selectedFile = files.find(f => f.path === selection);
    setSelectedFile(selectedFile);
    setterFunction(selectedFile);
  }, []);


  // Handle node update when dropping a node on a folder
  const handleNodeUpdate = (currentNode: NodeProps, newNode: NodeProps) => {
    updateNode(currentNode, newNode, tree, type, setHasChanged, setTree)
  };

  // Handle tree change validation
  const [hasChanged, setHasChanged] = useState<boolean>(false);
  const onSubmit = async () => {
    
    // Map old file paths to new paths
    const oldFiles = flattenTree(initialTree!).filter((node: NodeProps) => node.type === "file");
    const newFiles = flattenTree(tree!).filter((node: NodeProps) => node.type === "file");
    const mapping = newFiles.map((file) => ({oldName: oldFiles.find(f => f.name === file.name)!.path, newName: file.path }));
    const changes = mapping.filter((m) => m.oldName != m.newName);
        
    // Call renaming API
    await Promise.all(changes.map(change => renamingFunction(change.oldName, change.newName)));
  };

  // Handle directory modal
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex flex-row gap-2 items-center">
      <BaseDialog
        button={
            <SettingButton variant="outline" icon={<Folder/>} tooltip={`Manage ${type}`}/>
        }
        title="File Directory"
        description={`Search and organize your ${type.toLowerCase()} by folder. Double click on a file to select it.`}
        body={
          [tree].map((node, index) => (
            <SubDirectory
              key={index}
              node={node!}
              updateNode={handleNodeUpdate}
              type={type}
              setterFunction={setterFunction}
              setSelectedFile={setSelectedFile}
              setIsOpen={setIsOpen}
              renamingFunction={renamingFunction}
            />
          ))
        }
        footer={hasChanged && 
          <>
          <CancelButton onClick={() => {
            setTree(initialTree);
            setHasChanged(false);
          }}/>
          <SubmitButton text="Save" onClick={onSubmit}/>
          </>
        }
      />  
      <AutoComplete 
        type={type}
        items={files.map((file) => ({label: file.name, value: file.path}))}
        defaultValue={defaultValue}
        onSelect={(currentValue: string) => handleSelection(currentValue, files)}
      />
    </div>
  );
};
