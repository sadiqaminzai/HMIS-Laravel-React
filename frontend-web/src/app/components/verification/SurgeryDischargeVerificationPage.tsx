import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../../api/axios';
import { DischargeSummaryPrint } from '../DischargeSummaryPrint';
import { Doctor, Hospital, Patient } from '../../types';

const resolveAssetUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace('/api', '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const withStorage = normalized.startsWith('/storage/') ? normalized : `/storage${normalized}`;
  return `${base}${withStorage}`;
};

interface VerificationResponse {
  patient_surgery: any;
  hospital: any;
  patient?: any | null;
  doctor?: any | null;
  surgery?: any | null;
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
  logo: resolveAssetUrl(h.logo_url ?? h.logo_path ?? ''),
  brandColor: h.brand_color ?? '#2563eb',
  createdAt: h.created_at ? new Date(h.created_at) : undefined,
});

const mapDoctor = (d: any | null, fallback: any, hospitalId: string): Doctor => ({
  id: String(d?.id ?? fallback?.doctor_id ?? ''),
  hospitalId: String(d?.hospital_id ?? hospitalId),
  name: d?.name ?? fallback?.doctor?.name ?? 'Doctor',
  specialization: d?.specialization ?? 'General',
  registrationNumber: d?.registration_number ?? '',
  consultationFee: Number(d?.consultation_fee ?? 0),
  email: d?.email ?? '',
  phone: d?.phone ?? '',
  status: (d?.status ?? 'active') as Doctor['status'],
  image: d?.image_url ?? d?.image_path ?? '',
  signature: d?.signature_url ?? d?.signature_path ?? '',
  availability: d?.availability_schedule ?? [],
  createdBy: d?.created_by ?? 'system',
  updatedBy: d?.updated_by ?? undefined,
  createdAt: d?.created_at ? new Date(d.created_at) : undefined,
  updatedAt: d?.updated_at ? new Date(d.updated_at) : undefined,
});

const mapPatient = (p: any | null, fallback: any, hospitalId: string): Patient => ({
  id: String(p?.id ?? fallback?.patient_id ?? ''),
  hospitalId: String(p?.hospital_id ?? hospitalId),
  patientId: p?.patient_id ?? fallback?.patient_id ?? '',
  name: p?.name ?? fallback?.patient?.name ?? 'Patient',
  age: Number(p?.age ?? 0),
  gender: (p?.gender ?? 'other') as Patient['gender'],
  phone: p?.phone ?? '',
  address: p?.address ?? '',
  status: (p?.status ?? 'active') as Patient['status'],
  image: p?.image_url ?? p?.image_path ?? '',
  createdAt: p?.created_at ? new Date(p.created_at) : new Date(),
  updatedAt: p?.updated_at ? new Date(p.updated_at) : undefined,
  verificationToken: p?.verification_token ?? undefined,
});

export function SurgeryDischargeVerificationPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<VerificationResponse | null>(null);

  useEffect(() => {
    if (!token) return;

    setLoading(true);
    setError(null);

    api
      .get(`/verify/surgery-discharges/${token}`)
      .then((res) => {
        const data = res.data?.data ?? res.data;
        setPayload(data);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Unable to verify this surgery discharge summary.');
      })
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-sm text-slate-600 shadow-sm">Loading verification...</div>
      </div>
    );
  }

  if (error || !payload) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
        <div className="max-w-md rounded-2xl border border-red-200 bg-white px-5 py-4 text-sm text-red-700 shadow-sm">
          {error || 'Verification not found.'}
        </div>
      </div>
    );
  }

  const hospital = mapHospital(payload.hospital);
  const patient = mapPatient(payload.patient ?? null, payload.patient_surgery, hospital.id);
  const doctor = mapDoctor(payload.doctor ?? null, payload.patient_surgery, hospital.id);

  const surgeryItem = {
    id: String(payload.patient_surgery?.id ?? ''),
    hospitalId: String(payload.patient_surgery?.hospital_id ?? hospital.id),
    patientId: String(payload.patient_surgery?.patient_id ?? patient.id),
    patientName: patient.name,
    doctorId: payload.patient_surgery?.doctor_id ? String(payload.patient_surgery.doctor_id) : undefined,
    doctorName: payload.patient_surgery?.doctor?.name ?? doctor.name,
    surgeryId: String(payload.patient_surgery?.surgery_id ?? ''),
    surgeryName: payload.patient_surgery?.surgery?.name ?? payload.surgery?.name ?? 'Surgery',
    surgeryDate: String(payload.patient_surgery?.surgery_date ?? ''),
    status: payload.patient_surgery?.status ?? 'completed',
    paymentStatus: payload.patient_surgery?.payment_status ?? 'pending',
    cost: Number(payload.patient_surgery?.cost ?? 0),
    notes: payload.patient_surgery?.notes ?? undefined,
    dischargeDate: payload.patient_surgery?.discharge_date ? String(payload.patient_surgery.discharge_date).slice(0, 10) : undefined,
    dischargeSummary: payload.patient_surgery?.discharge_summary ?? undefined,
    dischargeCreatedBy: payload.patient_surgery?.discharge_created_by ?? undefined,
    dischargeCompletedBy: payload.patient_surgery?.discharge_completed_by ?? undefined,
    verificationToken: payload.patient_surgery?.verification_token ?? token,
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_12%_15%,_#dbeafe_0,_#f8fafc_45%,_#f1f5f9_100%)] py-4 sm:py-6">
      <div className="mx-auto mb-3 w-full max-w-6xl px-4">
        <div className="rounded-xl border border-slate-200 bg-white/85 px-4 py-2 text-xs font-medium text-slate-600 shadow-sm backdrop-blur">
          Verified surgery discharge summary from {hospital.name}
        </div>
      </div>
      <DischargeSummaryPrint
        hospital={hospital}
        patient={patient}
        doctor={doctor}
        surgeryItem={surgeryItem}
        printedBy="Verification Portal"
        embedded
      />
    </div>
  );
}
