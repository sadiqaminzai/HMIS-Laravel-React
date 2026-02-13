import React, { createContext, useContext, useEffect, useState } from 'react';
import { Manufacturer } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface ManufacturerContextType {
  manufacturers: Manufacturer[];
  refresh: () => Promise<void>;
  addManufacturer: (payload: Partial<Manufacturer>) => Promise<void>;
  updateManufacturer: (payload: Partial<Manufacturer> & { id: string }) => Promise<void>;
  deleteManufacturer: (id: string) => Promise<void>;
  loading: boolean;
}

const ManufacturerContext = createContext<ManufacturerContextType | undefined>(undefined);

const mapManufacturer = (m: any): Manufacturer => ({
  id: String(m.id),
  hospitalId: String(m.hospital_id),
  name: m.name ?? '',
  licenseNumber: m.license_number ?? '',
  country: m.country ?? '',
  status: (m.status ?? 'active') as Manufacturer['status'],
  createdAt: m.created_at ? new Date(m.created_at) : undefined,
  updatedAt: m.updated_at ? new Date(m.updated_at) : undefined,
});

export function ManufacturerProvider({ children }: { children: React.ReactNode }) {
  const [manufacturers, setManufacturers] = useState<Manufacturer[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission } = useAuth();

  const refresh = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      setManufacturers([]);
      return;
    }

    // Backend: /manufacturers is guarded by permission:view_manufacturers OR manage_manufacturers
    if (!hasPermission('view_manufacturers') && !hasPermission('manage_manufacturers')) {
      setManufacturers([]);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get('/manufacturers');
      const records: any[] = data.data ?? data;
      setManufacturers(records.map(mapManufacturer));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load manufacturers');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setManufacturers([]);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  const serializePayload = (payload: Partial<Manufacturer>) => {
    const body: any = {};
    if (payload.hospitalId) body.hospital_id = payload.hospitalId;
    if (payload.name) body.name = payload.name;
    if (payload.licenseNumber !== undefined) body.license_number = payload.licenseNumber;
    if (payload.country !== undefined) body.country = payload.country;
    if (payload.status) body.status = payload.status;
    return body;
  };

  const addManufacturer = async (payload: Partial<Manufacturer>) => {
    await api.post('/manufacturers', serializePayload(payload));
    await refresh();
  };

  const updateManufacturer = async (payload: Partial<Manufacturer> & { id: string }) => {
    await api.put(`/manufacturers/${payload.id}`, serializePayload(payload));
    await refresh();
  };

  const deleteManufacturer = async (id: string) => {
    await api.delete(`/manufacturers/${id}`);
    await refresh();
  };

  return (
    <ManufacturerContext.Provider value={{ manufacturers, refresh, addManufacturer, updateManufacturer, deleteManufacturer, loading }}>
      {children}
    </ManufacturerContext.Provider>
  );
}

export function useManufacturers() {
  const context = useContext(ManufacturerContext);
  if (!context) {
    console.warn('useManufacturers called outside ManufacturerProvider');
    return {
      manufacturers: [],
      refresh: async () => {},
      addManufacturer: async () => {},
      updateManufacturer: async () => {},
      deleteManufacturer: async () => {},
      loading: false,
    };
  }
  return context;
}
