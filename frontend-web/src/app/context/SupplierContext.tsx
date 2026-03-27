import React, { createContext, useContext, useEffect, useState } from 'react';
import { Supplier } from '../types';
import api from '../../api/axios';
import { toast } from 'sonner';
import { useAuth } from './AuthContext';

interface SupplierContextType {
  suppliers: Supplier[];
  refresh: () => Promise<void>;
  addSupplier: (payload: Partial<Supplier>) => Promise<void>;
  updateSupplier: (payload: Partial<Supplier> & { id: string }) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  loading: boolean;
}

const SupplierContext = createContext<SupplierContextType | undefined>(undefined);

const mapSupplier = (s: any): Supplier => ({
  id: String(s.id),
  hospitalId: String(s.hospital_id),
  name: s.name ?? '',
  contactInfo: s.contact_info ?? '',
  address: s.address ?? '',
  createdAt: s.created_at ? new Date(s.created_at) : undefined,
  updatedAt: s.updated_at ? new Date(s.updated_at) : undefined,
});

export function SupplierProvider({ children }: { children: React.ReactNode }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(false);
  const { isAuthenticated, authLoading, hasPermission } = useAuth();

  const refresh = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;
    if (!token) {
      setSuppliers([]);
      return;
    }

    if (!hasPermission('view_suppliers') && !hasPermission('manage_suppliers')) {
      setSuppliers([]);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get('/suppliers', { params: { per_page: 200 } });
      const records: any[] = data.data ?? data;
      setSuppliers(records.map(mapSupplier));
    } catch (err: any) {
      const status = err?.response?.status;
      if (status !== 401 && status !== 403) {
        toast.error(err?.response?.data?.message || 'Failed to load suppliers');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated || authLoading) {
      setSuppliers([]);
      return;
    }
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, authLoading]);

  const serializePayload = (payload: Partial<Supplier>) => {
    const body: any = {};
    if (payload.hospitalId) body.hospital_id = payload.hospitalId;
    if (payload.name) body.name = payload.name;
    if (payload.contactInfo !== undefined) body.contact_info = payload.contactInfo;
    if (payload.address !== undefined) body.address = payload.address;
    return body;
  };

  const addSupplier = async (payload: Partial<Supplier>) => {
    await api.post('/suppliers', serializePayload(payload));
    await refresh();
  };

  const updateSupplier = async (payload: Partial<Supplier> & { id: string }) => {
    await api.put(`/suppliers/${payload.id}`, serializePayload(payload));
    await refresh();
  };

  const deleteSupplier = async (id: string) => {
    await api.delete(`/suppliers/${id}`);
    await refresh();
  };

  return (
    <SupplierContext.Provider value={{ suppliers, refresh, addSupplier, updateSupplier, deleteSupplier, loading }}>
      {children}
    </SupplierContext.Provider>
  );
}

export function useSuppliers() {
  const context = useContext(SupplierContext);
  if (!context) {
    console.warn('useSuppliers called outside SupplierProvider');
    return {
      suppliers: [],
      refresh: async () => {},
      addSupplier: async () => {},
      updateSupplier: async () => {},
      deleteSupplier: async () => {},
      loading: false,
    };
  }
  return context;
}
