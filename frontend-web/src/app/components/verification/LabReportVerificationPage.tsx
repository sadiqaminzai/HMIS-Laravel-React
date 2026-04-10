import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../../api/axios';
import { Hospital, LabTest, TestResult } from '../../types';
import { LabReportTemplate } from '../LabReportTemplate';

interface VerificationResponse {
  lab_order: any;
  hospital: any;
  patient?: any | null;
  doctor?: any | null;
  patient_snapshot?: {
    patient_id?: string | number | null;
    walk_in_patient_id?: string | number | null;
    name?: string | null;
    age?: number | null;
    gender?: string | null;
  };
}

const mapHospital = (h: any): Hospital => ({
  id: String(h.id),
  name: h.name,
  code: h.code ?? h.slug ?? '',
  address: h.address ?? '',
  phone: h.phone ?? '',
  email: h.email ?? '',
  license: h.license ?? '',
  licenseIssueDate: h.license_issue_date ?? '',
  licenseExpiryDate: h.license_expiry_date ?? '',
  status: (h.status ?? 'active') as Hospital['status'],
  logo: h.logo_url ?? h.logo_path ?? '',
  brandColor: h.brand_color ?? '#2563eb',
  createdAt: h.created_at ? new Date(h.created_at) : undefined,
});

const mapOrderStatus = (orderStatus: string, paymentStatus?: string): LabTest['status'] => {
  if (paymentStatus !== 'paid') return 'unpaid';
  if (orderStatus === 'completed') return 'completed';
  if (orderStatus === 'processing' || orderStatus === 'sample_collected') return 'in_progress';
  if (orderStatus === 'cancelled') return 'cancelled';
  return 'pending';
};

const mapLabOrderToLabTest = (order: any, snapshot: any): LabTest => {
  const testResults: TestResult[] = [];
  const testNames: string[] = [];
  const testTypes: string[] = [];
  const selectedTests: string[] = [];

  (order.items ?? []).forEach((item: any) => {
    selectedTests.push(String(item.test_template_id ?? item.testTemplateId ?? ''));
    if (item.test_name && !testNames.includes(item.test_name)) testNames.push(item.test_name);
    if (item.test_type && !testTypes.includes(item.test_type)) testTypes.push(item.test_type);

    (item.results ?? []).forEach((result: any) => {
      testResults.push({
        resultId: result.id,
        labOrderItemId: item.id,
        testTemplateId: item.test_template_id ?? item.testTemplateId ?? '',
        testName: item.test_name ?? '',
        parameterName: result.parameter_name ?? result.parameterName ?? '',
        unit: result.unit ?? '',
        normalRange: result.normal_range ?? result.normalRange ?? '',
        result: result.result_value ?? result.resultValue ?? '',
        remarks: result.remarks ?? '',
      });
    });
  });

  const fallbackPatientId = snapshot?.patient_id || snapshot?.walk_in_patient_id || '';
  const patientDisplayId =
    order?.patient_display_id ||
    order?.patient?.patient_id ||
    snapshot?.patient_id ||
    snapshot?.walk_in_patient_id ||
    '';

  return {
    id: String(order.id),
    hospitalId: String(order.hospital_id),
    testNumber: order.order_number,
    patientId: order.patient_id ? String(order.patient_id) : String(fallbackPatientId || ''),
    patientDisplayId: String(patientDisplayId || ''),
    patientName: order.patient_name ?? snapshot?.name ?? 'Patient',
    patientAge: Number(order.patient_age ?? snapshot?.age ?? 0),
    patientGender: order.patient_gender ?? snapshot?.gender ?? 'other',
    doctorId: String(order.doctor_id ?? ''),
    doctorName: order.doctor_name ?? 'Doctor',
    selectedTests,
    testName: testNames.join(', '),
    testType: testTypes.join(', '),
    instructions: order.clinical_notes || undefined,
    status: mapOrderStatus(order.status, order.payment_status),
    paymentStatus: order.payment_status ?? undefined,
    priority: order.priority ?? 'normal',
    sampleCollectedAt: order.sample_collected_at ? new Date(order.sample_collected_at) : undefined,
    reportedAt: order.completed_at ? new Date(order.completed_at) : undefined,
    testResults,
    remarks: order.remarks || undefined,
    assignedTo: order.assigned_to ? String(order.assigned_to) : undefined,
    assignedToName: order.assigned_to_name || undefined,
    totalAmount: order.total_amount ? Number(order.total_amount) : undefined,
    paidAmount: order.paid_amount ? Number(order.paid_amount) : undefined,
    orderItems: undefined,
    createdAt: order.created_at ? new Date(order.created_at) : new Date(),
    createdBy: order.created_by || 'system',
    updatedAt: order.updated_at ? new Date(order.updated_at) : undefined,
    updatedBy: order.updated_by || undefined,
    verificationToken: order.verification_token ?? undefined,
  };
};

export function LabReportVerificationPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<VerificationResponse | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);

    api
      .get(`/verify/lab-reports/${token}`)
      .then((res) => {
        const data = res.data?.data ?? res.data;
        setPayload(data);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Unable to verify this lab report.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-600">Loading verification...</div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-sm text-gray-600">{error || 'Verification not found.'}</div>
      </div>
    );
  }

  const hospital = mapHospital(payload.hospital);
  const test = mapLabOrderToLabTest(payload.lab_order, payload.patient_snapshot);

  return (
    <div className="min-h-screen bg-gray-50 py-6 px-4">
      <LabReportTemplate test={test} hospital={hospital} />
    </div>
  );
}
