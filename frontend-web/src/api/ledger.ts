import api from './axios';

export interface LedgerEntryApi {
  id: number;
  hospital_id: number;
  source_type: string;
  source_id: number;
  event_type: string;
  revision: number;
  entry_direction: 'income' | 'expense' | 'adjustment';
  module: string;
  category?: string | null;
  title: string;
  patient_id?: number | null;
  supplier_id?: number | null;
  amount: string | number;
  discount_amount: string | number;
  tax_amount: string | number;
  net_amount: string | number;
  paid_amount: string | number;
  due_amount: string | number;
  currency: string;
  status: string;
  posted_at?: string | null;
  voided_at?: string | null;
  posted_by?: string | null;
  patient?: { id: number; name: string; patient_id?: string } | null;
  supplier?: { id: number; name: string } | null;
}

export interface LedgerSummaryApi {
  income_total: number;
  expense_total: number;
  net_total: number;
  due_total: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
}

const unwrap = <T>(res: any): PaginatedResponse<T> => {
  const payload = res?.data;
  if (Array.isArray(payload)) {
    return { data: payload as T[] };
  }

  return {
    data: (payload?.data ?? []) as T[],
    current_page: payload?.current_page,
    last_page: payload?.last_page,
    per_page: payload?.per_page,
    total: payload?.total,
  };
};

export async function listLedger(params?: Record<string, any>) {
  const res = await api.get('/ledger', { params });
  return unwrap<LedgerEntryApi>(res);
}

export async function getLedgerSummary(params?: Record<string, any>) {
  const res = await api.get('/ledger/summary', { params });
  return res.data as LedgerSummaryApi;
}

export async function exportLedger(params?: Record<string, any>) {
  const res = await api.get('/ledger/export', {
    params,
    responseType: 'blob',
  });

  return res.data as Blob;
}
