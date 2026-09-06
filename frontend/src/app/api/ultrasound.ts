import api from '../../api/axios';

export interface UltrasoundTypeApi {
  id: number;
  hospital_id: number;
  name: string;
  code: string | null;
  description: string | null;
  /** HTML report skeleton loaded into the editor when this type is selected. */
  default_template: string | null;
  price: number | string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface UltrasoundExamApi {
  id: number;
  hospital_id: number;
  sequence_id: number;
  patient_id: number;
  doctor_id: number | null;
  ultrasound_type_id: number;
  examined_at: string;
  referred_by: string | null;
  clinical_notes: string | null;
  report_body: string | null;
  impression: string | null;
  status: 'draft' | 'completed' | 'cancelled';
  /** Set at the reception counter, not by the reporting specialist. */
  payment_status: 'unpaid' | 'partial' | 'paid';
  fee: number | string;
  discount_enabled?: boolean;
  discount_percentage?: number | string | null;
  discount_amount?: number | string | null;
  net_amount?: number | string | null;
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
  doctor?: { id: number; name: string; specialization?: string; registration_number?: string } | null;
  ultrasound_type?: UltrasoundTypeApi | null;
}

export interface UltrasoundExamPayload {
  hospital_id?: number | string;
  patient_id: number | string;
  doctor_id?: number | string | null;
  ultrasound_type_id: number | string;
  examined_at: string;
  referred_by?: string | null;
  clinical_notes?: string | null;
  report_body?: string | null;
  impression?: string | null;
  status: 'draft' | 'completed' | 'cancelled';
  fee?: number | null;
}

export interface UltrasoundTypePayload {
  hospital_id?: number | string;
  name: string;
  code?: string | null;
  description?: string | null;
  default_template?: string | null;
  price?: number | null;
  sort_order?: number | null;
  is_active?: boolean;
}

/* ---------------------------------- Types --------------------------------- */

export async function listUltrasoundTypes(params: Record<string, any> = {}): Promise<UltrasoundTypeApi[]> {
  const { data } = await api.get('/ultrasound-types', { params });
  return data?.data ?? data;
}

export async function createUltrasoundType(payload: UltrasoundTypePayload): Promise<UltrasoundTypeApi> {
  const { data } = await api.post('/ultrasound-types', payload);
  return data?.data ?? data;
}

export async function updateUltrasoundType(id: number | string, payload: UltrasoundTypePayload): Promise<UltrasoundTypeApi> {
  const { data } = await api.put(`/ultrasound-types/${id}`, payload);
  return data?.data ?? data;
}

export async function deleteUltrasoundType(id: number | string): Promise<void> {
  await api.delete(`/ultrasound-types/${id}`);
}

/* ---------------------------------- Exams --------------------------------- */

export async function listUltrasoundExams(params: Record<string, any> = {}): Promise<UltrasoundExamApi[]> {
  const { data } = await api.get('/ultrasound-exams', { params });
  return data?.data ?? data;
}

export async function createUltrasoundExam(payload: UltrasoundExamPayload): Promise<UltrasoundExamApi> {
  const { data } = await api.post('/ultrasound-exams', payload);
  return data?.data ?? data;
}

export async function updateUltrasoundExam(id: number | string, payload: UltrasoundExamPayload): Promise<UltrasoundExamApi> {
  const { data } = await api.put(`/ultrasound-exams/${id}`, payload);
  return data?.data ?? data;
}

export async function deleteUltrasoundExam(id: number | string): Promise<void> {
  await api.delete(`/ultrasound-exams/${id}`);
}

export async function getUltrasoundReport(id: number | string) {
  const { data } = await api.get(`/ultrasound-exams/${id}/report`);
  return data?.data ?? data;
}

/* -------------------------------- Payments -------------------------------- */

/** Reception takes the fee; the exam becomes visible to the specialist. */
export async function payUltrasoundExam(
  id: number | string,
  payload: { paid_amount: number; payment_method: string }
): Promise<UltrasoundExamApi> {
  const { data } = await api.post(`/ultrasound-exams/${id}/payment`, payload);
  return data?.data ?? data;
}

/** Behind its own permission; the reason is recorded and required. */
export async function reverseUltrasoundPayment(
  id: number | string,
  reason: string
): Promise<UltrasoundExamApi> {
  const { data } = await api.post(`/ultrasound-exams/${id}/reverse-payment`, { reason });
  return data?.data ?? data;
}

export async function getUltrasoundReceipt(id: number | string): Promise<any> {
  const { data } = await api.get(`/ultrasound-exams/${id}/receipt`);
  return data?.data ?? data;
}
