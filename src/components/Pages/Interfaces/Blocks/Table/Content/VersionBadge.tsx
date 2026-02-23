import { Badge } from '@/components/UI/badge';
import Tooltip from '@/components/Common/Misc/Tooltip';
import { Cell } from '@tanstack/react-table';

const VersionBadge = ({ cell }: { cell: Cell<any, unknown> }) => {
  return (
    <>
      {cell.column.columnDef.meta?.columnType === 'params' && (
        <div className="scale-80 absolute right-3 top-1">
          <Tooltip content={`v.${cell.getValue()}`}>
            <Badge variant="outline">{'v'}</Badge>
          </Tooltip>
        </div>
      )}
    </>
  );
};

export default VersionBadge;
