import api from './axios';

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

export async function listSurgeryTypes(params?: Record<string, any>) {
  const res = await api.get('/surgery-types', { params });
  return unwrap<any>(res);
}

export async function createSurgeryType(payload: any) {
  const res = await api.post('/surgery-types', payload);
  return res.data;
}

export async function updateSurgeryType(id: string, payload: any) {
  const res = await api.put(`/surgery-types/${id}`, payload);
  return res.data;
}

export async function deleteSurgeryType(id: string) {
  const res = await api.delete(`/surgery-types/${id}`);
  return res.data;
}

export async function listSurgeries(params?: Record<string, any>) {
  const res = await api.get('/surgeries', { params });
  return unwrap<any>(res);
}

export async function createSurgery(payload: any) {
  const res = await api.post('/surgeries', payload);
  return res.data;
}

export async function updateSurgery(id: string, payload: any) {
  const res = await api.put(`/surgeries/${id}`, payload);
  return res.data;
}

export async function deleteSurgery(id: string) {
  const res = await api.delete(`/surgeries/${id}`);
  return res.data;
}

export async function listPatientSurgeries(params?: Record<string, any>) {
  const res = await api.get('/patient-surgeries', { params });
  return unwrap<any>(res);
}

export async function createPatientSurgery(payload: any) {
  const res = await api.post('/patient-surgeries', payload);
  return res.data;
}

export async function updatePatientSurgery(id: string, payload: any) {
  const res = await api.put(`/patient-surgeries/${id}`, payload);
  return res.data;
}

export async function deletePatientSurgery(id: string) {
  const res = await api.delete(`/patient-surgeries/${id}`);
  return res.data;
}

export async function togglePatientSurgeryPaymentStatus(id: string) {
  const res = await api.post(`/patient-surgeries/${id}/toggle-payment-status`);
  return res.data;
}
