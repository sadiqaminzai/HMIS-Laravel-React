import api from '../../api/axios';

/**
 * Dental is a cash desk built on a service catalogue: the clinical record
 * lives in the patient's chart, so a receipt carries the service performed,
 * the fee and the payment.
 */
export interface DentalServiceApi {
  id: number;
  hospital_id: number;
  /** English service name, e.g. "Root canal treatment". */
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

export interface DentalServicePayload {
  hospital_id?: number | string;
  name: string;
  code?: string | null;
  description?: string | null;
  price?: number | null;
  sort_order?: number | null;
  is_active?: boolean;
}

export interface DentalReceiptApi {
  id: number;
  hospital_id: number;
  sequence_id: number;
  patient_id: number;
  doctor_id: number | null;
  /** The catalogue entry billed, when one was chosen. */
  dental_service_id?: number | null;
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
  dental_service?: DentalServiceApi | null;
}

export interface DentalReceiptPayload {
  hospital_id?: number | string;
  patient_id: number | string;
  doctor_id?: number | string | null;
  dental_service_id?: number | string | null;
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

export async function fetchDentalServices(
  params: Record<string, unknown> = {}
): Promise<DentalServiceApi[]> {
  const { data } = await api.get('/dental-services', { params });
  return Array.isArray(data) ? data : (data?.data ?? []);
}

export async function createDentalService(
  payload: DentalServicePayload
): Promise<DentalServiceApi> {
  const { data } = await api.post('/dental-services', payload);
  return data;
}

export async function updateDentalService(
  id: number,
  payload: DentalServicePayload
): Promise<DentalServiceApi> {
  const { data } = await api.put(`/dental-services/${id}`, payload);
  return data;
}

export async function deleteDentalService(id: number): Promise<void> {
  await api.delete(`/dental-services/${id}`);
}

export async function fetchDentalReceipts(
  params: Record<string, unknown> = {}
): Promise<DentalReceiptApi[]> {
  const { data } = await api.get('/dental-receipts', { params });
  return Array.isArray(data) ? data : (data?.data ?? []);
}

export async function createDentalReceipt(
  payload: DentalReceiptPayload
): Promise<DentalReceiptApi> {
  const { data } = await api.post('/dental-receipts', payload);
  return data;
}

export async function updateDentalReceipt(
  id: number,
  payload: DentalReceiptPayload
): Promise<DentalReceiptApi> {
  const { data } = await api.put(`/dental-receipts/${id}`, payload);
  return data;
}

export async function deleteDentalReceipt(id: number): Promise<void> {
  await api.delete(`/dental-receipts/${id}`);
}

export async function payDentalReceipt(
  id: number,
  payload: { paid_amount: number; payment_method: string }
): Promise<DentalReceiptApi> {
  const { data } = await api.post(`/dental-receipts/${id}/payment`, payload);
  return data;
}

/** The backend requires a reason so the reversal stays auditable. */
export async function reverseDentalPayment(id: number, reason: string): Promise<DentalReceiptApi> {
  const { data } = await api.post(`/dental-receipts/${id}/reverse-payment`, { reason });
  return data?.data ?? data;
}
