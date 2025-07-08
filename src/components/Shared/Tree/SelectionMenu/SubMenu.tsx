"use client";

import { FileProps, NodeProps } from "@/types/common";
import { ReactNode, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ChevronRightIcon from "@mui/icons-material/ChevronRightOutlined";
import { Workflow, Dot } from "lucide-react";

export default function SubMenu ({ 
  node, 
  type,
  setIsOpen,
  onClick
} : { 
  node: NodeProps,
  type: string,
  setIsOpen: React.Dispatch<React.SetStateAction<boolean>>,
  onClick: (value: any) => void
}) {

  let [unfold, setUnfold] = useState<boolean>(node.name === type);

  return (
    <ul key={node.path} className={`w-full bg-background`} >
      <span className={`flex items-center gap-1.5 py-1 w-full ${ node.type != "file" ? "hover:bg-primary hover:text-primary-foreground cursor-pointer" : ""} group`}>
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
          <Workflow
            className={`size-6 text-foreground group-hover:text-primary-foreground ${
              node.nodes?.length === 0 
                ? node.type != "newFolder"
                  ? "ml-[22px]" 
                  : ""
                : ""
            }`}
          />
        ) : (
          <Dot className="ml-[22px] size-6 text-muted" />
        )}
        <div className="flex flex-row justify-between w-full items-center" onClick={() => {
            onClick(node.path)
            setIsOpen(false)
          }}>
          <p className={`cursor-default select-none ${node.type === "file" ? "text-muted" : ""}`}>{node.name}</p>
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
              <SubMenu 
                  key={
                    node.nodes 
                    ? node.nodes.map((n) => n.path).join(", ")
                    : node.path
                  }
                  node={node}
                  type={type}
                  setIsOpen={setIsOpen}
                  onClick={onClick}
              />
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </ul>
  );
};
