// Pagination utilities for API endpoints

export interface PaginationParams {
  page?: number | string;
  pageSize?: number | string;
  limit?: number | string;
}

export interface PaginationMeta {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: PaginationMeta;
}

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const MIN_PAGE_SIZE = 1;

export function parsePaginationParams(params: PaginationParams): {
  page: number;
  pageSize: number;
} {
  let page = parseInt(String(params.page ?? 1), 10);
  let pageSize = parseInt(String(params.pageSize ?? params.limit ?? DEFAULT_PAGE_SIZE), 10);

  // Validate and constrain page
  if (isNaN(page) || page < 1) page = 1;

  // Validate and constrain pageSize
  if (isNaN(pageSize) || pageSize < MIN_PAGE_SIZE) pageSize = DEFAULT_PAGE_SIZE;
  if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

  return { page, pageSize };
}

export function getPaginationSkipTake(
  page: number,
  pageSize: number
): { skip: number; take: number } {
  const skip = (page - 1) * pageSize;
  return { skip, take: pageSize };
}

export function createPaginationMeta(
  currentPage: number,
  pageSize: number,
  totalItems: number
): PaginationMeta {
  const totalPages = Math.ceil(totalItems / pageSize);

  return {
    currentPage,
    pageSize,
    totalItems,
    totalPages,
    hasNextPage: currentPage < totalPages,
    hasPreviousPage: currentPage > 1,
  };
}

export function createPaginatedResponse<T>(
  data: T[],
  currentPage: number,
  pageSize: number,
  totalItems: number
): PaginatedResponse<T> {
  return {
    data,
    pagination: createPaginationMeta(currentPage, pageSize, totalItems),
  };
}

// Helper to convert URL search params to pagination params
export function extractPaginationFromUrl(
  searchParams: URLSearchParams
): PaginationParams {
  return {
    page: searchParams.get("page") || undefined,
    pageSize: searchParams.get("pageSize") || searchParams.get("limit") || undefined,
  };
}
