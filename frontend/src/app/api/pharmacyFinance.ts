import api from '../../api/axios';

export type FinanceDocType = 'sales' | 'purchase' | 'sales_return' | 'purchase_return';
export type PaymentStatus = 'pending' | 'partial' | 'paid';

export interface FinanceDocApi {
  id: number;
  hospital_id: number;
  serial_no: number;
  trx_type: FinanceDocType;
  patient_id: number | null;
  patient_name: string | null;
  supplier_id: number | null;
  supplier_name: string | null;
  grand_total: number | string;
  total_discount: number | string;
  total_tax: number | string;
  paid_amount: number | string;
  due_amount: number | string;
  payment_status: PaymentStatus;
  payment_method: string | null;
  payment_reference: string | null;
  payment_due_date: string | null;
  last_payment_at: string | null;
  finance_note: string | null;
  settled_by: string | null;
  created_at: string;
  updated_at?: string;
}

export interface FinanceTypeSummary {
  document_count: number;
  total_amount: number;
  paid_amount: number;
  due_amount: number;
  pending_count: number;
  partial_count: number;
  paid_count: number;
}

export interface FinanceSummary {
  allowed_types: FinanceDocType[];
  by_type: Record<string, FinanceTypeSummary>;
  totals: {
    total_amount: number;
    paid_amount: number;
    due_amount: number;
    document_count: number;
  };
}

export interface FinancePage {
  data: FinanceDocApi[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

export interface FinanceQuery {
  trx_type?: string;
  payment_status?: string;
  search?: string;
  start_date?: string;
  end_date?: string;
  overdue_only?: boolean;
  hospital_id?: string;
  page?: number;
  per_page?: number;
}

/** Drop empty/"all" filters so they are not sent as blank query params. */
function clean(params: FinanceQuery): Record<string, any> {
  return Object.fromEntries(
    Object.entries(params).filter(
      ([, value]) => value !== undefined && value !== null && value !== '' && value !== 'all' && value !== false
    )
  );
}

export async function listFinanceDocs(params: FinanceQuery = {}): Promise<FinancePage> {
  const { data } = await api.get('/pharmacy-finance', { params: clean(params) });
  return data;
}

export async function getFinanceSummary(params: FinanceQuery = {}): Promise<FinanceSummary> {
  const { data } = await api.get('/pharmacy-finance/summary', { params: clean(params) });
  return data;
}

export async function exportFinanceDocs(params: FinanceQuery = {}): Promise<FinanceDocApi[]> {
  const { data } = await api.get('/pharmacy-finance/export', { params: clean(params) });
  return data?.data ?? data;
}

export async function recordFinancePayment(
  id: number | string,
  payload: { amount: number; payment_method?: string; payment_reference?: string; finance_note?: string }
): Promise<FinanceDocApi> {
  const { data } = await api.post(`/pharmacy-finance/${id}/payment`, payload);
  return data?.data ?? data;
}

export async function updateFinanceStatus(
  id: number | string,
  payload: {
    payment_status?: PaymentStatus;
    payment_due_date?: string | null;
    payment_method?: string | null;
    payment_reference?: string | null;
    finance_note?: string | null;
  }
): Promise<FinanceDocApi> {
  const { data } = await api.put(`/pharmacy-finance/${id}/status`, payload);
  return data?.data ?? data;
}
