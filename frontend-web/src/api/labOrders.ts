import api from './axios';

// Types for Lab Orders
export interface LabOrderResponse {
  id: number;
  hospital_id: number;
  order_number: string;
  verification_token?: string | null;
  patient_id: number | null;
  walk_in_patient_id: number | null;
  is_walk_in: boolean;
  patient_name: string;
  patient_age: number;
  patient_gender: 'male' | 'female' | 'other';
  doctor_id: number;
  doctor_name: string;
  total_amount: string;
  paid_amount: string;
  payment_status: 'unpaid' | 'partial' | 'paid';
  payment_method: string | null;
  paid_at: string | null;
  paid_by: string | null;
  receipt_number: string | null;
  status: 'pending' | 'sample_collected' | 'processing' | 'completed' | 'cancelled';
  priority: 'normal' | 'urgent' | 'stat';
  clinical_notes: string | null;
  assigned_to: number | null;
  assigned_to_name: string | null;
  sample_collected_at: string | null;
  completed_at: string | null;
  remarks: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  items: LabOrderItemResponse[];
  patient?: PatientResponse;
  doctor?: DoctorResponse;
}

export interface LabOrderItemResponse {
  id: number;
  lab_order_id: number;
  test_template_id: number;
  test_code: string;
  test_name: string;
  test_type: string;
  sample_type: string;
  price: string;
  status: 'pending' | 'processing' | 'completed';
  started_at: string | null;
  completed_at: string | null;
  completed_by: string | null;
  remarks: string | null;
  results: LabOrderResultResponse[];
}

export interface LabOrderResultResponse {
  id: number;
  lab_order_item_id: number;
  parameter_id: number | null;
  parameter_name: string;
  unit: string | null;
  normal_range: string | null;
  result_value: string | null;
  result_status: 'normal' | 'low' | 'high' | 'critical' | null;
  remarks: string | null;
  entered_by: string | null;
  entered_at: string | null;
}

export interface PatientResponse {
  id: number;
  name: string;
  age: number;
  gender: string;
  phone: string;
}

export interface DoctorResponse {
  id: number;
  name: string;
  specialization: string;
}

// Frontend types
export interface LabOrder {
  id: string;
  hospitalId: string;
  orderNumber: string;
  verificationToken?: string;
  patientId: string | null;
  walkInPatientId: string | null;
  isWalkIn: boolean;
  patientName: string;
  patientAge: number;
  patientGender: 'male' | 'female' | 'other';
  doctorId: string;
  doctorName: string;
  totalAmount: number;
  paidAmount: number;
  paymentStatus: 'unpaid' | 'partial' | 'paid';
  paymentMethod: string | null;
  paidAt: Date | null;
  paidBy: string | null;
  receiptNumber: string | null;
  status: 'pending' | 'sample_collected' | 'processing' | 'completed' | 'cancelled';
  priority: 'normal' | 'urgent' | 'stat';
  clinicalNotes: string | null;
  assignedTo: string | null;
  assignedToName: string | null;
  sampleCollectedAt: Date | null;
  completedAt: Date | null;
  remarks: string | null;
  createdBy: string | null;
  createdAt: Date;
  updatedAt: Date | null;
  items: LabOrderItem[];
}

export interface LabOrderItem {
  id: string;
  labOrderId: string;
  testTemplateId: string;
  testCode: string;
  testName: string;
  testType: string;
  sampleType: string;
  price: number;
  status: 'pending' | 'processing' | 'completed';
  startedAt: Date | null;
  completedAt: Date | null;
  completedBy: string | null;
  remarks: string | null;
  results: LabOrderResult[];
}

export interface LabOrderResult {
  id: string;
  labOrderItemId: string;
  parameterId: string | null;
  parameterName: string;
  unit: string | null;
  normalRange: string | null;
  resultValue: string | null;
  resultStatus: 'normal' | 'low' | 'high' | 'critical' | null;
  remarks: string | null;
  enteredBy: string | null;
  enteredAt: Date | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
}

