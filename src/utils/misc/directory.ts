import { FileProps, NodeProps } from '@/types/common';
import { flattenTree, buildDirectoryTree } from './tree';

// Handle drop event
export function handleDrop(
  event: React.DragEvent<HTMLSpanElement>,
  node: NodeProps,
  updateNode: (droppedNode: NodeProps, newNode: NodeProps) => void
) {
  event.stopPropagation(); // Required to avoid re-rendering the UI back to the original tree
  event.preventDefault();

  // Get trasferred data from drag event
  const nodeData = event.dataTransfer.getData('text/plain');
  const droppedNode = JSON.parse(nodeData) as NodeProps;

  if (
    droppedNode &&
    node.type != 'file' && // Prevent dropping on files
    droppedNode.path != node.path && // Prevent dropping on self
    droppedNode.path != '' // Prevent dropping root folder
  ) {
    // Update paths of dragged nodes and sub-nodes
    const newNode = updateNodePath(droppedNode, node);
    updateNode(droppedNode, newNode);
  }
}

// Hande node path update when dropping a node on a folder
export function updateNodePath(node: NodeProps, currentNode: NodeProps): NodeProps {
  const root = '';

  // Update the path of the dropped node
  let newPath = `${currentNode.path === root ? '' : currentNode.path}${node.name}`;
  if (node.type != 'file' && newPath.at(-1) != '/') newPath += '/'; // Add slash at the end of folder nodes if needed
  const newNode: NodeProps = {
    ...node,
    path: newPath,
  };

  // Recursively update the paths of sub-nodes
  if (node.nodes) {
    newNode.nodes = node.nodes.map((node) => updateNodePath(node, newNode));
  }

  return newNode;
}

// Handle node update when dropping a node on a folder
export function updateNode(
  currentNode: NodeProps,
  newNode: NodeProps,
  tree: NodeProps | undefined,
  type: string,
  setHasChanged: (value: React.SetStateAction<boolean>) => void,
  setTree: (value: React.SetStateAction<NodeProps | undefined>) => void
) {
  if (currentNode && newNode && tree) {
    // Flatten current tree, remove original nodes and append new nodes with updated paths
    let flattenedTree = flattenTree(tree!);
    flattenedTree = flattenedTree.filter(
      (node: NodeProps) => node.path != currentNode.path && !node.path.startsWith(currentNode.path)
    );
    flattenTree(newNode).map((node: NodeProps) => flattenedTree.push(node));

    // Extract entries from flattened tree and reconstruct new directory structure to update the tree state.
    const newEntries = flattenedTree
      .filter(
        (node: NodeProps) => node.type === 'file' || node.nodes?.length === 0 // Allow empty folders
      )
      .map((f: NodeProps) => {
        const object = { path: f.path, type: f.type } as FileProps;
        if (f.data) object['data'] = f.data;
        return object;
      });

    const newTree = buildDirectoryTree(type, newEntries);

    // Check if any change happened as a result. Update tree if so.
    const oldFilesTree = flattenTree(currentNode).filter((node: NodeProps) => node.type === 'file');
    const newFilesTree = flattenTree(newNode).filter((node: NodeProps) => node.type === 'file');
    const mapping = newFilesTree.map((file) => ({
      oldName: oldFilesTree.find((f) => f.name === file.name)!.path,
      newName: file.path,
    }));
    const change = mapping.some((m) => m.oldName != m.newName);
    if (change) {
      setHasChanged(true);
    }
    setTree(newTree);
  }
}
