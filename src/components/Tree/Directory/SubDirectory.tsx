"use client";

import { FileProps, NodeProps } from "@/types/common";
import { ResponseProps } from "@/types/common";
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ChevronRightIcon from "@mui/icons-material/ChevronRightOutlined";
import { FaFile, FaFolder } from "react-icons/fa";
import NewFolder from "./NewFolder";
import { updateNodePath, handleDrop } from "@/utils/misc/directory";

export default function SubDirectory ({ 
  node, 
  updateNode,
  type, 
  setterFunction,
  setSelectedFile,
  setIsOpen,
  renamingFunction,
} : { 
  node: NodeProps,
  updateNode: (currentNode: NodeProps, newNode: NodeProps) => void,
  type: string,
  setterFunction: (x: FileProps | undefined) => void,
  setSelectedFile: React.Dispatch<React.SetStateAction<NodeProps | undefined>>,
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>,
  renamingFunction: (name: string, newName: string) => Promise<ResponseProps>,
}) {

  let [unfold, setUnfold] = useState<boolean>(node.name === type);

  // Handle drag and drop
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const handleDragOver = (event: React.DragEvent<HTMLSpanElement>) => {
    event.stopPropagation(); // Required to avoid targetting the parent lists
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setIsDraggingOver(true);
  };

  return (
    <ul 
      key={node.path} 
      className={`w-full ${isDraggingOver ? "bg-primary" : "bg-background"}`} 
      onDrop={(event) => handleDrop(event, node, updateNode)} 
      onDragOver={handleDragOver} 
      onDragLeave={() => setIsDraggingOver(false)}
    >
      <span
        draggable={true}
        className="flex items-center gap-1.5 py-1 w-full hover:bg-primary hover:text-primary-foreground cursor-grab group"
        onDragStart={(event) => {
          event.dataTransfer.setData("text/plain", JSON.stringify(node));
          event.dataTransfer.effectAllowed = "move";
        }}
        onDragOver={handleDragOver}
      >
        {node.nodes && node.nodes.length > 0 && (
          <button className="p-1 -m-1">
            <motion.span
              animate={{ rotate: unfold ? 45 : 0 }}
              transition={{ type: "spring", bounce: 0, duration: 0.4 }}
              className="flex"
            >
              <ChevronRightIcon
                className={`size-4 text-foreground ${unfold ? "rotate-45" : ""}`}
                onClick={()=>setUnfold(!unfold)}
              />
            </motion.span>
          </button>
        )}
        {node.type != "file" ? (
          <FaFolder
            className={`size-6 text-foreground group-hover:text-primary-foreground ${
              node.nodes?.length === 0 
                ? node.type != "newFolder"
                  ? "ml-[22px]" 
                  : ""
                : ""
            }`}
          />
        ) : (
          <FaFile className="ml-[22px] size-6 text-muted" />
        )}
        <div 
          className="flex flex-row justify-between w-full items-center" 
          onDoubleClick={() => {
            if (node.type === "file") {
              setSelectedFile(node);
              setterFunction({path: node.path, type:node.type, data: node.data});
              setIsOpen(false);
            }
          }}
        >
          <p className="cursor-default select-none">{node.name}</p>
          {node.type != "file"
            ? <NewFolder node={node} updateNode={updateNode} setUnfold={setUnfold}/>
            : null
          }
        </div>
      </span>
      <AnimatePresence>
        {unfold && (
          <motion.ul
            initial={{ height: 0 }}
            animate={{ height: "auto" }}
            exit={{ height: 0 }}
            transition={{ type: "spring", bounce: 0, duration: 0.4 }}
            className="pl-6 overflow-hidden flex flex-col justify-end "
          >
            {node.nodes?.map((node) => (
              <SubDirectory 
                  key={
                    node.nodes 
                    ? node.nodes.map((n) => n.path).join(", ")
                    : node.path
                  }
                  node={node}
                  updateNode={updateNode}
                  type={type}
                  setterFunction={setterFunction}
                  setSelectedFile={setSelectedFile}
                  setIsOpen={setIsOpen}
                  renamingFunction={renamingFunction}
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </ul>
  );
};