// Transform functions
function transformResultToFrontend(r: LabOrderResultResponse): LabOrderResult {
  return {
    id: String(r.id),
    labOrderItemId: String(r.lab_order_item_id),
    parameterId: r.parameter_id ? String(r.parameter_id) : null,
    parameterName: r.parameter_name,
    unit: r.unit,
    normalRange: r.normal_range,
    resultValue: r.result_value,
    resultStatus: r.result_status,
    remarks: r.remarks,
    enteredBy: r.entered_by,
    enteredAt: r.entered_at ? new Date(r.entered_at) : null,
  };
}

function transformItemToFrontend(item: LabOrderItemResponse): LabOrderItem {
  return {
    id: String(item.id),
    labOrderId: String(item.lab_order_id),
    testTemplateId: String(item.test_template_id),
    testCode: item.test_code,
    testName: item.test_name,
    testType: item.test_type,
    sampleType: item.sample_type,
    price: parseFloat(item.price) || 0,
    status: item.status,
    startedAt: item.started_at ? new Date(item.started_at) : null,
    completedAt: item.completed_at ? new Date(item.completed_at) : null,
    completedBy: item.completed_by,
    remarks: item.remarks,
    results: (item.results || []).map(transformResultToFrontend),
  };
}

function transformToFrontend(order: LabOrderResponse): LabOrder {
  return {
    id: String(order.id),
    hospitalId: String(order.hospital_id),
    orderNumber: order.order_number,
    verificationToken: order.verification_token ?? undefined,
    patientId: order.patient_id ? String(order.patient_id) : null,
    walkInPatientId: order.walk_in_patient_id ? String(order.walk_in_patient_id) : null,
    isWalkIn: order.is_walk_in,
    patientName: order.patient_name,
    patientAge: order.patient_age,
    patientGender: order.patient_gender,
    doctorId: String(order.doctor_id),
    doctorName: order.doctor_name,
    totalAmount: parseFloat(order.total_amount) || 0,
    paidAmount: parseFloat(order.paid_amount) || 0,
    paymentStatus: order.payment_status,
    paymentMethod: order.payment_method,
    paidAt: order.paid_at ? new Date(order.paid_at) : null,
    paidBy: order.paid_by,
    receiptNumber: order.receipt_number,
    status: order.status,
    priority: order.priority,
    clinicalNotes: order.clinical_notes,
    assignedTo: order.assigned_to ? String(order.assigned_to) : null,
    assignedToName: order.assigned_to_name,
    sampleCollectedAt: order.sample_collected_at ? new Date(order.sample_collected_at) : null,
    completedAt: order.completed_at ? new Date(order.completed_at) : null,
    remarks: order.remarks,
    createdBy: order.created_by,
    createdAt: new Date(order.created_at),
    updatedAt: order.updated_at ? new Date(order.updated_at) : null,
    items: (order.items || []).map(transformItemToFrontend),
  };
}

// API Functions
export interface FetchLabOrdersParams {
  hospitalId?: string | number;
  status?: string;
  paymentStatus?: string;
  doctorId?: string | number;
  fromDate?: string;
  toDate?: string;
  search?: string;
  page?: number;
  perPage?: number;
}

export async function fetchLabOrders(
  params: FetchLabOrdersParams = {}
): Promise<{ data: LabOrder[]; total: number; lastPage: number }> {
  const queryParams: Record<string, string | number> = {
    page: params.page || 1,
    per_page: params.perPage || 25,
  };
  
  if (params.hospitalId) queryParams.hospital_id = params.hospitalId;
  if (params.status) queryParams.status = params.status;
  if (params.paymentStatus) queryParams.payment_status = params.paymentStatus;
  if (params.doctorId) queryParams.doctor_id = params.doctorId;
  if (params.fromDate) queryParams.from_date = params.fromDate;
  if (params.toDate) queryParams.to_date = params.toDate;
  if (params.search) queryParams.search = params.search;

  const response = await api.get<PaginatedResponse<LabOrderResponse>>('/lab-orders', {
    params: queryParams,
  });

  return {
    data: response.data.data.map(transformToFrontend),
    total: response.data.total,
    lastPage: response.data.last_page,
  };
}

export async function fetchLabOrder(id: string | number): Promise<LabOrder> {
  const response = await api.get<{ data: LabOrderResponse }>(`/lab-orders/${id}`);
  return transformToFrontend(response.data.data);
}

