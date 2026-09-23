export type Pagination = {
  limit: number;
  offset: number;
  total: number;
};

export type PaginatedResponse<T> = {
  items: T[];
  pagination: Pagination;
};

export type ApiErrorResponse = {
  error: {
    code: string;
    message: string;
  };
  issues?: unknown[];
};
