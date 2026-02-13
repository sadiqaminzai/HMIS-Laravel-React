import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../../api/axios';
import { PrescriptionPrint } from '../PrescriptionPrint';
import { Doctor, Hospital, Patient, PrescriptionMedicine } from '../../types';

const resolveLogoUrl = (path?: string | null): string => {
  if (!path) return '';
  if (path.startsWith('http')) return path;
  const base = (import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api').replace('/api', '');
  const normalized = path.startsWith('/') ? path : `/${path}`;
  const withStorage = normalized.startsWith('/storage/') ? normalized : `/storage${normalized}`;
  return `${base}${withStorage}`;
};

interface VerificationResponse {
  prescription: any;
  hospital: any;
  patient: any | null;
  doctor: any | null;
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
  logo: resolveLogoUrl(h.logo_url ?? h.logo_path ?? ''),
  brandColor: h.brand_color ?? '#2563eb',
  createdAt: h.created_at ? new Date(h.created_at) : undefined,
});

const mapDoctor = (d: any, fallback: any, hospitalId: string): Doctor => ({
  id: String(d?.id ?? fallback?.doctor_id ?? ''),
  hospitalId: String(d?.hospital_id ?? hospitalId),
  name: d?.name ?? fallback?.doctor_name ?? 'Doctor',
  specialization: d?.specialization ?? 'General',
  registrationNumber: d?.registration_number ?? '',
  phone: d?.phone ?? '',
  email: d?.email ?? '',
  status: (d?.status ?? 'active') as Doctor['status'],
  image: d?.image_url ?? d?.image_path ?? undefined,
  signature: d?.signature_url ?? d?.signature_path ?? undefined,
  availability: d?.availability_schedule ?? undefined,
  consultationFee: Number(d?.consultation_fee ?? 0),
  createdAt: d?.created_at ? new Date(d.created_at) : undefined,
  updatedAt: d?.updated_at ? new Date(d.updated_at) : undefined,
});

const mapPatient = (p: any | null, snapshot: any, hospitalId: string): Patient => {
  if (p) {
    return {
      id: String(p.id),
      hospitalId: String(p.hospital_id ?? hospitalId),
      patientId: p.patient_id ?? '',
      name: p.name ?? snapshot?.name ?? 'Patient',
      age: Number(p.age ?? snapshot?.age ?? 0),
      gender: (p.gender ?? snapshot?.gender ?? 'other') as Patient['gender'],
      phone: p.phone ?? '',
      address: p.address ?? '',
      status: (p.status ?? 'active') as Patient['status'],
      image: p.image_url ?? p.image_path ?? '',
      createdAt: p.created_at ? new Date(p.created_at) : new Date(),
      updatedAt: p.updated_at ? new Date(p.updated_at) : undefined,
      verificationToken: p.verification_token ?? undefined,
    };
  }

  const fallbackId = snapshot?.patient_id || snapshot?.walk_in_patient_id || 'WALKIN';
  return {
    id: String(fallbackId),
    hospitalId,
    patientId: String(fallbackId),
    name: snapshot?.name ?? 'Walk-in Patient',
    age: Number(snapshot?.age ?? 0),
    gender: (snapshot?.gender ?? 'other') as Patient['gender'],
    phone: '',
    address: '',
    status: 'active',
    image: '',
    createdAt: new Date(),
  };
};

export function PrescriptionVerificationPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<VerificationResponse | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);

    api
      .get(`/verify/prescriptions/${token}`)
      .then((res) => {
        const data = res.data?.data ?? res.data;
        setPayload(data);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Unable to verify this prescription.');
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
  const patient = mapPatient(payload.patient, payload.patient_snapshot, hospital.id);
  const doctor = mapDoctor(payload.doctor, payload.prescription, hospital.id);

  const medicines: PrescriptionMedicine[] = (payload.prescription?.items ?? []).map((item: any) => ({
    medicineId: item.medicine_id ? String(item.medicine_id) : '',
    medicineName: item.medicine_name,
    strength: item.strength ?? '',
    dose: item.dose ?? '',
    duration: item.duration ?? '',
    instruction: item.instruction ?? 'after_meal',
    quantity: Number(item.quantity ?? 0),
    type: item.type ?? '',
  }));

  return (
    <PrescriptionPrint
      hospital={hospital}
      patient={patient}
      doctor={doctor}
      medicines={medicines}
      advice={payload.prescription?.advice ?? ''}
      prescriptionNumber={payload.prescription?.prescription_number ?? ''}
      diagnosis={payload.prescription?.diagnosis ?? ''}
      prescriptionDate={payload.prescription?.created_at ? new Date(payload.prescription.created_at) : new Date()}
      verificationToken={payload.prescription?.verification_token ?? token}
      embedded
      viewOnly
      onClose={() => window.history.back()}
    />
  );
}
