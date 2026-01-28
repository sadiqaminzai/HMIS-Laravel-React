import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Users } from 'lucide-react';
import api from '../../../api/axios';
import { Hospital, Patient } from '../../types';
import { QRCodeSVG } from 'qrcode.react';
import { buildVerificationUrl } from '../../utils/verification';

interface VerificationResponse {
  patient: any;
  hospital: any;
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

const mapPatient = (p: any, hospitalId: string): Patient => ({
  id: String(p.id),
  hospitalId,
  patientId: p.patient_id ?? '',
  name: p.name ?? 'Patient',
  age: Number(p.age ?? 0),
  gender: (p.gender ?? 'other') as Patient['gender'],
  phone: p.phone ?? '',
  address: p.address ?? '',
  status: (p.status ?? 'active') as Patient['status'],
  image: p.image_url ?? p.image_path ?? '',
  createdAt: p.created_at ? new Date(p.created_at) : new Date(),
  updatedAt: p.updated_at ? new Date(p.updated_at) : undefined,
  verificationToken: p.verification_token ?? undefined,
});

export function PatientCardVerificationPage() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [payload, setPayload] = useState<VerificationResponse | null>(null);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    setError(null);

    api
      .get(`/verify/patients/${token}`)
      .then((res) => {
        const data = res.data?.data ?? res.data;
        setPayload(data);
      })
      .catch((err) => {
        setError(err?.response?.data?.message || 'Unable to verify this patient card.');
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
  const patient = mapPatient(payload.patient, hospital.id);
  const qrValue = buildVerificationUrl('patient', patient.verificationToken || token) || patient.patientId;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center text-sm text-gray-600 mb-4">Verified Patient Card</div>
        <div className="w-[85.6mm] h-[53.98mm] bg-white rounded-xl shadow-lg overflow-hidden relative border border-gray-200 flex flex-col mx-auto">
          <div className="h-10 flex items-center justify-between px-3" style={{ backgroundColor: hospital.brandColor || '#2563eb' }}>
            <div className="text-white font-bold text-xs tracking-wide">{hospital.name}</div>
            <div className="text-[8px] text-white/80 uppercase tracking-widest">Patient Card</div>
          </div>

          <div className="flex-1 p-3 flex gap-3 relative z-10">
            <div className="w-20 h-24 bg-gray-100 rounded-md border border-gray-200 overflow-hidden flex-shrink-0 self-center">
              {patient.image ? (
                <img src={patient.image} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-gray-100 text-gray-400">
                  <Users className="w-8 h-8" />
                </div>
              )}
            </div>

            <div className="flex-1 space-y-1 pt-1">
              <div>
                <div className="text-[8px] text-gray-400 uppercase tracking-wider font-semibold">Name</div>
                <div className="text-sm font-bold text-gray-900 leading-tight">{patient.name}</div>
              </div>
              <div className="grid grid-cols-2 gap-1 mt-1">
                <div>
                  <div className="text-[7px] text-gray-400 uppercase tracking-wider font-semibold">ID No.</div>
                  <div className="text-xs font-mono font-bold" style={{ color: hospital.brandColor || '#2563eb' }}>{patient.patientId}</div>
                </div>
                <div>
                  <div className="text-[7px] text-gray-400 uppercase tracking-wider font-semibold">Gender/Age</div>
                  <div className="text-xs font-medium text-gray-700">{patient.gender.charAt(0)} / {patient.age}</div>
                </div>
              </div>
              <div className="mt-1.5">
                <div className="text-[7px] text-gray-400 uppercase tracking-wider font-semibold">Emergency Contact</div>
                <div className="text-[10px] font-medium text-gray-700">{patient.phone || '-'}</div>
              </div>
            </div>
          </div>

          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gray-50 border-t border-gray-100 flex items-center justify-between px-3">
            <div className="text-[6px] text-gray-400 leading-tight max-w-[60%]">{hospital.address}</div>
            <div className="opacity-80">
              <QRCodeSVG value={qrValue} size={32} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
