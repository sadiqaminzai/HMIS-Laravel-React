import api from '../../api/axios';

/**
 * Fetch every page of a Laravel paginated endpoint.
 *
 * The contexts used to request a single page of 200 and keep only that, so any
 * hospital with more than 200 records silently lost the remainder. Server-side
 * pagination is kept (no single huge query or response); this just walks it.
 */
export async function fetchAllPages<T = any>(
  url: string,
  params: Record<string, unknown> = {},
  options: { perPage?: number; maxPages?: number } = {}
): Promise<T[]> {
  const perPage = options.perPage ?? 500;
  const maxPages = options.maxPages ?? 100; // guard against a malformed paginator

  const records: T[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const { data } = await api.get(url, { params: { ...params, per_page: perPage, page } });
    const pageRecords: T[] = data?.data ?? data ?? [];
    records.push(...pageRecords);

    lastPage = Number(data?.last_page ?? 1);

    // A plain (non-paginated) array, or an empty page, means there is nothing
    // more to fetch. The empty check also stops a malformed paginator from
    // burning requests all the way to maxPages.
    if (!Array.isArray(data?.data) || pageRecords.length === 0) break;

    page += 1;
  } while (page <= lastPage && page <= maxPages);

  return records;
}
