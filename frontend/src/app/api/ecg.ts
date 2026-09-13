import api from '../../api/axios';

/**
 * ECG is a cash desk built on a service catalogue: the clinical record
 * lives in the patient's chart, so a receipt carries the service performed,
 * the fee and the payment.
 */
export interface EcgServiceApi {
  id: number;
  hospital_id: number;
  /** English service name, e.g. "Resting 12-lead ECG". */
  name: string;
  code: string | null;
  /** The hospital's own wording, typically Pashto, plus any pricing note. */
  description: string | null;
  price: number | string;
  sort_order: number;
  is_active: boolean;
  created_by?: string | null;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface EcgServicePayload {
  hospital_id?: number | string;
  name: string;
  code?: string | null;
  description?: string | null;
  price?: number | null;
  sort_order?: number | null;
  is_active?: boolean;
}

export interface EcgReceiptApi {
  id: number;
  hospital_id: number;
  sequence_id: number;
  patient_id: number;
  doctor_id: number | null;
  /** The catalogue entry billed, when one was chosen. */
  ecg_service_id?: number | null;
  /** The printed label, copied at billing time so a rename cannot alter history. */
  service_name: string;
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
  patient?: {
    id: number;
    name: string;
    age?: number;
    gender?: string;
    phone?: string;
    patient_id?: string;
  } | null;
  doctor?: { id: number; name: string; specialization?: string } | null;
  ecg_service?: EcgServiceApi | null;
}

export interface EcgReceiptPayload {
  hospital_id?: number | string;
  patient_id: number | string;
  doctor_id?: number | string | null;
  ecg_service_id?: number | string | null;
  service_name: string;
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

export async function fetchEcgServices(
  params: Record<string, unknown> = {}
): Promise<EcgServiceApi[]> {
  const { data } = await api.get('/ecg-services', { params });
  return Array.isArray(data) ? data : (data?.data ?? []);
}

export async function createEcgService(
  payload: EcgServicePayload
): Promise<EcgServiceApi> {
  const { data } = await api.post('/ecg-services', payload);
  return data;
}

export async function updateEcgService(
  id: number,
  payload: EcgServicePayload
): Promise<EcgServiceApi> {
  const { data } = await api.put(`/ecg-services/${id}`, payload);
  return data;
}

export async function deleteEcgService(id: number): Promise<void> {
  await api.delete(`/ecg-services/${id}`);
}

export async function fetchEcgReceipts(
  params: Record<string, unknown> = {}
): Promise<EcgReceiptApi[]> {
  const { data } = await api.get('/ecg-receipts', { params });
  return Array.isArray(data) ? data : (data?.data ?? []);
}

export async function createEcgReceipt(
  payload: EcgReceiptPayload
): Promise<EcgReceiptApi> {
  const { data } = await api.post('/ecg-receipts', payload);
  return data;
}

export async function updateEcgReceipt(
  id: number,
  payload: EcgReceiptPayload
): Promise<EcgReceiptApi> {
  const { data } = await api.put(`/ecg-receipts/${id}`, payload);
  return data;
}

export async function deleteEcgReceipt(id: number): Promise<void> {
  await api.delete(`/ecg-receipts/${id}`);
}

export async function payEcgReceipt(
  id: number,
  payload: { paid_amount: number; payment_method: string }
): Promise<EcgReceiptApi> {
  const { data } = await api.post(`/ecg-receipts/${id}/payment`, payload);
  return data;
}

/** The backend requires a reason so the reversal stays auditable. */
export async function reverseEcgPayment(id: number, reason: string): Promise<EcgReceiptApi> {
  const { data } = await api.post(`/ecg-receipts/${id}/reverse-payment`, { reason });
  return data?.data ?? data;
}
