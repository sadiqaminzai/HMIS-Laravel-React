import { useCallback, useEffect, useRef, useState } from 'react';
import api from '../../api/axios';
import { Transaction } from '../types';
import { mapTransaction } from '../context/TransactionContext';

export type TransactionSortKey = 'serial' | 'party' | 'grandTotal' | 'paid' | 'due' | 'date';

export interface TransactionTypeCounts {
  sales: number;
  purchase: number;
  sales_return: number;
  purchase_return: number;
}

interface Options {
  /** 'all' (super admin) sends no hospital_id and lets the API decide scope. */
  hospitalId: string;
  trxType: Transaction['trxType'];
  search: string;
  sort: TransactionSortKey;
  direction: 'asc' | 'desc';
  page: number;
  perPage: number;
  /** False until the screen is allowed to read invoices at all. */
  enabled: boolean;
}

const EMPTY_COUNTS: TransactionTypeCounts = {
  sales: 0, purchase: 0, sales_return: 0, purchase_return: 0,
};

/** Serials run per document type, so an empty book starts each at 1. */
const EMPTY_SERIALS: TransactionTypeCounts = {
  sales: 1, purchase: 1, sales_return: 1, purchase_return: 1,
};

/**
 * One page of invoices, from the server.
 *
 * The screen used to take the whole book from TransactionContext and filter,
 * sort and slice it in the browser. That cost 15.5 MB over seven sequential
 * requests for a single hospital, and the datatable could not draw a row or
 * count a tab until the last of them landed -- which on live it never did.
 *
 * So the filtering, sorting, counting and paging all moved to SQL, and this
 * hook asks for exactly the fifty rows on screen. The cost no longer follows
 * the invoice count, which is the property that was missing: the desk gets
 * slower every month otherwise.
 *
 * Detail lines are deliberately not part of a list row (the datatable draws
 * none of them). Anything that opens one invoice loads it through
 * `fetchTransaction` below.
 */
export function useTransactionList(options: Options) {
  const { hospitalId, trxType, search, sort, direction, page, perPage, enabled } = options;

  const [rows, setRows] = useState<Transaction[]>([]);
  const [counts, setCounts] = useState<TransactionTypeCounts>(EMPTY_COUNTS);
  const [nextSerials, setNextSerials] = useState<TransactionTypeCounts>(EMPTY_SERIALS);
  const [total, setTotal] = useState(0);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Bumped to re-run the effect after a write, without duplicating the fetch.
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken((n) => n + 1), []);

  /*
   * Guards against an out-of-order response overwriting a newer one.
   *
   * Typing in the search box fires a request per debounce window, and a slow
   * early one landing after a fast later one would leave the table showing
   * results for a term the user has already moved past.
   */
  const requestRef = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setRows([]);
      setCounts(EMPTY_COUNTS);
      setNextSerials(EMPTY_SERIALS);
      setTotal(0);
      setLastPage(1);
      return;
    }

    const requestId = ++requestRef.current;
    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const { data } = await api.get('/transactions', {
          params: {
            ...(hospitalId && hospitalId !== 'all' ? { hospital_id: hospitalId } : {}),
            trx_type: trxType,
            ...(search.trim() ? { search: search.trim() } : {}),
            sort,
            direction,
            page,
            per_page: perPage,
          },
        });

        if (cancelled || requestId !== requestRef.current) return;

        setRows(Array.isArray(data?.data) ? data.data.map(mapTransaction) : []);
        setCounts({ ...EMPTY_COUNTS, ...(data?.counts ?? {}) });
        setNextSerials({ ...EMPTY_SERIALS, ...(data?.next_serials ?? {}) });
        setTotal(Number(data?.total ?? 0));
        setLastPage(Math.max(1, Number(data?.last_page ?? 1)));
      } catch (err: any) {
        if (cancelled || requestId !== requestRef.current) return;

        const status = err?.response?.status;
        // 401/403 are handled by the auth layer and the permission gate; showing
        // a table error for them would just double up on the real message.
        if (status !== 401 && status !== 403) {
          setError(err?.response?.data?.message || 'Failed to load invoices');
        }
        setRows([]);
        setCounts(EMPTY_COUNTS);
        setTotal(0);
      } finally {
        if (!cancelled && requestId === requestRef.current) setLoading(false);
      }
    };

    load();

    return () => { cancelled = true; };
  }, [enabled, hospitalId, trxType, search, sort, direction, page, perPage, reloadToken]);

  return { rows, counts, nextSerials, total, lastPage, loading, error, reload };
}

/**
 * One invoice with its detail lines.
 *
 * List rows carry no lines, so view, edit and print call this first. A row that
 * already has them (one just saved, say) is returned untouched.
 */
export async function fetchTransaction(id: string): Promise<Transaction> {
  const { data } = await api.get(`/transactions/${id}`);
  return mapTransaction(data);
}

/**
 * Delays a fast-changing value so it can be used as a query parameter.
 *
 * The search box would otherwise fire a request per keystroke; at Kabul
 * latencies that is a queue of requests the user has already typed past.
 */
export function useDebouncedValue<T>(value: T, delayMs = 350): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
