const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export const toPositiveInt = (value, fallback) => {
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

export const toOptionalString = (value) =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

export const parsePagination = (query) => ({
  page: toPositiveInt(query.page, 1),
  pageSize: Math.min(toPositiveInt(query.pageSize, DEFAULT_PAGE_SIZE), MAX_PAGE_SIZE),
});

export const buildPagination = ({ page, pageSize, total }) => ({
  page,
  pageSize,
  total,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});