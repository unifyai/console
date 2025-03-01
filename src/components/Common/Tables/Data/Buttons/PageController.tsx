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
import { LoaderCircle } from "lucide-react";
import Tooltip from "@/components/Common/Misc/Tooltip";
import { useEffect, useState } from "react";
import { GroupedLogProps, LogProps } from "@/types/evals/logs";

const PageController = ({ interactive, totalPages, pageNumber, setPageNumber, pageLogs, totalLogs, logs, limit }: {
    interactive?: boolean,
    totalPages: number,
    pageNumber: string | undefined,
    setPageNumber: (pageNumber: string | undefined) => void,
    pageLogs: number,
    totalLogs: number,
    logs: LogProps[] | GroupedLogProps[],
    limit: number
}) => {

    /* Display loader when data updates */
    const [loading, setLoading] = useState(false);
    useEffect(() => {
        setLoading(false);
    },[logs])
    

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

    /* Ellipses */
    const startEllipses = pageWindow.length && pageWindow[0] > 0;
    const endEllipses = pageWindow.length && pageWindow[pageWindow.length - 1] < totalPages - 1;

    /* Prev Button */
    const onPrevClick = () => {
        if (pageNum > 0 && interactive) {
            setPageNumber(`${pageNum - 1}`)
            setLoading(true)
        }
    }
    const prevButton = 
        <PaginationItem>
            <PaginationPrevious className={"cursor-pointer " + (interactive ? "" : "opacity-50")} onClick={onPrevClick}/>
        </PaginationItem>

    /* Next Button */
    const onNextClick = () => {
        if (pageNum < totalPages - 1 && interactive) {
            setPageNumber(`${pageNum + 1}`)
            setLoading(true)
        }
    }
    const nextButton = 
        <PaginationItem>
            <PaginationNext className={"cursor-pointer " + (interactive ? "" : "opacity-50")} onClick={onNextClick}/>
        </PaginationItem>
    
    /* Page Button */
    const onPaginationClick = (page: number) => {
        if (interactive) {
            setPageNumber(`${page}`)
            setLoading(true)
        }
    }
    const paginationContent = (page: number, isHovered: boolean) => loading && pageNum == page ? <LoaderCircle className={`animate-spin ${isHovered ? "text-white" : "text-primary"}`} /> : page + 1;
    const PageItem = (page: number) => {
        const [isHovered, setIsHovered] = useState(false);
        return (
            <PaginationItem key={page}>
                <PaginationLink
                    className={"cursor-pointer " + (interactive ? "" : "opacity-50")}
                    onClick={() => onPaginationClick(page)}
                    isActive={pageNum == page}
                    onMouseEnter={() => setIsHovered(true)}
                    onMouseLeave={() => setIsHovered(false)}
                >
                    {paginationContent(page, isHovered)}
                </PaginationLink>
            </PaginationItem>
        );
    };
    const pageButtonTooltip = pageNum + 1 === totalPages && totalPages !== 1
    ?   `Showing logs ${pageNum * limit + 1} to ${totalLogs} of ${totalLogs} logs`
    :   `Showing logs ${pageNum * limit + 1} to ${pageNum * limit + pageLogs} of ${totalLogs} logs`
    const pageButton = (page: number) => pageNum === page 
        ?   <Tooltip key={page} content={pageButtonTooltip}>
                {PageItem(page)}
            </Tooltip> 
        :   PageItem(page)

    return pageWindow.length ? (
        <Pagination>
            <PaginationContent>
                {prevButton}
                {startEllipses && <PaginationItem><PaginationEllipsis /></PaginationItem>}
                {pageWindow.map((page) => pageButton(page))}
                {endEllipses && <PaginationItem><PaginationEllipsis className={interactive ? "" : "opacity-50"} /></PaginationItem>}
                {nextButton}
            </PaginationContent>
        </Pagination>
    ) : <></>;
};

export default PageController;
