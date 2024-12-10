import { Column } from "@tanstack/react-table";
import { Input } from "@/components/UI/input";

const ColumnSearch = ({column}: {column: Column<any | unknown>}) => {
    return (
      <Input placeholder={"Search..."} onChange={(value) => column.setFilterValue(!value ? undefined : value)}
      />
    );
  };

export default ColumnSearch;
