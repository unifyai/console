import * as path from 'path';
import { NodeProps, FileProps } from '../../types/common';

/* 
  Build a tree structure from an array of file items
*/
export function buildDirectoryTree(type: string, entries: FileProps[]): NodeProps {
  const root: NodeProps = { name: type, path: '', nodes: [] };

  entries.forEach((entry) => {
    const filePath = entry.path; // **/file  ||  file
    const fileDir = path.dirname(filePath); // **       ||  .
    const fileName = path.basename(filePath); // file     ||  file

    let currentNode: NodeProps = root;
    let currentPath = '';

    // Handle the case where the file is directly under the root
    if (fileDir === '.') {
      // Add the file node directly to the root
      const fileNode: NodeProps = {
        name: fileName,
        type: entry.type ? entry.type : entry.data ? 'file' : undefined,
        path: filePath,
        data: entry.data,
        nodes: entry.data ? undefined : [],
      };
      currentNode.nodes = currentNode.nodes || [];
      currentNode.nodes.push(fileNode);
    } else {
      // Traverse the directory tree to find the parent node
      fileDir // /usr/file    ||  usr/file
        .split(path.sep) // ["", "usr"]  ||  ["usr"]
        .filter((dir) => dir != '') // ["usr"]      ||  ["usr"]
        .forEach((dir) => {
          let childNode = currentNode.nodes?.find((node) => node.name === dir && node.nodes);

          if (!childNode) {
            childNode = { name: dir, path: `${currentPath}${dir}/`, nodes: [] };
            currentNode.nodes = currentNode.nodes || [];
            currentNode.nodes.push(childNode);
          }
          currentNode = childNode;
          currentPath = currentNode.path;
        });

      // Add the file node to the parent node
      const fileNode: NodeProps = {
        name: fileName,
        type: entry.type ? entry.type : entry.data ? 'file' : undefined,
        path: filePath,
        data: entry.data,
        nodes: entry.data ? undefined : [],
      };
      currentNode.nodes = currentNode.nodes || [];
      currentNode.nodes.push(fileNode);
    }
  });

  return root;
}

/* 
  Flatten the tree structure to update nodes on DnD
*/
export function flattenTree(node: NodeProps): NodeProps[] {
  const flattened = [node];
  if (node.nodes) {
    node.nodes.forEach((subnode) => {
      flattened.push(...flattenTree(subnode));
    });
  }
  return flattened;
}
