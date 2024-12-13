import DetailedEntry from "../Entry";

const NewNodes = ({oldParentNode, newParentNode, property, value, type}: {
    oldParentNode: any | undefined, 
    newParentNode: any | undefined, 
    property: string, 
    value: any, 
    type: string
  }) => {
    if (oldParentNode && newParentNode && Object.entries(oldParentNode).findIndex(([k, v]) => k === property && v === value) === Object.entries(oldParentNode).length - 1) {
      const newNodes = Object.entries(newParentNode).filter(([key, value]) => !Object.keys(oldParentNode).includes(key));
      return newNodes.map(([property, value], index) => {
          return <DetailedEntry
            key={index}
            property={property}
            value={value}
            newEntry={true}
            type={type}
            logs={undefined}
          />;
      });
    }
    return null;
  };

export default NewNodes;
