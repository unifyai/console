import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/UI/pagination';
import { Dispatch, SetStateAction } from 'react';

export default function Pages({
  count,
  pagination,
  setPagination,
}: {
  count: number;
  pagination: { pageIndex: number; pageSize: number };
  setPagination: Dispatch<SetStateAction<{ pageIndex: number; pageSize: number }>>;
}) {
  const page = pagination.pageIndex + 1;
  const showAllPages = count <= 5;
  const startPages = showAllPages ? 1 : Math.max(1, page - 2);
  const endPages = showAllPages ? count : Math.min(count, page + 2);

  return (
    <Pagination>
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            onClick={() =>
              setPagination({
                pageIndex: pagination.pageIndex - 1,
                pageSize: pagination.pageSize,
              })
            }
          />
        </PaginationItem>
        {Array(count).map((_, index) => {
          const pageIndex = index + 1;
          if (pageIndex < startPages && pageIndex !== 1) return null;
          if (pageIndex > endPages && pageIndex !== count) return null;
          return (
            <PaginationItem key={index}>
              <PaginationLink
                onClick={() =>
                  setPagination({
                    pageIndex: index,
                    pageSize: pagination.pageSize,
                  })
                }
                isActive={pageIndex === page}
              >
                {pageIndex}
              </PaginationLink>
            </PaginationItem>
          );
        })}
        {startPages > 2 && (
          <>
            <PaginationItem>
              <PaginationLink
                onClick={() =>
                  setPagination({
                    pageIndex: 0,
                    pageSize: pagination.pageSize,
                  })
                }
                isActive={page === 1}
              >
                {1}
              </PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
          </>
        )}
        {endPages < count - 1 && (
          <>
            <PaginationItem>
              <PaginationEllipsis />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink
                onClick={() =>
                  setPagination({
                    pageIndex: count - 1,
                    pageSize: pagination.pageSize,
                  })
                }
                isActive={page === count}
              >
                {count}
              </PaginationLink>
            </PaginationItem>
          </>
        )}

        <PaginationItem>
          <PaginationNext
            onClick={() =>
              setPagination({
                pageIndex: pagination.pageIndex + 1,
                pageSize: pagination.pageSize,
              })
            }
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
}
