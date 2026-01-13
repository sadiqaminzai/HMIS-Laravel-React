import React, { createContext, useContext, useEffect, useState } from 'react';
import { Doctor } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface DoctorContextType {
  doctors: Doctor[];
  refresh: () => Promise<void>;
  addDoctor: (doctor: Partial<Doctor> & { imageFile?: File | null; signatureFile?: File | null }) => Promise<void>;
  updateDoctor: (doctor: Partial<Doctor> & { id: string; imageFile?: File | null; signatureFile?: File | null }) => Promise<void>;
  deleteDoctor: (id: string) => Promise<void>;
  loading: boolean;
}

const DoctorContext = createContext<DoctorContextType | undefined>(undefined);

const mapDoctor = (d: any): Doctor => ({
  id: String(d.id),
  hospitalId: String(d.hospital_id),
  name: d.name,
  specialization: d.specialization,
  registrationNumber: d.registration_number ?? '',
  consultationFee: Number(d.consultation_fee ?? 0),
  email: d.email ?? '',
  phone: d.phone ?? '',
  status: (d.status ?? 'active') as Doctor['status'],
  image: d.image_url ?? d.image_path ?? '',
  signature: d.signature_url ?? d.signature_path ?? '',
  availability: d.availability_schedule ?? [],
});

export function DoctorProvider({ children }: { children: React.ReactNode }) {
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission } = useAuth();

  const refresh = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      setDoctors([]);
      return;
    }

    // Backend: /doctors is guarded by permission:view_doctors OR manage_doctors
    if (!hasPermission('view_doctors') && !hasPermission('manage_doctors')) {
      setDoctors([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/doctors');
      const records: any[] = data.data ?? data;
      setDoctors(records.map(mapDoctor));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load doctors');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setDoctors([]);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  const buildFormData = (payload: any) => {
    const formData = new FormData();
    if (payload.hospitalId) formData.append('hospital_id', payload.hospitalId);
    if (payload.name) formData.append('name', payload.name);
    if (payload.email) formData.append('email', payload.email);
    if (payload.phone) formData.append('phone', payload.phone);
    if (payload.specialization) formData.append('specialization', payload.specialization);
    if (payload.registrationNumber) formData.append('registration_number', payload.registrationNumber);
    if (payload.consultationFee !== undefined && payload.consultationFee !== null) formData.append('consultation_fee', String(payload.consultationFee));
    if (payload.status) formData.append('status', payload.status);
    if (Array.isArray(payload.availability)) {
      payload.availability.forEach((slot: any, index: number) => {
        formData.append(`availability_schedule[${index}][day]`, slot.day);
        formData.append(`availability_schedule[${index}][startTime]`, slot.startTime);
        formData.append(`availability_schedule[${index}][endTime]`, slot.endTime);
        formData.append(`availability_schedule[${index}][isAvailable]`, String(slot.isAvailable ? 1 : 0));
      });
    }
    if (payload.imageFile) formData.append('image', payload.imageFile);
    if (payload.signatureFile) formData.append('signature', payload.signatureFile);
    return formData;
  };

  const addDoctor = async (payload: Partial<Doctor> & { imageFile?: File | null; signatureFile?: File | null }) => {
    const formData = buildFormData(payload);
    await api.post('/doctors', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    await refresh();
  };

  const updateDoctor = async (payload: Partial<Doctor> & { id: string; imageFile?: File | null; signatureFile?: File | null }) => {
    const formData = buildFormData(payload);
    await api.post(`/doctors/${payload.id}?_method=PUT`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    await refresh();
  };

  const deleteDoctor = async (id: string) => {
    await api.delete(`/doctors/${id}`);
    await refresh();
  };

  return (
    <DoctorContext.Provider value={{ doctors, refresh, addDoctor, updateDoctor, deleteDoctor, loading }}>
      {children}
    </DoctorContext.Provider>
  );
}

export function useDoctors() {
  const context = useContext(DoctorContext);
  if (!context) {
    console.warn('useDoctors called outside DoctorProvider');
    return {
      doctors: [],
      refresh: async () => {},
      addDoctor: async () => {},
      updateDoctor: async () => {},
      deleteDoctor: async () => {},
      loading: false,
    };
  }
  return context;
}
