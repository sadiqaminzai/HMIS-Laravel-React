import api from '../../api/axios';

/**
 * X-Ray is a cash desk, not a reporting workflow: the film is read outside
 * ShifaaScript, so a receipt carries the study name, the fee and the payment
 * and nothing clinical. See the backend's create migration for the reasoning.
 */
export interface XrayReceiptApi {
  id: number;
  hospital_id: number;
  sequence_id: number;
  patient_id: number;
  doctor_id: number | null;
  /** The catalogue entry billed, when one was chosen. */
  xray_type_id?: number | null;
  /** The printed label. Kept even with a type, so a rename cannot alter history. */
  study_name: string;
  performed_at: string;
  referred_by: string | null;
  notes: string | null;
  fee: number | string;
  /** Full waiver, matching appointments and patient surgeries. */
  discount_enabled: boolean;
  discount_percentage: number | string;
  discount_amount: number | string;
  /** What the patient owes: fee less discount. */
  net_amount: number | string;
  payment_status: 'unpaid' | 'partial' | 'paid';
  paid_amount?: number | string | null;
  payment_method?: string | null;
  paid_at?: string | null;
  paid_by?: string | null;
  receipt_number?: string | null;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
  patient?: { id: number; name: string; age?: number; gender?: string; phone?: string; patient_id?: string } | null;
  doctor?: { id: number; name: string; specialization?: string } | null;
}

export interface XrayReceiptPayload {
  hospital_id?: number | string;
  patient_id: number | string;
  doctor_id?: number | string | null;
  xray_type_id?: number | string | null;
  study_name: string;
  performed_at: string;
  referred_by?: string | null;
  notes?: string | null;
  fee?: number | null;
  discount_enabled?: boolean;
  /**
   * The announced campaign rate. The server derives the amount and the net
   * from it, so the two can never disagree on a stored record.
   */
  discount_percentage?: number | null;
}

export async function fetchXrayReceipts(params: Record<string, unknown> = {}): Promise<XrayReceiptApi[]> {
  const { data } = await api.get('/xray-receipts', { params });
  return Array.isArray(data) ? data : (data?.data ?? []);
}

export async function createXrayReceipt(payload: XrayReceiptPayload): Promise<XrayReceiptApi> {
  const { data } = await api.post('/xray-receipts', payload);
  return data;
}

export async function updateXrayReceipt(id: number, payload: XrayReceiptPayload): Promise<XrayReceiptApi> {
  const { data } = await api.put(`/xray-receipts/${id}`, payload);
  return data;
}

export async function deleteXrayReceipt(id: number): Promise<void> {
  await api.delete(`/xray-receipts/${id}`);
}

export async function payXrayReceipt(
  id: number,
  payload: { paid_amount: number; payment_method: string }
): Promise<XrayReceiptApi> {
  const { data } = await api.post(`/xray-receipts/${id}/payment`, payload);
  return data;
}

/** The backend requires a reason so the reversal stays auditable. */
export async function reverseXrayPayment(id: number, reason: string): Promise<XrayReceiptApi> {
  const { data } = await api.post(`/xray-receipts/${id}/reverse-payment`, { reason });
  return data?.data ?? data;
}

/**
 * One study in the hospital's X-Ray catalogue.
 *
 * Same shape as an ultrasound type minus the report template: X-Ray produces
 * a receipt, not a report. The price is what a new receipt's fee defaults to.
 */
export interface XrayTypeApi {
  id: number;
  hospital_id: number;
  name: string;
  code: string | null;
  description: string | null;
  price: number | string;
  sort_order: number;
  is_active: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface XrayTypePayload {
  hospital_id?: number | string;
  name: string;
  code?: string | null;
  description?: string | null;
  price?: number | null;
  sort_order?: number | null;
  is_active?: boolean;
}

export async function fetchXrayTypes(params: Record<string, unknown> = {}): Promise<XrayTypeApi[]> {
  const { data } = await api.get('/xray-types', { params });
  return Array.isArray(data) ? data : (data?.data ?? []);
}

export async function createXrayType(payload: XrayTypePayload): Promise<XrayTypeApi> {
  const { data } = await api.post('/xray-types', payload);
  return data;
}

export async function updateXrayType(id: number, payload: XrayTypePayload): Promise<XrayTypeApi> {
  const { data } = await api.put(`/xray-types/${id}`, payload);
  return data;
}

export async function deleteXrayType(id: number): Promise<void> {
  await api.delete(`/xray-types/${id}`);
}
