"use client";

import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from "lucide-react";

export interface PaginationMeta {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

interface PaginationControlsProps {
  pagination: PaginationMeta;
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

export function PaginationControls({
  pagination,
  onPageChange,
  isLoading = false,
}: PaginationControlsProps) {
  const { currentPage, totalPages, hasNextPage, hasPreviousPage } = pagination;

  const handleFirstPage = () => onPageChange(1);
  const handlePreviousPage = () => onPageChange(currentPage - 1);
  const handleNextPage = () => onPageChange(currentPage + 1);
  const handleLastPage = () => onPageChange(totalPages);

  const isDisabled = isLoading || totalPages === 0;

  return (
    <div className="flex items-center justify-between gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="text-sm text-slate-600">
        Page <span className="font-medium">{currentPage}</span> of{" "}
        <span className="font-medium">{totalPages}</span> ({" "}
        <span className="font-medium">{pagination.totalItems}</span> total)
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={handleFirstPage}
          disabled={isDisabled || !hasPreviousPage}
          className="rounded-lg border border-slate-300 p-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="First page"
        >
          <ChevronsLeft className="h-4 w-4" />
        </button>

        <button
          onClick={handlePreviousPage}
          disabled={isDisabled || !hasPreviousPage}
          className="rounded-lg border border-slate-300 p-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Previous page"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const pageNum = currentPage > 3 ? currentPage - 2 + i : i + 1;
            if (pageNum > totalPages) return null;
            return (
              <button
                key={pageNum}
                onClick={() => onPageChange(pageNum)}
                disabled={isDisabled}
                className={`rounded px-3 py-1 text-sm font-medium transition-colors ${
                  pageNum === currentPage
                    ? "bg-blue-600 text-white"
                    : "border border-slate-300 text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>

        <button
          onClick={handleNextPage}
          disabled={isDisabled || !hasNextPage}
          className="rounded-lg border border-slate-300 p-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Next page"
        >
          <ChevronRight className="h-4 w-4" />
        </button>

        <button
          onClick={handleLastPage}
          disabled={isDisabled || !hasNextPage}
          className="rounded-lg border border-slate-300 p-2 text-slate-600 transition-colors hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          title="Last page"
        >
          <ChevronsRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

interface PageSizeSelectorProps {
  pageSize: number;
  onPageSizeChange: (size: number) => void;
  isLoading?: boolean;
}

export function PageSizeSelector({
  pageSize,
  onPageSizeChange,
  isLoading = false,
}: PageSizeSelectorProps) {
  const sizes = [10, 20, 50, 100];

  return (
    <div className="flex items-center gap-2">
      <label className="text-sm font-medium text-slate-700">Items per page:</label>
      <select
        value={pageSize}
        onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
        disabled={isLoading}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
      >
        {sizes.map((size) => (
          <option key={size} value={size}>
            {size}
          </option>
        ))}
      </select>
    </div>
  );
}
