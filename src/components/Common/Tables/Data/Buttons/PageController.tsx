"use client";

import {
    Pagination,
    PaginationContent,
    PaginationEllipsis,
    PaginationItem,
    PaginationLink,
    PaginationNext,
    PaginationPrevious
} from "@/components/UI/pagination";

const PageController = ({ totalPages, pagination, setPagination }: {
    totalPages: number,
    pagination: { [key: string]: number },
    setPagination: (pagination: { [key: string]: number }) => void
}) => {
    totalPages = totalPages != Math.floor(totalPages) ? Math.floor(totalPages) + 1 : totalPages;
    let pageWindow = [
        pagination.pageIndex - 2,
        pagination.pageIndex - 1,
        pagination.pageIndex,
        pagination.pageIndex + 1,
        pagination.pageIndex + 2,
    ].filter(page => page >= 0 && page < totalPages);
    if (pageWindow.length == 4) {
        if (pageWindow[0] == pagination.pageIndex - 2)
            pageWindow = pageWindow.slice(1);
        else if (pageWindow[pageWindow.length - 1] == pagination.pageIndex + 2)
            pageWindow = pageWindow.slice(0, pageWindow.length - 1);
    }
    else if (pageWindow.length == 5)
        pageWindow = pageWindow.slice(1, pageWindow.length - 1);

    const startEllipses = pageWindow.length && pageWindow[0] > 0;
    const endEllipses = pageWindow.length && pageWindow[pageWindow.length - 1] < totalPages - 1;

    return pageWindow.length ? (
        <Pagination>
            <PaginationContent>
                <PaginationItem>
                    <PaginationPrevious
                        className="cursor-pointer"
                        onClick={() => pagination.pageIndex > 0 ? setPagination({
                            pageIndex: pagination.pageIndex - 1, pageSize: pagination.pageSize
                        }) : null}
                    />
                </PaginationItem>
                {startEllipses && <PaginationItem><PaginationEllipsis /></PaginationItem>}
                {pageWindow.map(page => (
                    <PaginationItem key={page}>
                        <PaginationLink
                            className="cursor-pointer"
                            onClick={() => setPagination({
                                pageIndex: page, pageSize: pagination.pageSize
                            })}
                            isActive={pagination.pageIndex == page}
                        >
                            {page + 1}
                        </PaginationLink>
                    </PaginationItem>
                ))}
                {endEllipses && <PaginationItem><PaginationEllipsis /></PaginationItem>}
                <PaginationItem>
                    <PaginationNext
                        className="cursor-pointer"
                        onClick={() => pagination.pageIndex < totalPages - 1 ? setPagination({
                            pageIndex: pagination.pageIndex + 1, pageSize: pagination.pageSize
                        }) : null}
                    />
                </PaginationItem>
            </PaginationContent>
        </Pagination>
    ) : <></>;
};

export default PageController;
