import React, { createContext, useContext, useEffect, useState } from 'react';
import { Hospital } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface HospitalContextType {
  hospitals: Hospital[];
  refresh: () => Promise<void>;
  updateHospital: (hospital: Partial<Hospital> & { id: string; logoFile?: File | null }) => Promise<void>;
  addHospital: (hospital: Partial<Hospital> & { logoFile?: File | null }) => Promise<void>;
  deleteHospital: (id: string) => Promise<void>;
  getHospital: (id: string) => Hospital | undefined;
  loading: boolean;
}

const HospitalContext = createContext<HospitalContextType | undefined>(undefined);

export function HospitalProvider({ children }: { children: React.ReactNode }) {
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const { isAuthenticated, authLoading, hasPermission } = useAuth();

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

  const refresh = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      // Skip fetching when unauthenticated to avoid noisy toasts
      setHospitals([]);
      return;
    }

    // Backend: /hospitals is guarded by permission:manage_hospitals
    if (!hasPermission('manage_hospitals')) {
      setHospitals([]);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get('/hospitals');
      const records: any[] = data.data ?? data;
      setHospitals(records.map(mapHospital));
    } catch (err: any) {
      const status = err?.response?.status;
      // Suppress unauthenticated errors here; they will be handled after login
      // Also suppress forbidden errors (403) for users who don't have hospitals directory access.
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load hospitals');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setHospitals([]);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  const addHospital = async (payload: Partial<Hospital> & { logoFile?: File | null }) => {
    const formData = new FormData();
    formData.append('name', payload.name || '');
    if (payload.code) formData.append('code', payload.code);
    if (payload.email) formData.append('email', payload.email);
    if (payload.phone) formData.append('phone', payload.phone);
    if (payload.address) formData.append('address', payload.address);
    if (payload.license) formData.append('license', payload.license);
    if (payload.licenseIssueDate) formData.append('license_issue_date', payload.licenseIssueDate);
    if (payload.licenseExpiryDate) formData.append('license_expiry_date', payload.licenseExpiryDate);
    formData.append('status', payload.status || 'active');
    if (payload.brandColor) formData.append('brand_color', payload.brandColor);
    if (payload.logoFile) formData.append('logo', payload.logoFile);

    await api.post('/hospitals', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    await refresh();
  };

  const updateHospital = async (payload: Partial<Hospital> & { id: string; logoFile?: File | null }) => {
    const formData = new FormData();
    if (payload.name) formData.append('name', payload.name);
    if (payload.code) formData.append('code', payload.code);
    if (payload.email) formData.append('email', payload.email);
    if (payload.phone) formData.append('phone', payload.phone);
    if (payload.address) formData.append('address', payload.address);
    if (payload.license) formData.append('license', payload.license);
    if (payload.licenseIssueDate) formData.append('license_issue_date', payload.licenseIssueDate);
    if (payload.licenseExpiryDate) formData.append('license_expiry_date', payload.licenseExpiryDate);
    if (payload.status) formData.append('status', payload.status);
    if (payload.brandColor) formData.append('brand_color', payload.brandColor);
    if (payload.logoFile) formData.append('logo', payload.logoFile);

    await api.post(`/hospitals/${payload.id}?_method=PUT`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    await refresh();
  };

  const deleteHospital = async (id: string) => {
    await api.delete(`/hospitals/${id}`);
    await refresh();
  };

  const getHospital = (id: string) => hospitals.find(h => h.id === id);

  return (
    <HospitalContext.Provider value={{ hospitals, refresh, updateHospital, addHospital, deleteHospital, getHospital, loading }}>
      {children}
    </HospitalContext.Provider>
  );
}

export function useHospitals() {
  const context = useContext(HospitalContext);
  if (context === undefined) {
    console.warn('useHospitals called outside of HospitalProvider');
    return {
      hospitals: [],
      refresh: async () => {},
      updateHospital: async () => {},
      addHospital: async () => {},
      deleteHospital: async () => {},
      getHospital: () => undefined,
      loading: false,
    };
  }
  return context;
}