export interface CreateLabOrderPayload {
  hospitalId: string;
  patientId?: string;
  isWalkIn?: boolean;
  walkInPatient?: {
    name: string;
    age: number;
    gender: 'male' | 'female' | 'other';
    phone?: string;
  };
  doctorId: string;
  doctorName: string;
  testIds: string[];
  priority?: 'normal' | 'urgent' | 'stat';
  clinicalNotes?: string;
}

export async function createLabOrder(payload: CreateLabOrderPayload): Promise<LabOrder> {
  const response = await api.post<{ data: LabOrderResponse }>('/lab-orders', {
    hospital_id: Number(payload.hospitalId),
    patient_id: payload.patientId ? Number(payload.patientId) : null,
    is_walk_in: payload.isWalkIn || false,
    walk_in_patient: payload.walkInPatient,
    doctor_id: Number(payload.doctorId),
    doctor_name: payload.doctorName,
    test_ids: payload.testIds.map(Number),
    priority: payload.priority || 'normal',
    clinical_notes: payload.clinicalNotes || null,
  });
  return transformToFrontend(response.data.data);
}

export async function updateLabOrder(
  id: string | number,
  payload: { priority?: string; clinicalNotes?: string; remarks?: string; status?: string }
): Promise<LabOrder> {
  const response = await api.put<{ data: LabOrderResponse }>(`/lab-orders/${id}`, {
    priority: payload.priority,
    clinical_notes: payload.clinicalNotes,
    remarks: payload.remarks,
    status: payload.status,
  });
  return transformToFrontend(response.data.data);
}

export async function processPayment(
  id: string | number,
  paidAmount: number,
  paymentMethod: string
): Promise<LabOrder> {
  const response = await api.post<{ data: LabOrderResponse }>(`/lab-orders/${id}/payment`, {
    paid_amount: paidAmount,
    payment_method: paymentMethod,
  });
  return transformToFrontend(response.data.data);
}

export async function resetLabOrderPayment(
  id: string | number,
  reason?: string
): Promise<LabOrder> {
  const response = await api.post<{ data: LabOrderResponse }>(`/lab-orders/${id}/reset-payment`, {
    reason,
  });
  return transformToFrontend(response.data.data);
}

export async function collectSample(id: string | number): Promise<LabOrder> {
  const response = await api.post<{ data: LabOrderResponse }>(`/lab-orders/${id}/collect-sample`);
  return transformToFrontend(response.data.data);
}

export interface ResultEntry {
  resultId: string;
  resultValue: string;
  remarks?: string;
}

export async function enterResults(
  itemId: string | number,
  results: ResultEntry[]
): Promise<LabOrderItem> {
  const response = await api.post<{ data: LabOrderItemResponse }>(
    `/lab-order-items/${itemId}/results`,
    {
      results: results.map((r) => ({
        result_id: Number(r.resultId),
        result_value: r.resultValue,
        remarks: r.remarks || null,
      })),
    }
  );
  return transformItemToFrontend(response.data.data);
}

export async function cancelLabOrder(id: string | number, reason?: string): Promise<LabOrder> {
  const response = await api.post<{ data: LabOrderResponse }>(`/lab-orders/${id}/cancel`, {
    reason,
  });
  return transformToFrontend(response.data.data);
}

export async function deleteLabOrder(id: string | number): Promise<void> {
  await api.delete(`/lab-orders/${id}`);
}

export async function getReceipt(
  id: string | number
): Promise<{ order: LabOrder; hospital: any }> {
  const response = await api.get<{ data: { order: LabOrderResponse; hospital: any } }>(
    `/lab-orders/${id}/receipt`
  );
  return {
    order: transformToFrontend(response.data.data.order),
    hospital: response.data.data.hospital,
  };
}

export async function getReport(
  id: string | number
): Promise<{ order: LabOrder; hospital: any }> {
  const response = await api.get<{ data: { order: LabOrderResponse; hospital: any } }>(
    `/lab-orders/${id}/report`
  );
  return {
    order: transformToFrontend(response.data.data.order),
    hospital: response.data.data.hospital,
  };
}
