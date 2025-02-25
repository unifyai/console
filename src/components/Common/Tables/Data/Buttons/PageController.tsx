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
import Tooltip from "@/components/Common/Misc/Tooltip";

const PageController = ({ interactive, totalPages, pageNumber, setPageNumber, pageLogs, totalLogs }: {
    interactive?: boolean,
    totalPages: number,
    pageNumber: string | undefined,
    setPageNumber: (pageNumber: string | undefined) => void,
    pageLogs?: number,
    totalLogs?: number
}) => {
    const pageNum = parseInt(pageNumber || "0");
    totalPages = totalPages != Math.floor(totalPages) ? Math.floor(totalPages) + 1 : totalPages;
    let pageWindow = [
        pageNum - 2,
        pageNum - 1,
        pageNum,
        pageNum + 1,
        pageNum + 2,
    ].filter(page => page >= 0 && page < totalPages);
    if (pageWindow.length == 4) {
        if (pageWindow[0] == pageNum - 2)
            pageWindow = pageWindow.slice(1);
        else if (pageWindow[pageWindow.length - 1] == pageNum + 2)
            pageWindow = pageWindow.slice(0, pageWindow.length - 1);
    }
    else if (pageWindow.length == 5)
        pageWindow = pageWindow.slice(1, pageWindow.length - 1);

    const startEllipses = pageWindow.length && pageWindow[0] > 0;
    const endEllipses = pageWindow.length && pageWindow[pageWindow.length - 1] < totalPages - 1;

    const paginationItem = (page: number) => 
        <PaginationItem key={page}>
            <PaginationLink
                className={"cursor-pointer " + (interactive ? "" : "opacity-50")}
                onClick={() => interactive ? setPageNumber(`${page}`) : undefined}
                isActive={pageNum == page}
            >
                {page + 1}
            </PaginationLink>
        </PaginationItem>

    return pageWindow.length ? (
        <Pagination>
            <PaginationContent>
                <PaginationItem>
                    <PaginationPrevious
                        className={"cursor-pointer " + (interactive ? "" : "opacity-50")}
                        onClick={() => (pageNum > 0 && !interactive) ? setPageNumber(`${pageNum - 1}`) : null}
                    />
                </PaginationItem>
                {startEllipses && <PaginationItem><PaginationEllipsis /></PaginationItem>}
                {pageWindow.map(page => (
                    pageNum === page 
                        ? <Tooltip content={`Showing ${pageLogs} of ${totalLogs} logs`}>{paginationItem(page)}</Tooltip> 
                        : paginationItem(page)
                ))}
                {endEllipses && <PaginationItem><PaginationEllipsis className={interactive ? "" : "opacity-50"} /></PaginationItem>}
                <PaginationItem>
                    <PaginationNext
                        className={"cursor-pointer " + (interactive ? "" : "opacity-50")}
                        onClick={() => (pageNum < totalPages - 1 && !interactive) ? setPageNumber(`${pageNum + 1}`) : null}
                    />
                </PaginationItem>
            </PaginationContent>
        </Pagination>
    ) : <></>;
};

export default PageController;
