import api from '../../api/axios';

export interface LabOrderApi {
  id: number;
  hospital_id: number;
  order_number: string;
  patient_id: number | null;
  walk_in_patient_id?: number | null;
  is_walk_in?: boolean;
  patient_name: string;
  patient_age: number;
  patient_gender: string;
  doctor_id: number;
  doctor_name: string;
  priority: 'normal' | 'urgent' | 'stat';
  clinical_notes?: string | null;
  status: 'pending' | 'sample_collected' | 'processing' | 'completed' | 'cancelled';
  payment_status: 'unpaid' | 'partial' | 'paid';
  total_amount?: number;
  paid_amount?: number;
  sample_collected_at?: string | null;
  completed_at?: string | null;
  created_at: string;
  updated_at?: string;
  items: LabOrderItemApi[];
}

export interface LabOrderItemApi {
  id: number;
  lab_order_id: number;
  test_template_id: number | string;
  test_code: string;
  test_name: string;
  test_type: string;
  sample_type?: string;
  price?: number;
  status: string;
  results: LabOrderResultApi[];
}

export interface LabOrderResultApi {
  id: number;
  lab_order_item_id: number;
  parameter_id: number | null;
  parameter_name: string;
  unit: string | null;
  normal_range: string | null;
  result_value?: string | null;
  result_status?: string | null;
  remarks?: string | null;
}

export interface CreateLabOrderPayload {
  hospital_id: number | string;
  patient_id?: number | string | null;
  is_walk_in?: boolean;
  walk_in_patient?: {
    name: string;
    age: number;
    gender: string;
    phone?: string;
  };
  doctor_id: number | string;
  doctor_name: string;
  test_ids: Array<number | string>;
  priority?: 'normal' | 'urgent' | 'stat';
  clinical_notes?: string;
}

export interface PaymentPayload {
  paid_amount: number;
  payment_method: string;
}

export async function listLabOrders(params: Record<string, any>) {
  const { data } = await api.get('/lab-orders', { params });
  return data;
}

export async function createLabOrder(payload: CreateLabOrderPayload) {
  const { data } = await api.post('/lab-orders', payload);
  return data?.data ?? data;
}

export async function payLabOrder(orderId: number | string, payload: PaymentPayload) {
  const { data } = await api.post(`/lab-orders/${orderId}/payment`, payload);
  return data?.data ?? data;
}

export async function collectSample(orderId: number | string) {
  const { data } = await api.post(`/lab-orders/${orderId}/collect-sample`);
  return data?.data ?? data;
}

export async function cancelLabOrder(orderId: number | string, reason?: string) {
  const { data } = await api.post(`/lab-orders/${orderId}/cancel`, { reason });
  return data?.data ?? data;
}

export async function deleteLabOrder(orderId: number | string) {
  await api.delete(`/lab-orders/${orderId}`);
}

export async function enterResults(itemId: number | string, results: Array<{ result_id: number; result_value: string; remarks?: string }>) {
  const { data } = await api.post(`/lab-order-items/${itemId}/results`, { results });
  return data?.data ?? data;
}

export async function getReceipt(orderId: number | string) {
  const { data } = await api.get(`/lab-orders/${orderId}/receipt`);
  return data?.data ?? data;
}

export async function getReport(orderId: number | string) {
  const { data } = await api.get(`/lab-orders/${orderId}/report`);
  return data?.data ?? data;
}
