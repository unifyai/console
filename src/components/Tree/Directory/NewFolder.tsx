"use client";

import { useState, useMemo, useRef } from "react";
import Tooltip from "../../Common/Misc/Tooltip";
import { FaPlus } from "react-icons/fa";
import { NodeProps } from "@/types/common";
import * as path from "path";

export default function NewFolder ({
  node, 
  updateNode,
  setUnfold
}:{
  node: NodeProps, 
  updateNode: (currentNode: NodeProps, newNode: NodeProps) => void,
  setUnfold: React.Dispatch<React.SetStateAction<boolean>>
}) {
  
  // Validate new folder name
  const [newFolderName, setNewFolderName] = useState<string | undefined>();
  const currentFolders = node.nodes!.map((n) => n.path);
  const validateName = (value: string) => {
    if (["", undefined].includes(value)) return "empty";
    if (currentFolders.findIndex((name) => name === value) != -1) {
        return "duplicate";
    }
    return "valid";
  };
  const isInvalidName = useMemo(() => {
      return validateName(newFolderName!);
    }, [newFolderName]);

  // Handle new folder input
  const inputRef = useRef<HTMLInputElement>(null);
  const [folderInput, setFolderInput] = useState<boolean>(false);
  const handleIconClick = () => {
    setFolderInput(true);
    // Focus the input element after it is rendered
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
      }
    }, 0);
  };
  const updateNodes = () => {

    setFolderInput(false);

    // Avoid duplicating default folders
    const defaultFoldersCount = currentFolders.filter(f => path.basename(f).includes("NewFolder")).length;
    const newName = isInvalidName === "valid" ? newFolderName : `NewFolder${defaultFoldersCount + 1}`;

    // Update tree with new folder
    let newNode = JSON.parse(JSON.stringify(node));
    newNode.nodes = [
      ...node.nodes!, 
      { 
        name: newName!, 
        path: `${node.path}${newName}/`,
        nodes: []
      }
    ];
    updateNode(node, newNode);
    setUnfold(true);
  };
  return(
    <>
      {
        folderInput 
          ? <input
              className="bg-background text-foreground self-center"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") updateNodes();
              }}
              onPointerOut={()=>{
                if (inputRef.current != document.activeElement) updateNodes();
              }}
              ref={inputRef}
            />          
          : <Tooltip 
              content="Add new folder"
            >
              <div
                className="cursor-pointer hover:bg-primary rounded-md p-2 self-center"
                onClick={handleIconClick}
              >
                <FaPlus/>
              </div>
            </Tooltip>
      }
    </>
  );
};
