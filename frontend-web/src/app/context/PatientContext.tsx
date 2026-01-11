import React, { createContext, useContext, useEffect, useState } from 'react';
import { Patient } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';

interface PatientContextType {
  patients: Patient[];
  refresh: () => Promise<void>;
  addPatient: (patient: Partial<Patient> & { imageFile?: File | null }) => Promise<Patient | undefined>;
  updatePatient: (patient: Partial<Patient> & { id: string; imageFile?: File | null }) => Promise<void>;
  deletePatient: (id: string) => Promise<void>;
  loading: boolean;
}

const PatientContext = createContext<PatientContextType | undefined>(undefined);

const mapPatient = (p: any): Patient => ({
  id: String(p.id),
  hospitalId: String(p.hospital_id),
  patientId: p.patient_id,
  name: p.name,
  age: Number(p.age ?? 0),
  gender: (p.gender ?? 'other') as Patient['gender'],
  phone: p.phone ?? '',
  address: p.address ?? '',
  referredDoctorId: p.referred_doctor_id ? String(p.referred_doctor_id) : undefined,
  status: (p.status ?? 'active') as Patient['status'],
  image: p.image_url ?? p.image_path ?? '',
  createdAt: p.created_at ? new Date(p.created_at) : new Date(),
  updatedAt: p.updated_at ? new Date(p.updated_at) : undefined,
});

export function PatientProvider({ children }: { children: React.ReactNode }) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      setPatients([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/patients');
      const records: any[] = data.data ?? data;
      setPatients(records.map(mapPatient));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401) {
        toast.error(err?.response?.data?.message || 'Failed to load patients');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refresh();
  }, []);

  const buildFormData = (payload: any) => {
    const formData = new FormData();
    if (payload.hospitalId) formData.append('hospital_id', payload.hospitalId);
    if (payload.patientId) formData.append('patient_id', payload.patientId);
    if (payload.name) formData.append('name', payload.name);
    if (payload.age !== undefined && payload.age !== null) formData.append('age', String(payload.age));
    if (payload.gender) formData.append('gender', payload.gender);
    if (payload.phone) formData.append('phone', payload.phone);
    if (payload.address) formData.append('address', payload.address);
    if (payload.referredDoctorId) formData.append('referred_doctor_id', payload.referredDoctorId);
    if (payload.status) formData.append('status', payload.status);
    if (payload.imageFile) formData.append('image', payload.imageFile);
    return formData;
  };

  const addPatient = async (payload: Partial<Patient> & { imageFile?: File | null }) => {
    const formData = buildFormData(payload);
    const { data } = await api.post('/patients', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    await refresh();
    const createdRaw = data?.data ?? data;
    return createdRaw ? mapPatient(createdRaw) : undefined;
  };

  const updatePatient = async (payload: Partial<Patient> & { id: string; imageFile?: File | null }) => {
    const formData = buildFormData(payload);
    await api.post(`/patients/${payload.id}?_method=PUT`, formData, { headers: { 'Content-Type': 'multipart/form-data' } });
    await refresh();
  };

  const deletePatient = async (id: string) => {
    await api.delete(`/patients/${id}`);
    await refresh();
  };

  return (
    <PatientContext.Provider value={{ patients, refresh, addPatient, updatePatient, deletePatient, loading }}>
      {children}
    </PatientContext.Provider>
  );
}

export function usePatients() {
  const context = useContext(PatientContext);
  if (!context) {
    console.warn('usePatients called outside PatientProvider');
    return {
      patients: [],
      refresh: async () => {},
      addPatient: async () => undefined,
      updatePatient: async () => {},
      deletePatient: async () => {},
      loading: false,
    };
  }
  return context;
}
